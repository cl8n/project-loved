import chalk from 'chalk';
import superagent from 'superagent';
import WebSocket from 'ws';
import config from './config.js';
import Ruleset from './Ruleset.js';
import Limiter from './Limiter.js';

function handleVerification() {
    console.log(chalk.yellow('osu! needs you to verify your account. Click the link in the email you received.'));

    const ws = new WebSocket(`wss://notify.ppy.sh/?csrf=${config.csrf}`, {
        headers: {
            Cookie: `osu_session=${config.session}`
        }
    });

    return new Promise(resolve => {
        ws.on('message', data => {
            try {
                if (JSON.parse(data.toString()).event === 'verified') {
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
const agent = superagent
    .agent()
    .ok((response) => response.status < 300 || response.status === 401)
    .redirects(0)
    .set('Cookie', cookieHeader)
    .set('User-Agent', config.userAgent)
    .set('X-CSRF-TOKEN', config.csrf);
async function requestBase(superagentModifier) {
    const response = await limiter.run(async () => await superagentModifier(agent));

    if (response.status === 401) {
        if (!response.text?.includes('<h1 class="user-verification')) {
            throw 'Authentication failed';
        }

        await handleVerification();
        return await requestBase(superagentModifier);
    }

    return response;
}

let requestCounter = 0;
async function request(options) {
    const superagentModifier = (superagent) => {
        superagent = superagent[options.method ?? 'post'](config.osuBaseUrl + options.uri);

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

        return superagent;
    };

    const n = ++requestCounter;
    console.error(chalk.dim(`Making request #${n} to ${options.uri}`));

    return requestBase(superagentModifier)
        .then((response) => {
            console.error(chalk.dim.green(`Request #${n} to ${options.uri} finished`));
            return response;
        })
        .catch((error) => {
            console.error(chalk.dim.red(`Request #${n} to ${options.uri} failed: ${error}`));
            throw error;
        });
}

export async function storeTopicCover(filename, topicId) {
    const { body } = await request({
        uri: '/community/forums/topic-covers',
        attach: ['cover_file', filename],
        field: ['topic_id', topicId],
        accept: 'json',
    });

    return body.id;
}

export async function pinTopic(topicId, type = 'pin') {
    const pin = [false, 'pin', 'announce'].indexOf(type);

    if (pin === -1)
        throw 'Invalid pin type';

    await request({
        uri: `/community/forums/topics/${topicId}/pin`,
        qs: { pin }
    });
}

export async function lockTopic(topicId) {
    await request({
        uri: `/community/forums/topics/${topicId}/lock`,
        qs: {
            lock: 1
        }
    });
}

export async function getModeTopics(forumId) {
    let { text: body } = await request({
        uri: `/community/forums/${forumId}`,
        method: 'get',
        accept: 'html',
    });

    const topicIdRegex = new RegExp(`href="${config.osuBaseUrl.replace(/\./g, '\\.')}/community/forums/topics/(\\d+)\\?start=unread"`);
    const topics = {};
    body = body.substring(body.indexOf('Pinned Topics'), body.indexOf('id="topics"'));

    while (true) {
        const match = body.match(/\[(osu![a-z]*)\] Project Loved: /);

        if (match == null)
            break;

        const mode = new Ruleset(match[1]);

        body = body.substring(match.index + match[0].length);

        topics[mode.id] = parseInt(body.match(topicIdRegex)[1], 10);
    }

    return topics;
}

export async function watchTopic(topicId, watch = true) {
    await request({
        uri: `/community/forums/topic-watches/${topicId}`,
        method: 'put',
        qs: {
            state: watch ? 'watching_mail' : 'not_watching'
        }
    });
}
