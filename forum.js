const config = require('./config/config.json');
const fs = require('fs');
let request = require('request');

const OSU_SERVER = 'https://osu.ppy.sh/';
const jar = request.jar();
jar.setCookie(`XSRF-TOKEN=${config.csrf}`, OSU_SERVER);
jar.setCookie(`osu_session=${config.session}`, OSU_SERVER);
request = request.defaults({
    baseUrl: OSU_SERVER,
    method: 'POST',
    followRedirect: false,
    headers: {
        'X-CSRF-TOKEN': config.csrf
    },
    jar: jar
});

function idFromUrl(url) {
    return (url.match(/\/(\d+)\s*$/) || [, null])[1];
}

function firstPostIdFromTopicView(body) {
    return (body.match(/data-post-id="(\d+)"/) || [, null])[1];
}

exports.storeTopicCover = function (filename, callback) {
    request('/community/forums/topic-covers', {
        formData: {
            cover_file: fs.createReadStream(filename)
        }
    }, function (error, response, body) {
        if (!error && response.statusCode === 200)
            callback(JSON.parse(body).id);
    });
}

exports.storeTopic = function (title, content, callback) {
    request({
        uri: '/community/forums/topics',
        form: {
            forum_id: 120,
            title: title,
            body: content
        }
    }, function (error, response) {
        if (!error && response.statusCode === 302)
            callback(idFromUrl(response.headers.location));
    });
}

exports.storeTopicWithPoll = function (title, content, coverId, pollTitle, callback) {
    request({
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
        }
    }, function (error, response) {
        if (!error && response.statusCode === 302)
            callback(idFromUrl(response.headers.location));
    });
}

exports.findFirstPostId = function (topicId, callback) {
    request({
        uri: `/community/forums/topics/${topicId}`,
        method: 'GET',
        qs: {
            skip_layout: 1
        }
    }, function (error, response, body) {
        if (!error && response.statusCode === 200)
            callback(firstPostIdFromTopicView(body));
    });
}

exports.updatePost = function (postId, content, callback) {
    request({
        uri: `/community/forums/posts/${postId}`,
        method: 'PUT',
        form: {
            body: content
        }
    }, function (error) {
        callback(!error);
    });
}
