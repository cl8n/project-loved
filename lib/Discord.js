const request = require('request-promise-native');

module.exports = class {
    constructor(webhook) {
        this._webhook = webhook;
    }

    post(name, content, embeds) {
        return request({
            uri: this._webhook,
            method: 'POST',
            json: true,
            body: {
                username: name,
                content: content,
                embeds: embeds
            }
        });
    }
}
