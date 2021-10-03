const superagent = require('superagent');

module.exports = class Discord {
    #webhook;

    constructor(webhook) {
        this.#webhook = webhook;
    }

    async post(username, content, embeds = null) {
        if (content != null && content.length > 2000 && embeds != null && embeds.length > 10)
            throw new Error(`Discord message content and embeds are too long`);

        if (content != null && content.length > 2000) {
            await this.post(username, content.slice(0, 2000), embeds);

            for (let i = 2000; i < content.length; i += 2000) {
                await this.post(username, content.slice(i, i + 2000));
            }

            return;
        }

        if (embeds != null && embeds.length > 10) {
            await this.post(username, content, embeds.slice(0, 10));

            for (let i = 10; i < embeds.length; i += 10) {
                await this.post(username, null, embeds.slice(i, i + 10));
            }

            return;
        }

        await superagent
            .post(this.#webhook)
            .send({
                allowed_mentions: {
                    parse: ['everyone'],
                },
                content: content || undefined,
                embeds: embeds || undefined,
                username,
            });
    }
}
