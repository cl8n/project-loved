const config = { ...require('../resources/info.json'), ...require('../config/config.json') };
const Forum = require('../src/forum');
const { join } = require('path');
const OsuApi = require('../src/osu-api');
const { readDocument } = require('../src/loved-document');
const { readFileSync } = require('fs');
const { joinList, textFromTemplate } = require('../src/helpers');

const guestTemplate = readFileSync(join(__dirname, '../resources/pm-guest-template.bbcode'), 'utf8');
const metadataTemplate = readFileSync(join(__dirname, '../resources/pm-metadata-template.bbcode'), 'utf8');
const hostTemplate = readFileSync(join(__dirname, '../resources/pm-template.bbcode'), 'utf8');

const metadataPm = process.argv.includes('--metadata', 2);

for (const nomination of Object.values(readDocument().nominations)) {
    const hasMetadataChanges = nomination.metadataEdits !== undefined;
    const apiBeatmap = OsuApi.getBeatmapset(nomination.id)[0];

    if (metadataPm) {
        if (hasMetadataChanges)
            Forum.sendPm(
                config.messages.pmMetadata,
                'alert',
                textFromTemplate(metadataTemplate, {
                    ARTIST: apiBeatmap.artist,
                    AUTHOR: nomination.metadataMessageAuthor,
                    BEATMAPSET_ID: nomination.id,
                    CHANGES: nomination.metadataEdits,
                    TITLE: apiBeatmap.title,
                }),
                [apiBeatmap.creator_id]
            );

        continue;
    }

    let guestCreators = nomination.creators.slice(1);

    if (guestCreators.length === 1 && guestCreators[0] === 'et al.')
        guestCreators = [];

    Forum.sendPm(
        config.messages.pmHost,
        'heart',
        textFromTemplate(hostTemplate, {
            ARTIST: apiBeatmap.artist,
            BEATMAPSET_ID: nomination.id,
            GUESTS: guestCreators.length === 0 ? null : joinList(guestCreators),
            MONTH: config.month,
            POLL_START: config.pollStartGuess,
            TITLE: apiBeatmap.title,
            THRESHOLD: config.threshold[nomination.mode.shortName],
        }),
        [apiBeatmap.creator_id]
    );

    for (const guest of guestCreators) {
        const user = OsuApi.getUser(guest, true);

        if (user.banned)
            continue;

        Forum.sendPm(
            config.messages.pmGuest,
            'heart',
            textFromTemplate(guestTemplate, {
                ARTIST: apiBeatmap.artist,
                BEATMAPSET_ID: nomination.id,
                MONTH: config.month,
                POLL_START: config.pollStartGuess,
                TITLE: apiBeatmap.title,
                THRESHOLD: config.threshold[nomination.mode.shortName],
            }),
            [user.user_id]
        );
    }
}
