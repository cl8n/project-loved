const request = require('request-promise-native');

module.exports = class {
    constructor(key) {
        this._request = request.defaults({
            baseUrl: 'https://loved.sh/api/local-interop',
            headers: { 'X-Loved-InteropKey': key },
            json: true,
            method: 'GET',
        });
    }

    async getRoundInfo(roundId) {
        const response = await this._request({
            qs: { roundId },
            uri: '/data',
        });

        return {
            intro: response.round.news_intro ?? '',
            introPreview: response.round.news_intro_preview ?? '',
            // TODO: does not exist on server yet
            //outro: response.round.news_outro ?? '',
            postTime: new Date(response.round.news_posted_at),
            title: `Project Loved: ${response.round.name}`,

            allNominations: response.nominations,
            childNominations: response.nominations.filter((n) => n.parentId != null),
            nominations: response.nominations.filter((n) => n.parentId == null),
        };
    }

    getRoundsAvailable() {
        return this._request({
            uri: '/rounds-available',
        });
    }
};
