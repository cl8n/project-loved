import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { inspect } from 'node:util';
import chalk from 'chalk';
import open from 'open';
import superagent from 'superagent';
import Limiter from './Limiter.js';
import config from './config.js';

let chatAccessToken;
const limiter = new Limiter(1000);
const port = 18888;

function runApiRequestFn(requestFn) {
	if (chatAccessToken == null) {
		throw 'Chat access token not set';
	}

	return limiter.run(requestFn);
}

export function revokeChatAccessToken() {
	return runApiRequestFn(() =>
		superagent
			.delete(`${config.osuBaseUrl}/api/v2/oauth/tokens/current`)
			.auth(chatAccessToken, { type: 'bearer' })
			.then(() => {
				console.error(chalk.green('Revoked chat access token'));
				chatAccessToken = undefined;
			})
			.catch(() => console.error(chalk.red('Failed to revoke chat access token'))),
	);
}

export function sendChatAnnouncement(userIds, name, description, message) {
	return runApiRequestFn(() =>
		superagent
			.post(`${config.osuBaseUrl}/api/v2/chat/channels`)
			.auth(chatAccessToken, { type: 'bearer' })
			.send({
				channel: { name, description },
				message,
				target_ids: userIds,
				type: 'ANNOUNCE',
			})
			.then(() => console.error(chalk.green(`Sent chat announcement to ${userIds.join(', ')}`)))
			.catch((error) => {
				const message = `Failed to send chat announcement to ${userIds.join(', ')}:`;

				if (error.status === 404 || error.status === 422) {
					console.error(chalk.red(message + '\n  One or more recipients not found'));
				} else {
					console.error(chalk.red(message));
					console.error(inspect(error, false, 1, true));
					process.exit(1);
				}
			}),
	);
}

export async function setChatAccessToken() {
	const state = randomBytes(12).toString('base64url');
	const authCodePromise = new Promise((resolve, reject) => {
		const httpsServer = createServer((req, res) => {
			const url = new URL(req.url, `http://${req.headers.host}`);
			const codeParam = url.searchParams.get('code');
			const stateParam = url.searchParams.get('state');

			if (!codeParam || !stateParam || state !== stateParam) {
				res.writeHead(422);
				res.write('Invalid request\n');

				reject();
			} else {
				console.error(chalk.green('Authorization complete'));
				res.writeHead(200);
				res.write('You may close this page and return to the terminal\n');

				resolve(codeParam);
			}

			res.end();
			httpsServer.close(() => console.error('Closed authorization callback server'));
		}).listen(port);
	});

	console.error(chalk.yellow('Waiting for authorization in browser'));

	const url = new URL(`${config.osuBaseUrl}/oauth/authorize`);
	url.search = new URLSearchParams({
		client_id: config.apiClient.id,
		redirect_uri: `http://localhost:${port}`,
		response_type: 'code',
		scope: 'chat.write_manage',
		state,
	});
	await open(url.toString());

	const authCode = await authCodePromise.catch(() => {
		console.error(chalk.red('Authorization failed'));
		process.exit(1);
	});
	const tokenResponse = await superagent.post(`${config.osuBaseUrl}/oauth/token`).send({
		client_id: config.apiClient.id,
		client_secret: config.apiClient.secret,
		code: authCode,
		grant_type: 'authorization_code',
		redirect_uri: `http://localhost:${port}`,
	});

	chatAccessToken = tokenResponse.body.access_token;

	console.error(chalk.green('Chat access token set'));
}
