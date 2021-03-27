const superagent = require('superagent');

const baseUrl = 'https://loved.sh/api/local-interop';

module.exports = class {
    constructor(key) {
        this._request = superagent
            .agent()
            .set('X-Loved-InteropKey', key);
    }

    async getRoundInfo(roundId) {
        const response = await this._request
            .get(`${baseUrl}/data`)
            .query({ roundId });
        const { nominations, round } = response.body;

        return {
            intro: round.news_intro ?? '',
            introPreview: round.news_intro_preview ?? '',
            // TODO: does not exist on server yet
            //outro: round.news_outro ?? '',
            postTime: new Date(round.news_posted_at),
            title: `Project Loved: ${round.name}`,

            allNominations: nominations,
            childNominations: nominations.filter((n) => n.parentId != null),
            nominations: nominations.filter((n) => n.parentId == null),
        };
    }

    async getRoundsAvailable() {
        const response = await this._request.get(`${baseUrl}/rounds-available`);

        return response.body;
    }
};
