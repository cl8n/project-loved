const bottleneck = require('bottleneck');
const config = require('./config/config.json');
const fs = require('fs');
let requestUnwrapped = require('request-promise-native');

const OSU_SERVER = 'https://osu.ppy.sh/';
const jar = requestUnwrapped.jar();
jar.setCookie(`XSRF-TOKEN=${config.csrf}`, OSU_SERVER);
jar.setCookie(`osu_session=${config.session}`, OSU_SERVER);
requestUnwrapped = requestUnwrapped.defaults({
    baseUrl: OSU_SERVER,
    method: 'POST',
    followRedirect: false,
    headers: {
        'X-CSRF-TOKEN': config.csrf
    },
    jar: jar
});

const limiter = new bottleneck({
    maxConcurrent: 1,
    minTime: 1000
});

const requestUnlogged = limiter.wrap(requestUnwrapped);
const request = function (...args) {
    console.log('Making request to ' + args[0].uri);
    return requestUnlogged(...args);
}

function idFromUrl(url) {
    return (url.match(/\/(\d+)\s*$/) || [, null])[1];
}

function firstPostIdFromTopicView(body) {
    return (body.match(/data-post-id="(\d+)"/) || [, null])[1];
}

exports.storeTopicCover = function (filename) {
    return request({
        uri: '/community/forums/topic-covers',
        formData: {
            cover_file: fs.createReadStream(filename)
        }
    }).then(body => JSON.parse(body).id);
}

exports.storeTopic = function (title, content) {
    return request({
        uri: '/community/forums/topics',
        form: {
            forum_id: 120,
            title: title,
            body: content
        },
        simple: false,
        resolveWithFullResponse: true
    }).then(response => {
        if (response.statusCode === 302)
            return idFromUrl(response.headers.location);
    });
}

exports.storeTopicWithPoll = function (title, content, coverId, pollTitle) {
    return request({
        uri: '/community/forums/topics',
        form: {
            forum_id: 120,
            title: title,
            body: content,
            with_poll: 1,
            cover_id: coverId,
            'forum_topic_poll[length_days]': 7,
            'forum_topic_poll[max_options]': 1,
            'forum_topic_poll[options]': 'Yes\r\nNo',
            'forum_topic_poll[title]': pollTitle,
            'forum_topic_poll[vote_change]': 1
        },
        simple: false,
        resolveWithFullResponse: true
    }).then(response => {
        if (response.statusCode === 302)
            return idFromUrl(response.headers.location);
    });
}

exports.findFirstPostId = function (topicId) {
    return request({
        uri: `/community/forums/topics/${topicId}`,
        method: 'GET',
        qs: {
            skip_layout: 1
        }
    }).then(body => firstPostIdFromTopicView(body));
}

exports.updatePost = function (postId, content) {
    return request({
        uri: `/community/forums/posts/${postId}`,
        method: 'PUT',
        form: {
            body: content
        }
    });
}

exports.pinTopic = function (topicId, pin = true) {
    return request({
        uri: `/community/forums/topics/${topicId}/pin`,
        qs: {
            pin: pin ? 1 : 0
        }
    });
}

exports.lockTopic = function (topicId) {
    return request({
        uri: `/community/forums/topics/${topicId}/lock`,
        qs: {
            lock: 1
        }
    });
}

exports.getPostContent = function (postId) {
    return request({
        uri: `/community/forums/posts/${postId}/raw`,
        method: 'GET'
    });
}

exports.getPollFirstResult = function (topicId) {
    return request({
        uri: `/community/forums/topics/${topicId}`,
        method: 'GET'
    }).then(body => body.match(/(\d{2,3}\.\d{2})%/)[1]);
}

exports.reply = function (topicId, content) {
    return request({
        uri: `/community/forums/topics/${topicId}/reply`,
        form: {
            body: content
        }
    });
}

function convertMode(mode) {
    switch (mode) {
        case 'osu!standard':
            return 'osu';
        case 'osu!taiko':
            return 'taiko';
        case 'osu!catch':
            return 'catch';
        case 'osu!mania':
            return 'mania';
    }

    return null;
}

exports.getModeTopics = function (forumId) {
    return request({
        uri: `/community/forums/${forumId}`,
        method: 'GET'
    }).then(body => {
        const topics = {};

        body = body.substring(body.search('Pinned Topics'));

        for (let i = 0; i < 4; i++) {
            const match = body.match(/\[(osu![a-z]+)\] Project Loved: Week of/);

            body = body.substring(match.index + match[0].length);

            topics[convertMode(match[1])] = body.match(/href="https:\/\/osu\.ppy\.sh\/community\/forums\/topics\/(\d+)\?start=unread"/)[1];
        }

        return topics;
    });
}
