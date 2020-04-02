const bottleneck = require('bottleneck');
const fs = require('fs');
let requestUnwrapped = require('request-promise-native');
const WebSocket = require('ws');
const config = require('../config/config.json');
const Gamemode = require('./gamemode');

const OSU_SERVER = 'https://osu.ppy.sh/';
const jar = requestUnwrapped.jar();
jar.setCookie(`__cfduid=${config.cloudflare.id}`, OSU_SERVER);
jar.setCookie(`cf_clearance=${config.cloudflare.clearance}`, OSU_SERVER);
jar.setCookie(`osu_session=${config.session}`, OSU_SERVER);
jar.setCookie(`XSRF-TOKEN=${config.csrf}`, OSU_SERVER);
requestUnwrapped = requestUnwrapped.defaults({
    baseUrl: OSU_SERVER,
    method: 'POST',
    followRedirect: false,
    headers: {
        'User-Agent': config.userAgent,
        'X-CSRF-TOKEN': config.csrf
    },
    jar: jar,
    simple: false
});

const limiter = new bottleneck({
    maxConcurrent: 1,
    minTime: process.argv.includes('--messages', 2)
        ? 20000
        : process.argv.includes('--slow-requests', 2)
            ? 2500
            : 1000
});

function handleVerification() {
    console.log('osu! needs you to verify your account. Click the link in the email you received.');

    const ws = new WebSocket(`wss://notify.ppy.sh/?csrf=${config.csrf}`, {
        headers: {
            Cookie: `osu_session=${config.session}`
        }
    });

    return new Promise(resolve => {
        ws.on('message', data => {
            try {
                if (JSON.parse(data).event === 'verified') {
                    ws.close();
                    resolve();
                }
            } catch {}
        });
    });
}

const requestWrapped = async function requestWrapped(options) {
    const response = await requestUnwrapped({
        ...options,
        resolveWithFullResponse: true
    });

    switch (response.statusCode) {
        case 401:
            if (!response.body.includes('<h1 class="user-verification'))
                throw 'Authentication failed';

            await handleVerification();
            return await requestWrapped(options);
        case 403:
            throw 'Authorization failed';
        case 404:
            throw 'Not found';
        case 500:
            throw 'Server error';
    }

    return options.resolveWithFullResponse ? response : response.body;
}

let requestCounter = 0;
const requestUnlogged = limiter.wrap(requestWrapped);
const request = async function (...args) {
    const n = ++requestCounter;
    console.log(`Making request #${n} to ${args[0].uri}`);

    try {
        const response = await requestUnlogged(...args);
        console.log(`Request #${n} to ${args[0].uri} finished`);
        return response;
    } catch (error) {
        console.error(`Request #${n} to ${args[0].uri} failed: ${error}`);
        throw error;
    }
}

function idFromUrl(url) {
    return (url.match(/\/(\d+)\s*$/) || [, null])[1];
}

function firstPostIdFromTopicView(body) {
    return (body.match(/data-post-id="(\d+)"/) || [, null])[1];
}

module.exports.storeTopicCover = async function (filename) {
    const body = await request({
        uri: '/community/forums/topic-covers',
        formData: {
            cover_file: fs.createReadStream(filename)
        }
    });

    return JSON.parse(body).id;
}

module.exports.storeTopic = async function (title, content) {
    const response = await request({
        uri: '/community/forums/topics',
        form: {
            forum_id: 120,
            title: title,
            body: content
        },
        resolveWithFullResponse: true
    });

    if (response.statusCode !== 302)
        throw new Error(`Missing redirect to new topic: status code ${response.statusCode}`);

    return idFromUrl(response.headers.location);
}

module.exports.storeTopicWithPoll = async function (title, content, coverId, pollTitle) {
    const response = await request({
        uri: '/community/forums/topics',
        form: {
            forum_id: 120,
            title: title,
            body: content,
            with_poll: 1,
            cover_id: coverId,
            'forum_topic_poll[hide_results]': 1,
            'forum_topic_poll[length_days]': 7,
            'forum_topic_poll[max_options]': 1,
            'forum_topic_poll[options]': 'Yes\r\nNo',
            'forum_topic_poll[title]': pollTitle,
            'forum_topic_poll[vote_change]': 1
        },
        resolveWithFullResponse: true
    });

    if (response.statusCode !== 302)
        throw new Error(`Missing redirect to new topic: status code ${response.statusCode}`);

    return idFromUrl(response.headers.location);
}

module.exports.findFirstPostId = async function (topicId) {
    const body = await request({
        uri: `/community/forums/topics/${topicId}`,
        method: 'GET',
        qs: {
            skip_layout: 1
        }
    });

    return firstPostIdFromTopicView(body);
}

module.exports.updatePost = function (postId, content) {
    return request({
        uri: `/community/forums/posts/${postId}`,
        method: 'PUT',
        form: {
            body: content
        }
    });
}

module.exports.pinTopic = function (topicId, type = 'pin') {
    const pin = [false, 'pin', 'announce'].indexOf(type);

    if (pin === -1)
        throw 'Invalid pin type';

    return request({
        uri: `/community/forums/topics/${topicId}/pin`,
        qs: { pin }
    });
}

module.exports.lockTopic = function (topicId) {
    return request({
        uri: `/community/forums/topics/${topicId}/lock`,
        qs: {
            lock: 1
        }
    });
}

module.exports.getPostContent = function (postId) {
    return request({
        uri: `/community/forums/posts/${postId}/raw`,
        method: 'GET'
    });
}

module.exports.getPollResult = async function (topicId) {
    let topic = await request({
        uri: `/community/forums/topics/${topicId}`,
        method: 'GET'
    });

    const voteCounts = [];

    for (let i = 0; i < 2; i++) {
        const match = topic.match(/<div class="forum-poll-row__result forum-poll-row__result--total">\s*(\d+)\s*<\/div>/);

        if (match === null)
            throw new Error('Forum topic page does not match the expected format');

        voteCounts.push(parseInt(match[1]));
        topic = topic.substring(match.index + match[0].length);
    }

    return {
        yes: voteCounts[0],
        no: voteCounts[1],
        percent: (100 * voteCounts[0] / (voteCounts[0] + voteCounts[1])).toFixed(2)
    };
}

module.exports.reply = function (topicId, content) {
    return request({
        uri: `/community/forums/topics/${topicId}/reply`,
        form: {
            body: content
        }
    });
}

module.exports.getModeTopics = async function (forumId) {
    let body = await request({
        uri: `/community/forums/${forumId}`,
        method: 'GET'
    });

    const topics = {};
    body = body.substring(body.indexOf('Pinned Topics'), body.indexOf('id="topics"'));

    while (true) {
        const match = body.match(/\[(osu![a-z]+)\] Project Loved: Week of/);

        if (match === null)
            break;

        const mode = new Gamemode(match[1]);

        body = body.substring(match.index + match[0].length);

        topics[mode.integer] = body.match(/href="https:\/\/osu\.ppy\.sh\/community\/forums\/topics\/(\d+)\?start=unread"/)[1];
    }

    return topics;
}

module.exports.getTopic = function (topicId) {
    return request({
        uri: `/community/forums/topics/${topicId}`,
        method: 'GET'
    });
}

// Note: This excludes pinned topics
module.exports.getTopics = async function (forumId) {
    const topics = [];
    let idx;

    for (let page = 1; ; page++) {
        let listing = await request({
            uri: `/community/forums/${forumId}`,
            method: 'GET',
            qs: {
                page: page
            }
        });

        listing = listing.substring(listing.indexOf('id="topics"'));

        if ((idx = listing.indexOf('js-forum-topic-entry')) === -1)
            break;

        do {
            listing = listing.substring(idx + 20);
            topics.push(listing.match(/data-topic-id="(\d+)"/)[1]);
        } while ((idx = listing.indexOf('js-forum-topic-entry')) !== -1);
    }

    return topics;
}

module.exports.watchTopic = function (topicId, watch = true) {
    return request({
        uri: `/community/forums/topic-watches/${topicId}`,
        method: 'PUT',
        qs: {
            state: watch ? 'watching_mail' : 'not_watching'
        }
    });
}

function getIcon(icon) {
    switch (icon) {
        default: case 'none': return 0;
        case 'star': return 5;
        case 'bubble': return 7;
        case 'heart': return 4;
        case 'flame': return 1;
        case 'nuke': return 6;
        case 'question': return 9;
        case 'alert': return 10;
        case 'info': return 8;
        case 'pop': return 12;
        case 'broken_heart': return 13;
        case 'osu': return 14;
        case 'taiko': return 15;
        case 'catch': return 16;
        case 'mania': return 17;
    }
}

/**
 * Sends a forum message using the old website.
 * @param {string} subject Subject of the message.
 * @param {string} icon Icon of the message. Must be one of the available icons in {@link getIcon}.
 * @param {string} message Message contents.
 * @param {number[]} to Recipients of the message. Must be an array of user IDs.
 * @param {number[]} bcc Blind copy recipients of the message. Must be an array of user IDs.
 * @returns {undefined}
 */
module.exports.sendPm = async function (subject, icon, message, to, bcc = []) {
    if (to.length < 1)
        throw new Error('Recipient list must not be empty');

    const form = {
        icon: getIcon(icon),
        localUserCheck: config.csrfOld,
        message: message,
        subject: subject,

        // constant
        addbbcode20: 100,
        cancel: '',
        load: '',
        post: 1,
        preview: '',
        save: '',
        username_list: ''
    };

    to.forEach(u => form[`address_list[u][${u}]`] = 'to');
    bcc.forEach(u => form[`address_list[u][${u}]`] = 'bcc');

    const response = await request({
        uri: '/forum/ucp.php',
        qs: {
            action: 'post',
            i: 'pm',
            mode: 'compose',
            sid: config.sessionOld
        },
        form: form,
        resolveWithFullResponse: true
    });

    if (response.statusCode !== 302)
        console.error(`Failed to send PM to ${to[0]}: status code ${response.statusCode}`);
}
