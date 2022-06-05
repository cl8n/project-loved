const bottleneck = require('bottleneck');
const { dim, green, red, yellow } = require('chalk');
const fs = require('fs');
let requestUnwrapped = require('request-promise-native');
const WebSocket = require('ws');
const config = require('./config');
const Gamemode = require('./gamemode');

const jar = requestUnwrapped.jar();
jar.setCookie(`__cfduid=${config.cloudflare.id}`, config.osuBaseUrl);
jar.setCookie(`cf_clearance=${config.cloudflare.clearance}`, config.osuBaseUrl);
jar.setCookie(`osu_session=${config.session}`, config.osuBaseUrl);
jar.setCookie(`XSRF-TOKEN=${config.csrf}`, config.osuBaseUrl);
requestUnwrapped = requestUnwrapped.defaults({
    baseUrl: config.osuBaseUrl,
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
    minTime: 2500,
});

function handleVerification() {
    console.log(yellow('osu! needs you to verify your account. Click the link in the email you received.'));

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
        case 413:
            throw 'File too large';
        case 500:
            throw 'Server error';
    }

    return options.resolveWithFullResponse ? response : response.body;
}

let requestCounter = 0;
const requestUnlogged = limiter.wrap(requestWrapped);
const request = async function (...args) {
    const n = ++requestCounter;
    console.log(dim(`Making request #${n} to ${args[0].uri}`));

    try {
        const response = await requestUnlogged(...args);
        console.log(dim(green(`Request #${n} to ${args[0].uri} finished`)));
        return response;
    } catch (error) {
        console.error(dim(red(`Request #${n} to ${args[0].uri} failed: ${error}`)));
        throw error;
    }
}

module.exports.storeTopicCover = async function (filename, topicId) {
    const body = await request({
        uri: '/community/forums/topic-covers',
        formData: {
            cover_file: fs.createReadStream(filename),
            topic_id: topicId,
        }
    });

    return JSON.parse(body).id;
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

module.exports.getModeTopics = async function (forumId) {
    let body = await request({
        uri: `/community/forums/${forumId}`,
        method: 'GET'
    });

    const topicIdRegex = new RegExp(`href="${config.osuBaseUrl.replace(/\./g, '\\.')}/community/forums/topics/(\\d+)\\?start=unread"`);
    const topics = {};
    body = body.substring(body.indexOf('Pinned Topics'), body.indexOf('id="topics"'));

    while (true) {
        const match = body.match(/\[(osu![a-z]*)\] Project Loved: /);

        if (match == null)
            break;

        const mode = new Gamemode(match[1]);

        body = body.substring(match.index + match[0].length);

        topics[mode.integer] = parseInt(body.match(topicIdRegex)[1], 10);
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
