require('../src/force-color');
const { default: chalk } = require('chalk');
const { sendChatAnnouncement, setChatAccessToken, revokeChatAccessToken } = require('../src/chat');
const config = require('../src/config');
const { escapeMarkdown, joinList, loadTextResource, logAndExit, textFromTemplate, pushUnique } = require('../src/helpers');
const LovedWeb = require('../src/LovedWeb');

const guestTemplate = loadTextResource('chat-nomination-guest-template.md');
const hostTemplate = loadTextResource('chat-nomination-template.md');

async function sendNotifyPm(nominations, extraGameModeInfo, roundName) {
    if (nominations.length === 0)
        throw 'No nominations provided';

    const beatmapset = nominations[0].beatmapset;
    const creators = [];
    const excludedVersions = [];
    const gameModes = [];

    for (const nomination of nominations) {
        pushUnique(creators, nomination.beatmapset_creators, (a, b) => a.id === b.id);
        excludedVersions.push(
            ...nomination.beatmaps
                .filter((beatmap) => beatmap.excluded)
                .map((beatmap) => `[${beatmap.version}]`)
        );
        gameModes.push(nomination.game_mode);
    }

    gameModes.sort((a, b) => a.integer - b.integer);
    const gameModeVars = gameModes.length > 1
        ? {
            GAME_MODES: joinList(gameModes.map((m) => m.longName)),
            THRESHOLDS: gameModes.map((m) => `- ${m.longName}: **${extraGameModeInfo[m.integer].thresholdFormatted}**`).join('\n'),
        } : {
            GAME_MODE: gameModes[0].longName,
            THRESHOLD: extraGameModeInfo[gameModes[0].integer].thresholdFormatted,
        };
    const guestCreators = creators
        .filter((creator) => creator.id !== beatmapset.creator_id)
        .sort((a, b) => a.name.localeCompare(b.name));

    await sendChatAnnouncement(
        [beatmapset.creator_id],
        'Project Loved nomination',
        'Your map has been nominated for the next round of Project Loved!',
        textFromTemplate(hostTemplate, {
            ARTIST: escapeMarkdown(beatmapset.original_artist),
            BEATMAPSET_ID: beatmapset.id,
            EXCLUDED_DIFFS: excludedVersions.length > 0
                ? escapeMarkdown(joinList(excludedVersions))
                : null,
            GUESTS: guestCreators.length > 0
                ? joinList(guestCreators.map(
                    (c) => c.id >= 4294000000
                        ? escapeMarkdown(c.name)
                        : `[${escapeMarkdown(c.name)}](https://osu.ppy.sh/users/${c.id})`,
                ))
                : null,
            POLL_START: config.pollStartGuess,
            ROUND_NAME: roundName,
            TITLE: escapeMarkdown(beatmapset.original_title),
            ...gameModeVars,
        }),
    );

    const guestCreatorsToMessage = guestCreators.filter((creator) => {
        if (creator.banned || creator.id >= 4294000000) {
            console.error(chalk.yellow(`Skipping chat announcement to banned user ${creator.name}`));
            return false;
        }

        return true;
    });

    if (guestCreatorsToMessage.length > 0)
        await sendChatAnnouncement(
            guestCreatorsToMessage.map((user) => user.id),
            'Project Loved guest nomination',
            'Your guest map has been nominated for the next round of Project Loved!',
            textFromTemplate(guestTemplate, {
                ARTIST: escapeMarkdown(beatmapset.original_artist),
                BEATMAPSET_ID: beatmapset.id,
                ROUND_NAME: roundName,
                TITLE: escapeMarkdown(beatmapset.original_title),
            }),
        );
}

(async () => {
    const roundInfo = await new LovedWeb(config.lovedApiKey).getRoundInfo(config.lovedRoundId).catch(logAndExit);

    if (roundInfo.nominations.length === 0)
        return;

    await setChatAccessToken();

    for (const nomination of roundInfo.nominations)
        await sendNotifyPm(
            roundInfo.allNominations.filter((n) => n.beatmapset_id === nomination.beatmapset_id),
            roundInfo.extraGameModeInfo,
            roundInfo.name,
        );

    await revokeChatAccessToken();
})();
