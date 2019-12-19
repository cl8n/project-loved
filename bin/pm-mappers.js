const config = require('../resources/info.json');
const readline = require('readline');
const Forum = require('../src/forum');
const OsuApi = require('../src/osu-api');
const {readDocument} = require('../src/loved-document');

const late = process.argv.includes('--late', 2);

(async () => {
    if (late) {
        const interface = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        await new Promise(resolve => interface.question('Make sure to remove any maps that didn\'t pass voting from ../config/document.\nPress enter to continue...', () => {
            interface.close();
            resolve();
        }));
    }

    for (const nomination of Object.values(readDocument().nominations)) {
        const hasMetadataChanges = nomination.metadataEdits !== undefined;

        if (late && !hasMetadataChanges)
            continue;

        const apiBeatmap = OsuApi.getBeatmapset(nomination.id)[0];
        const message = late
            ? `Hello,\n\nYour beatmap, [url=https://osu.ppy.sh/beatmapsets/${nomination.id}]${apiBeatmap.artist} - ${apiBeatmap.title}[/url], was up for vote in [url=https://osu.ppy.sh/community/forums/120]Project Loved[/url].\n\nWe kindly request that you apply the following metadata changes to your beatmap before we move it to Loved:\n\n[quote="${nomination.metadataMessageAuthor}"]${nomination.metadataEdits}[/quote]\n\nThanks!`
            : `Hello,\n\nYour beatmap, [url=https://osu.ppy.sh/beatmapsets/${nomination.id}]${apiBeatmap.artist} - ${apiBeatmap.title}[/url], is going to be up for vote in next week's round of [url=https://osu.ppy.sh/community/forums/120]Project Loved[/url]. If your map receives over ${config.threshold[nomination.mode.shortName]} "Yes" votes by the time polls end, it can be moved to the Loved category!\n\n` + (hasMetadataChanges
                ? `However, we kindly request that you apply the following metadata changes before then:\n\n[quote="${nomination.metadataMessageAuthor}"]${nomination.metadataEdits}[/quote]\n\nAlso, if for any reason you [i]do not[/i] want your map to be put up for voting, please let me know ASAP.\n\nThanks!`
                : `If for any reason you [i]do not[/i] want your map to be put up for voting, please let me know ASAP.\n\nThanks!`
            );

        Forum.sendPm(
            hasMetadataChanges
                ? 'Project Loved: Changes required on your beatmap'
                : 'Project Loved: Your map will be up for voting soon!',
            hasMetadataChanges ? 'alert' : 'heart',
            message,
            [apiBeatmap.creator_id]
        );
    }
})();
