const superagent = require('superagent');

module.exports = class {
    constructor(webhook) {
        this._webhook = webhook;
    }

    post(name, content, embeds = null) {
        if (content.length > 2000)
            throw new Error(`Discord message content is too long (${content.length} characters)`);

        return superagent
            .post(this._webhook)
            .query({ wait: true })
            .send({
                content: content,
                embeds: embeds,
                username: name,
            });
    }
}
