const { yellow } = require('chalk');
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
        const extraGameModeInfo = {};

        for (const gameMode of GameMode.modes()) {
            if (!round.game_modes[gameMode.integer].nominations_locked)
                console.error(yellow(`${gameMode.longName} nominations are not locked on loved.sh`));

            extraGameModeInfo[gameMode.integer] = {
                descriptionAuthors: [],
                nominators: [],
            };
        }

        for (const nomination of nominations) {
            // TODO: Should be done on website
            nomination.beatmapset_creators.sort((a, b) => {
                if (a.id === nomination.beatmapset.creator_id)
                    return -1;

                if (b.id === nomination.beatmapset.creator_id)
                    return 1;

                return a.name.localeCompare(b.name);
            });
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

            const extras = extraGameModeInfo[nomination.game_mode.integer];

            if (nomination.description_author != null && extras.descriptionAuthors.find((a) => a.id === nomination.description_author.id) == null)
                extras.descriptionAuthors.push(nomination.description_author);

            for (const nominator of nomination.nominators) {
                if (extras.nominators.find((n) => n.id === nominator.id) == null)
                    extras.nominators.push(nominator);
            }
        }

        return {
            allNominations: nominations,
            childNominations: nominations.filter((n) => n.parentId != null),
            extraGameModeInfo,
            intro: round.news_intro == null ? '' : round.news_intro,
            introPreview: round.news_intro_preview == null ? '' : round.news_intro_preview,
            nominations: nominations.filter((n) => n.parentId == null),
            outro: round.news_outro == null ? '' : round.news_outro,
            postTime: new Date(round.news_posted_at),
            title: `Project Loved: ${round.name}`,
        };
    }

    async getRoundsAvailable() {
        const response = await this._request.get(`${baseUrl}/rounds-available`);

        return response.body;
    }

    async updateBeatmapsets(roundId) {
        const response = await this._request
            .post(`${baseUrl}/update-beatmapsets`)
            .send({ roundId });

        return response.body;
    }
};
