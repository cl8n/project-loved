const config = require('../src/config');
const Forum = require('../src/forum');
const GameMode = require('../src/gamemode');
const { joinList, loadTextResource, textFromTemplate, pushUnique } = require('../src/helpers');
const LovedWeb = require('../src/LovedWeb');

const guestTemplate = loadTextResource('pm-guest-template.bbcode');
const metadataTemplate = loadTextResource('pm-metadata-template.bbcode');
const hostTemplate = loadTextResource('pm-template.bbcode');

const metadataPm = process.argv.includes('--metadata', 2);

// TODO: Use new chat
function sendMetadataPm(nomination) {
    // TODO: Track maps which have already had this message sent
    if (nomination.metadata_state !== 1)
        return;

    Forum.sendPm(
        config.messages.pmMetadata,
        'alert',
        textFromTemplate(metadataTemplate, {
            ARTIST: nomination.beatmapset.artist,
            AUTHOR: nomination.metadata_assignee.name,
            AUTHOR_ID: nomination.metadata_assignee.id,
            BEATMAPSET_ID: nomination.beatmapset.id,
            TITLE: nomination.beatmapset.title,
        }),
        [nomination.beatmapset.creator_id],
    );
}

// TODO: Use new chat
function sendNotifyPm(nominations) {
    if (nominations.length === 0)
        throw 'No nominations provided';

    const beatmapset = nominations[0].beatmapset;
    const creators = [];
    const excludedVersions = [];
    const gameModes = [];

    for (const nomination of nominations) {
        pushUnique(creators, nomination.beatmapset_creators, (a, b) => a.id === b.id);
        excludedVersions.push(
            nomination.beatmaps
                .filter((beatmap) => beatmap.excluded)
                .map((beatmap) => `[${beatmap.version}]`)
        );
        gameModes.push(new GameMode(nomination.game_mode));
    }

    gameModes.sort((a, b) => a.integer - b.integer);
    const gameModeVars = gameModes.length > 1
        ? {
            GAME_MODES: joinList(gameModes.map((m) => m.longName)),
            THRESHOLDS: `[list]${gameModes.map((m) => `[*]${m.longName}: ${config.threshold[m.shortName]}`)}[/list]`,
        } : {
            GAME_MODE: gameModes[0].longName,
            THRESHOLD: config.threshold[gameModes[0].shortName],
        };
    const guestCreators = creators
        .filter((creator) => creator.id !== beatmapset.creator_id)
        .sort((a, b) => a.localeCompare(b));

    Forum.sendPm(
        config.messages.pmHost,
        'heart',
        textFromTemplate(hostTemplate, {
            ARTIST: beatmapset.artist,
            BEATMAPSET_ID: beatmapset.id,
            EXCLUDED_DIFFS: excludedVersions.length > 0 ? joinList(excludedVersions) : null,
            GUESTS: guestCreators.length > 0 ? joinList(guestCreators) : null,
            MONTH: config.month,
            POLL_START: config.pollStartGuess,
            TITLE: beatmapset.title,
            ...gameModeVars,
        }),
        [beatmapset.creator_id],
    );

    for (const guest of guestCreators) {
        if (guest.banned)
            continue;

        Forum.sendPm(
            config.messages.pmGuest,
            'heart',
            textFromTemplate(guestTemplate, {
                ARTIST: beatmapset.artist,
                BEATMAPSET_ID: beatmapset.id,
                MONTH: config.month,
                TITLE: beatmapset.title,
            }),
            [guest.id],
        );
    }
}

(async () => {
    const roundInfo = await new LovedWeb(config.lovedApiKey).getRoundInfo(config.lovedRoundId);

    for (const nomination of roundInfo.nominations)
        if (metadataPm)
            sendMetadataPm(nomination);
        else
            sendNotifyPm(
                roundInfo.allNominations
                    .filter((n) => n.beatmapset_id === nomination.beatmapset_id)
            );
})();
