#!/usr/bin/env node

const config = {...require('../info.json'), ...require('../config/config.json')};
const Forum = require('../forum');
const fs = require('fs');
const Gamemode = require('../lib/Gamemode');

const resultsPostTemplate = fs.readFileSync(`${__dirname}/../results-post-template.bbcode`).toString();

function textFromTemplate(template, vars = {}) {
    return template
        .replace(/<\?(.+?)\?>/gs, function (_, script) {
            let result = eval(script);

            return result === undefined || result === null ? '' : result;
        })
        .trim();
}

function mapResultsToText(beatmapset, passed) {
    const color = passed ? '#22DD22' : '#DD2222';

    return `[b][color=${color}]${beatmapset.result.percent}%[/color][/b] (${beatmapset.result.yes}:${beatmapset.result.no}) - ${beatmapset.title}`;
}

(async function () {
    console.log('Posting results');

    const mainTopics = await Forum.getModeTopics(120);

    for (let mode of Gamemode.modes().reverse()) {
        const mainPostId = await Forum.findFirstPostId(mainTopics[mode.integer]);
        let mainPost = await Forum.getPostContent(mainPostId);

        const passedBeatmapsets = [];
        const failedBeatmapsets = [];

        while (true) {
            const topicMatch = mainPost.match(/\[url=https:\/\/osu\.ppy\.sh\/community\/forums\/topics\/(\d+)\]Vote for this map here!/);

            if (topicMatch === null)
                break;

            const postId = await Forum.findFirstPostId(topicMatch[1]);
            const post = await Forum.getPostContent(postId);
            const pollResult = await Forum.getPollResult(topicMatch[1]);

            const beatmapset = {
                result: pollResult,
                title: post.split('\n')[2]
            };

            if (parseFloat(pollResult.percent) >= parseInt(config.threshold[mode.shortName]))
                passedBeatmapsets.push(beatmapset);
            else
                failedBeatmapsets.push(beatmapset);

            Forum.lockTopic(topicMatch[1]);
            Forum.watchTopic(topicMatch[1], false);

            mainPost = mainPost.substring(topicMatch.index + topicMatch[0].length);
        }

        await Forum.reply(mainTopics[mode.integer], textFromTemplate(resultsPostTemplate, {
            PASSED_BEATMAPSETS: passedBeatmapsets.map(b => mapResultsToText(b, true)).join('\n'),
            FAILED_BEATMAPSETS: failedBeatmapsets.map(b => mapResultsToText(b, false)).join('\n'),
            THRESHOLD: config.threshold[mode.shortName]
        }));

        Forum.pinTopic(mainTopics[mode.integer], false);
        Forum.lockTopic(mainTopics[mode.integer]);
        Forum.watchTopic(mainTopics[mode.integer], false);
    }
})();
