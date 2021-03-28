const superagent = require('superagent');
const GameMode = require('./gamemode');

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

        for (const nomination of nominations) {
            // TODO: Should be done on website
            nomination.description = nomination.description == null ? '' :
                nomination.description
                    .trim()
                    .replace(/\r\n?/g, '\n')
                    .replace(/^ +| +$/gm, '')
                    .replace(/[‘’]/g, "'")
                    .replace(/[“”]/g, '"')
                    .replace(/…/g, '...')
                    .replace(/½/g, '1/2')
                    .replace(/⅓/g, '1/3')
                    .replace(/¼/g, '1/4')
                    .replace(/⅙/g, '1/6')
                    .replace(/⅛/g, '1/8')
                    .replace(/\b(\d+) ?k\b/gi, '$1K')
                    .replace(/\b(\d+) ?bpm\b/gi, '$1 BPM')
                    .replace(/o2jam/gi, 'O2Jam');
            nomination.game_mode = new GameMode(nomination.game_mode);
        }

        return {
            intro: round.news_intro == null ? '' : round.news_intro,
            introPreview: round.news_intro_preview == null ? '' : round.news_intro_preview,
            // TODO: does not exist on server yet
            //outro: round.news_outro == null ? '' : round.news_outro,
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
