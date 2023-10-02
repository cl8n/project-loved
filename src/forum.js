const { dim, green, red, yellow } = require('chalk');
const superagent = require('superagent');
const WebSocket = require('ws');
const config = require('./config');
const Gamemode = require('./gamemode');
const Limiter = require('./Limiter');

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

const cookieHeader = Object.entries({
    __cfduid: config.cloudflare.id,
    cf_clearance: config.cloudflare.clearance,
    osu_session: config.session,
    'XSRF-TOKEN': config.csrf,
})
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
const limiter = new Limiter(2500);
async function requestBase(superagentModifier) {
    const response = await limiter.run(async () => await superagentModifier(
        superagent
            .ok((response) => response.status < 300 || response.status === 401)
            .redirects(0)
            .set('Cookie', cookieHeader)
            .set('User-Agent', config.userAgent)
            .set('X-CSRF-TOKEN', config.csrf),
    ));

    if (response.status === 401) {
        if (!response.text?.includes('<h1 class="user-verification')) {
            throw 'Authentication failed';
        }

        await handleVerification();
        return await requestBase(superagentModifier);
    }
}

let requestCounter = 0;
async function request(options) {
    const superagentModifier = (superagent) => {
        if (options.attach != null) {
            superagent = superagent.attach(...options.attach);
        }

        if (options.field != null) {
            superagent = superagent.field(...options.field);
        }

        if (options.qs != null) {
            superagent = superagent.query(options.qs);
        }

        if (options.accept != null) {
            superagent = superagent.accept(options.accept);
        }

        return superagent.request(options.method ?? 'POST', config.osuBaseUrl + options.uri);
    };

    const n = ++requestCounter;
    console.log(dim(`Making request #${n} to ${options.uri}`));

    return requestBase(superagentModifier)
        .then((response) => {
            console.log(dim(green(`Request #${n} to ${options.uri} finished`)));
            return response;
        })
        .catch((error) => {
            console.error(dim(red(`Request #${n} to ${options.uri} failed: ${error}`)));
            throw error;
        });
}

module.exports.storeTopicCover = async function (filename, topicId) {
    const { body } = await request({
        uri: '/community/forums/topic-covers',
        attach: ['cover_file', filename],
        field: ['topic_id', topicId],
        accept: 'json',
    });

    return body.id;
}

module.exports.pinTopic = async function (topicId, type = 'pin') {
    const pin = [false, 'pin', 'announce'].indexOf(type);

    if (pin === -1)
        throw 'Invalid pin type';

    await request({
        uri: `/community/forums/topics/${topicId}/pin`,
        qs: { pin }
    });
}

module.exports.lockTopic = async function (topicId) {
    await request({
        uri: `/community/forums/topics/${topicId}/lock`,
        qs: {
            lock: 1
        }
    });
}

module.exports.getModeTopics = async function (forumId) {
    let { body } = await request({
        uri: `/community/forums/${forumId}`,
        method: 'GET',
        accept: 'html',
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

module.exports.watchTopic = async function (topicId, watch = true) {
    await request({
        uri: `/community/forums/topic-watches/${topicId}`,
        method: 'PUT',
        qs: {
            state: watch ? 'watching_mail' : 'not_watching'
        }
    });
}
