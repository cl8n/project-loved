// TODO polls are added alongside forum posts now, but need to be completed in results.js
console.error('ask clayton to fix this before using it');
process.exit(1);

const { red, yellow } = require('chalk');
const config = require('../src/config');
const Forum = require('../src/forum');
const Gamemode = require('../src/gamemode');
const LovedWeb = require('../src/LovedWeb');

(async function () {
    const lovedWeb = new LovedWeb(config.lovedApiKey);
    const lastPoll = await lovedWeb.getLastPollResult();
    const newTopicIds = await Forum.getTopics(120, lastPoll.topic_id);
    const results = [];

    for (const topicId of newTopicIds) {
        let topic = await Forum.getTopic(topicId);
        const titleMatch = topic.match(/<h1\s+class="forum-topic-title__title[^>]+?>\s*(.*?)\s*<\/h1>/);

        if (titleMatch == null) {
            console.error(red(`Couldn't parse topic #${topicId}`));
            continue;
        }

        const title = titleMatch[1];

        if (topic.match(/js-forum-post--hidden[^>]+?data-post-position="0"/) != null) {
            console.log(yellow(`Skipping deleted topic "${title}" (#${topicId})`));
            continue;
        }

        if (topic.indexOf('<div class="forum-poll">') === -1) {
            console.log(yellow(`Skipping non-poll topic "${title}" (#${topicId})`));
            continue;
        }

        const endTimeMatch = topic.match(/Polling ended\s+<time[^>]+?datetime='(.+?)'/);

        if (endTimeMatch == null) {
            console.log(yellow(`Skipping incomplete poll topic "${title}" (#${topicId})`));
            continue;
        }

        const gameModeMatch = title.match(/^\[(osu![a-z]*)\]/);

        if (gameModeMatch == null) {
            console.error(red(`Couldn't find game mode for topic "${title}" (#${topicId})`));
            continue;
        }

        topic = topic.substring(gameModeMatch.index + gameModeMatch[0].length);

        if (topic.match(/<div class="forum-poll-row__result forum-poll-row__result--total">/g).length !== 2) {
            console.log(yellow(`Skipping poll with more than 2 options "${title}" (#${topicId})`));
            continue;
        }

        const beatmapsetId = parseInt(topic.match(/https?:\/\/osu\.ppy\.sh\/beatmapsets\/(\d+)/)[1]);
        const voteCounts = [];

        for (let i = 0; i < 2; i++) {
            const match = topic.match(/<div class="forum-poll-row__result forum-poll-row__result--total">\s*([\d,]+)\s*<\/div>/);
            voteCounts.push(parseInt(match[1].replace(/,/g, '')));
            topic = topic.substring(match.index + match[0].length);
        }

        results.push({
            beatmapsetId,
            endedAt: new Date(endTimeMatch[1]),
            gameMode: new Gamemode(gameModeMatch[1]).integer,
            no: voteCounts[1],
            yes: voteCounts[0],
            topicId,
        });
    }

    if (results.length === 0) {
        console.log('No new poll results to add');
        return;
    }

    results.sort((a, b) => a.endedAt - b.endedAt);

    let lastEndedAt = results[0].endedAt;
    let round = lastPoll.round_id + 1;

    for (const result of results) {
        if (result.endedAt - lastEndedAt > 86400000) // 1 day
            round++;

        lastEndedAt = result.endedAt;
        result.roundId = round;
    }

    console.log('Adding new poll results to loved.sh');

    await lovedWeb.updatePollResults(results);
})();
