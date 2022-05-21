const bottleneck = require('bottleneck');
const { green, red, yellow } = require('chalk');
const { randomBytes } = require('crypto');
const { createServer } = require('http');
const open = require('open');
const superagent = require('superagent');
const { URLSearchParams, URL } = require('url');
const config = require('./config');

let chatAccessToken;
const port = 18888;

function sendChatAnnouncement(userIds, name, description, message) {
  if (chatAccessToken == null) {
    throw 'Chat access token not set';
  }

  return superagent
    .post(`${config.osuBaseUrl}/api/v2/chat/channels`)
    .auth(chatAccessToken, { type: 'bearer' })
    .send({
      channel: { name, description },
      message,
      target_ids: userIds,
      type: 'ANNOUNCE',
    })
    .then(() => console.log(green(`Sent chat announcement to ${userIds.join(', ')}`)))
    .catch((error) => {
      let message = `Failed to send chat announcement to ${userIds.join(', ')}:\n  `;

      if (error.status === 404 || error.status === 422) {
        message += 'One or more recipients not found';
      } else {
        message += error.toString();
      }

      console.error(red(message));
    });
}

async function setChatAccessToken() {
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
        console.log(green('Authorization complete'));
        res.writeHead(200);
        res.write('You may close this page and return to the terminal\n');

        resolve(codeParam);
      }

      res.end();
      httpsServer.close(() => console.log('Closed authorization callback server'));
    }).listen(port);
  });

  console.log(yellow('Waiting for authorization in browser'));

  const url = new URL(`${config.osuBaseUrl}/oauth/authorize`);
  url.search = new URLSearchParams({
    client_id: config.apiClient.id,
    redirect_uri: `http://localhost:${port}`,
    response_type: 'code',
    scope: 'chat.write',
    state,
  });
  await open(url.toString());

  const authCode = await authCodePromise.catch(() => {
    console.error(red('Authorization failed'));
    process.exit(1);
  });
  const tokenResponse = await superagent
    .post(`${config.osuBaseUrl}/oauth/token`)
    .send({
      client_id: config.apiClient.id,
      client_secret: config.apiClient.secret,
      code: authCode,
      grant_type: 'authorization_code',
      redirect_uri: `http://localhost:${port}`,
    });

  chatAccessToken = tokenResponse.body.access_token;

  console.log(green('Chat access token set'));
}

const limiter = new bottleneck({
  maxConcurrent: 1,
  minTime: 1000,
});

module.exports = {
  sendChatAnnouncement: limiter.wrap(sendChatAnnouncement),
  setChatAccessToken,
};
