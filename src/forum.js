import { appendFileSync } from 'node:fs';
import { inspect } from 'node:util';
import RateLimiter from '@cl8n/rate-limiter';
import chalk from 'chalk';
import superagent from 'superagent';
import WebSocket from 'ws';
import Ruleset from './Ruleset.js';
import config from './config.js';
import { NoTraceError } from './helpers.js';

function handleVerification() {
	console.log(
		chalk.yellow(
			'osu! needs you to verify your account. Click the link in the email you received.',
		),
	);

	const ws = new WebSocket(`wss://notify.ppy.sh/?csrf=${config.csrf}`, {
		headers: {
			Cookie: `osu_session=${config.session}`,
		},
	});

	return new Promise((resolve) => {
		ws.on('message', (data) => {
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
})
	.map(([key, value]) => `${key}=${value}`)
	.join('; ');
const limiter = new RateLimiter(2500);
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
			throw new NoTraceError('Authentication failed');
		}

		await handleVerification();
		return await requestBase(superagentModifier);
	}

	return response;
}

let requestCounter = 0;
async function request(options) {
	const superagentModifier = (baseSuperagent) => {
		let newSuperagent = baseSuperagent[options.method ?? 'post'](config.osuBaseUrl + options.uri);

		if (options.attach != null) {
			newSuperagent = newSuperagent.attach(...options.attach);
		}

		if (options.field != null) {
			newSuperagent = newSuperagent.field(...options.field);
		}

		if (options.qs != null) {
			newSuperagent = newSuperagent.query(options.qs);
		}

		if (options.accept != null) {
			newSuperagent = newSuperagent.accept(options.accept);
		}

		return newSuperagent;
	};

	const n = ++requestCounter;
	console.error(chalk.dim(`Making request #${n} to ${options.uri}`));

	return requestBase(superagentModifier)
		.then((response) => {
			console.error(chalk.dim.green(`Request #${n} to ${options.uri} finished`));
			return response;
		})
		.catch((error) => {
			const requestLogFilename = 'request-log.txt';
			const requestLogEntry =
				`########## ${(options.method ?? 'post').toUpperCase()} ${config.osuBaseUrl}${options.uri}\n` +
				`########## ${new Date().toISOString()}\n` +
				`${inspect(error)}\n\n`;

			appendFileSync(requestLogFilename, requestLogEntry);

			console.error(
				chalk.dim.red(
					`Request #${n} to ${options.uri} failed. See ${requestLogFilename} for more details`,
				),
			);

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

	if (pin === -1) {
		throw new Error('Invalid pin type');
	}

	await request({
		uri: `/community/forums/topics/${topicId}/pin`,
		qs: { pin },
	});
}

export async function lockTopic(topicId) {
	await request({
		uri: `/community/forums/topics/${topicId}/lock`,
		qs: {
			lock: 1,
		},
	});
}

export async function getModeTopics(forumId) {
	let { text: body } = await request({
		uri: `/community/forums/${forumId}`,
		method: 'get',
		accept: 'html',
	});

	const pinnedTopicsStartMatch = body.match(/<h2(?:>|\s[^>]*>)\s*Pinned Topics\s*<\/h2>/);
	const pinnedTopicsEndMatch = body.match(/<div\s[^>]*id="topics"/);

	if (pinnedTopicsStartMatch == null || pinnedTopicsEndMatch == null) {
		throw new Error('Unexpected HTML: Cannot find start or end of pinned topic layout');
	}

	body = body.slice(pinnedTopicsStartMatch.index, pinnedTopicsEndMatch.index);

	let foundTopics = false;
	const topics = {};

	while (true) {
		const topicLinkMatch = body.match(
			/<a\s[^>]*href="[^"]*\/community\/forums\/topics\/(\d+)"[^>]*>\s*\[(osu![a-z]*)\] Project Loved: /,
		);

		if (topicLinkMatch == null) {
			break;
		}

		const ruleset = new Ruleset(topicLinkMatch[2]);

		body = body.slice(topicLinkMatch.index + topicLinkMatch[0].length);
		foundTopics = true;
		topics[ruleset.id] = Number.parseInt(topicLinkMatch[1], 10);
	}

	if (!foundTopics) {
		throw new Error('Unexpected HTML: Cannot find any pinned topics');
	}

	return topics;
}

export async function watchTopic(topicId, watch = true) {
	await request({
		uri: `/community/forums/topic-watches/${topicId}`,
		method: 'put',
		qs: {
			state: watch ? 'watching_mail' : 'not_watching',
		},
	});
}
