const bottleneck = require('bottleneck');
const superagent = require('superagent');

const limiter = new bottleneck({
    maxConcurrent: 1,
    minTime: 1000,
});

module.exports = class Discord {
    static maxEmbeds = 10;
    static maxEmbedTitleLength = 256;
    static maxLength = 2000;

    #webhook;

    constructor(webhook) {
        this.#webhook = webhook;
    }

    async post(username, content, embeds = null) {
        if (content != null && content.length > Discord.maxLength && embeds != null && embeds.length > Discord.maxEmbeds)
            throw new Error(`Discord message content and embeds are too long`);

        if (content != null && content.length > Discord.maxLength) {
            await this.post(username, content.slice(0, Discord.maxLength), embeds);

            for (let i = Discord.maxLength; i < content.length; i += Discord.maxLength) {
                await this.post(username, content.slice(i, i + Discord.maxLength));
            }

            return;
        }

        if (embeds != null && embeds.length > Discord.maxEmbeds) {
            await this.post(username, content, embeds.slice(0, Discord.maxEmbeds));

            for (let i = Discord.maxEmbeds; i < embeds.length; i += Discord.maxEmbeds) {
                await this.post(username, null, embeds.slice(i, i + Discord.maxEmbeds));
            }

            return;
        }

        if (embeds != null) {
            for (const embed of embeds) {
                if (embed.title && embed.title.length > Discord.maxEmbedTitleLength) {
                    const description = embed.description;

                    embed.description = '...' + embed.title.slice(Discord.maxEmbedTitleLength - 3);
                    embed.title = embed.title.slice(0, Discord.maxEmbedTitleLength - 3) + '...';

                    if (description) {
                        embed.description += '\n\n' + description;
                    }
                }
            }
        }

        await limiter.schedule(async () => {
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
        });
    }
}
