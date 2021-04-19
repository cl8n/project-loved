const superagent = require('superagent');

module.exports = class Discord {
    #webhook;

    constructor(webhook) {
        this.#webhook = webhook;
    }

    async post(name, content, embeds = null) {
        if (content.length > 2000)
            throw new Error(`Discord message content is too long (${content.length} characters)`);

        return await superagent
            .post(this.#webhook)
            .query({ wait: true })
            .send({
                content: content,
                embeds: embeds,
                username: name,
            });
    }
}
