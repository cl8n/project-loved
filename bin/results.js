// TODO complete polls on loved.sh
console.error('ask clayton to fix this before using it');
process.exit(1);

const { yellow } = require('chalk');
const config = require('../src/config');
const Discord = require('../src/discord');
const Forum = require('../src/forum');
const Gamemode = require('../src/gamemode');
const { loadTextResource, textFromTemplate } = require('../src/helpers');
const LovedWeb = require('../src/LovedWeb');

const keepWatches = process.argv.includes('--keep-watches', 2);
const resultsPostTemplate = loadTextResource('results-post-template.bbcode');

function mapResultsToText(beatmapset, passed) {
    const color = passed ? '#22DD22' : '#DD2222';

    return `[b][color=${color}]${beatmapset.result.percent}%[/color][/b] (${beatmapset.result.yes}:${beatmapset.result.no}) - ${beatmapset.title}`;
}

function mapResultsToEmbed(beatmapset, passed) {
    return {
        color: passed ? 2284834 : 14492194,
        description: `${beatmapset.result.percent}% - ${beatmapset.result.yes}:${beatmapset.result.no}`,
        title: beatmapset.title
            .replace(/\[\/?url(?:=.+?)?\]/g, '')
            .replace(/\\/g, '\\\\')
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_')
            .replace(/\[b\](.+?)\[\/b\]/g, '**$1**'),
        url: beatmapset.title.match(/\[url=(https:\/\/osu\.ppy\.sh\/beatmapsets\/[a-z0-9#]+)\]/)[1],
    }
}

(async function () {
    console.log('Posting results');

    const lovedWeb = new LovedWeb(config.lovedApiKey);
    const { discordWebhooks, extraGameModeInfo } = await lovedWeb.getRoundInfo(config.lovedRoundId);
    const mainTopics = await Forum.getModeTopics(120);
    const mainTopicsReplies = {};

    for (const mode of Gamemode.modes().reverse()) {
        if (mainTopics[mode.integer] == null) {
            console.error(yellow(`Skipping ${mode.longName}, no main topic found`));
            continue;
        }

        const extraInfo = extraGameModeInfo[mode.integer];
        const mainPostId = await Forum.findFirstPostId(mainTopics[mode.integer]);
        let mainPost = await Forum.getPostContent(mainPostId);

        const beatmapsets = [];

        while (true) {
            const topicMatch = mainPost.match(/\[url=https:\/\/osu\.ppy\.sh\/community\/forums\/topics\/(\d+)\]Vote for this map here!/);

            if (topicMatch == null)
                break;

            const postId = await Forum.findFirstPostId(topicMatch[1]);
            const post = await Forum.getPostContent(postId);
            const pollResult = await Forum.getPollResult(topicMatch[1]);
            const postLineEnding = post.includes('\r\n') ? '\r\n' : '\n';

            beatmapsets.push({
                passed: parseFloat(pollResult.percent) >= extraInfo.threshold * 100,
                result: pollResult,
                title: post.split(postLineEnding)[2],
                topicId: topicMatch[1]
            });

            Forum.lockTopic(topicMatch[1]);

            if (!keepWatches)
                Forum.watchTopic(topicMatch[1], false);

            mainPost = mainPost.substring(topicMatch.index + topicMatch[0].length);
        }

        for (const beatmapset of beatmapsets.slice().reverse()) {
            const replyContent = beatmapset.passed ? config.messages.resultsPassed : config.messages.resultsFailed;
            await Forum.reply(beatmapset.topicId, replyContent);
        }

        const passedBeatmapsets = beatmapsets.filter(b => b.passed);
        const failedBeatmapsets = beatmapsets.filter(b => !b.passed);

        mainTopicsReplies[mode.integer] = textFromTemplate(resultsPostTemplate, {
            PASSED_BEATMAPSETS: passedBeatmapsets.map(b => mapResultsToText(b, true)).join('\n'),
            FAILED_BEATMAPSETS: failedBeatmapsets.map(b => mapResultsToText(b, false)).join('\n'),
            THRESHOLD: extraInfo.thresholdFormatted,
        });

        Forum.lockTopic(mainTopics[mode.integer]);

        if (!keepWatches)
            Forum.watchTopic(mainTopics[mode.integer], false);

        if (discordWebhooks[mode.integer] != null)
            new Discord(discordWebhooks[mode.integer]).post(
                `Project Loved: ${mode.longName}`,
                config.messages.discordResults,
                passedBeatmapsets.map(b => mapResultsToEmbed(b, true))
                    .concat(failedBeatmapsets.map(b => mapResultsToEmbed(b, false)))
            );
    }

    const replyIdsByGamemode = {};

    for (const mode of Gamemode.modes().reverse()) {
        if (mainTopics[mode.integer] == null)
            continue;

        Forum.pinTopic(mainTopics[mode.integer], false);

        replyIdsByGamemode[mode.integer] = await Forum.reply(mainTopics[mode.integer], mainTopicsReplies[mode.integer]);
    }

    console.log('Submitting results posts to loved.sh');

    await lovedWeb.updateResultsPosts(config.lovedRoundId, replyIdsByGamemode);
})();
