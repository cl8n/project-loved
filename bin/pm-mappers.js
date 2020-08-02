const config = { ...require('../resources/info.json'), ...require('../config/config.json') };
const Forum = require('../src/forum');
const { join } = require('path');
const OsuApi = require('../src/osu-api');
const { readDocument } = require('../src/loved-document');
const { readFileSync } = require('fs');
const metadataTemplate = readFileSync(join(__dirname, '../resources/metadata-template.bbcode'), 'utf8');
const { textFromTemplate } = require('../src/helpers');

for (const nomination of Object.values(readDocument().nominations)) {
    const hasMetadataChanges = nomination.metadataEdits !== undefined;
    const apiBeatmap = OsuApi.getBeatmapset(nomination.id)[0];

    Forum.sendPm(
        hasMetadataChanges
            ? config.messages.pmMetadata
            : config.messages.pmHost,
        hasMetadataChanges ? 'alert' : 'heart',
        textFromTemplate(metadataTemplate, {
            ARTIST: apiBeatmap.artist,
            BEATMAPSET_ID: nomination.id,
            METADATA_AUTHOR: nomination.metadataMessageAuthor,
            METADATA_CHANGES: nomination.metadataEdits,
            MONTH: config.month,
            TITLE: apiBeatmap.title,
            THRESHOLD: config.threshold[nomination.mode.shortName]
        }),
        [apiBeatmap.creator_id]
    );
}
