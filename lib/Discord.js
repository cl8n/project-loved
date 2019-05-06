const request = require('request-promise-native');

module.exports = class {
    constructor(webhook) {
        this._webhook = webhook;
    }

    post(name, content, embeds = null) {
        if (content.length > 2000)
            throw `Discord message content is too long (${content.length} characters)`;

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
