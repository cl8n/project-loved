const config = require('../resources/info.json');
const Forum = require('../src/forum');
const OsuApi = require('../src/osu-api');
const {readDocument} = require('../src/loved-document');

Object.values(readDocument().nominations).forEach(nomination => {
    const hasMetadataChanges = nomination.metadataEdits !== undefined;
    const apiBeatmap = OsuApi.getBeatmapset(nomination.id)[0];
    const message = hasMetadataChanges
        ? `Hello,\n\nYour beatmap, [url=https://osu.ppy.sh/beatmapsets/${nomination.id}]${apiBeatmap.artist} - ${apiBeatmap.title}[/url], is going to be up for vote in next week's round of [url=https://osu.ppy.sh/community/forums/120]Project Loved[/url]. If your map receives over ${config.threshold[nomination.mode.shortName]} "Yes" votes by the time polls end, it can be moved to the Loved category!\n\nHowever, we kindly request that you apply the following metadata changes before then:\n\n[quote="${nomination.metadataMessageAuthor}"]${nomination.metadataEdits}[/quote]\n\nAlso, if for any reason you [i]do not[/i] want your map to be put up for voting, please let me know ASAP.\n\nThanks!`
        : `Hello,\n\nYour beatmap, [url=https://osu.ppy.sh/beatmapsets/${nomination.id}]${apiBeatmap.artist} - ${apiBeatmap.title}[/url], is going to be up for vote in next week's round of [url=https://osu.ppy.sh/community/forums/120]Project Loved[/url]. If your map receives over ${config.threshold[nomination.mode.shortName]} "Yes" votes by the time polls end, it can be moved to the Loved category!\n\nIf for any reason you [i]do not[/i] want your map to be put up for voting, please let me know ASAP.\n\nThanks!`;

    Forum.sendPm(
        hasMetadataChanges
            ? 'Project Loved: Changes required on your beatmap'
            : 'Project Loved: Your map will be up for voting soon!',
        hasMetadataChanges ? 'alert' : 'heart',
        message,
        [apiBeatmap.creator_id]
    );
});
