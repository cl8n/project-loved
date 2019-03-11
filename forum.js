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
    minTime: 666
});

const request = limiter.wrap(requestUnwrapped);

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
