require('colors');
const fs = require('fs');
const Forum = require('../src/forum');
const Gamemode = require('../src/gamemode');
const path = require('path');

const pollData = [
    // This poll's online stats are misleading due to a brigade done by banned
    // accounts. peppy decided that this is the most accurate result instead.
    {
        beatmapset: 339222,
        yes_count: 504,
        no_count: 127,
    },
];
const topicsCachePath = path.join(__dirname, '../storage/topics-cache.json');
const topicsCache = fs.existsSync(topicsCachePath)
    ? JSON.parse(fs.readFileSync(topicsCachePath, 'utf8'))
    : {};
const useCacheOnly = process.argv.includes('--cache-only', 2);

function cacheTopic(id, content) {
    topicsCache[id] = content;
    fs.writeFileSync(topicsCachePath, JSON.stringify(topicsCache));
}

(async function () {
    const topics = useCacheOnly ? Object.keys(topicsCache) : await Forum.getTopics(120);
    const polls = [];

    for (let topicId of topics) {
        let topic = topicsCache[topicId];
        let topicFresh = false;

        if (topic === undefined) {
            console.log(`Fetching topic #${topicId}`);
            topic = await Forum.getTopic(topicId);
            topicFresh = true;
        }

        const titleMatch = topic.match(/<h1\s+class="forum-topic-title__title[^>]+?>\s*(.*?)\s*<\/h1>/);

        if (titleMatch === null) {
            console.error(`Topic #${topicId} exploded`.red);
            continue;
        }

        if (topicFresh)
            cacheTopic(topicId, topic);

        const title = titleMatch[1];

        if (topic.match(/js-forum-post--hidden[^>]+?data-post-position="0"/) !== null) {
            console.log(`Skipping deleted topic "${title}" (#${topicId})`.yellow);
            continue;
        }

        // Sanity check to make sure we're viewing a completed poll
        if (topic.indexOf('Polling ended ') === -1) {
            console.log(`Skipping non-poll topic "${title}" (#${topicId})`.yellow);
            continue;
        }

        const gameModeMatch = title.match(/^\[([a-z!]+)\]/);

        if (gameModeMatch === null) {
            console.error(`Couldn't find game mode for topic "${title}" (#${topicId})`.red);
            continue;
        }

        const mode = new Gamemode(gameModeMatch[1]);
        topic = topic.substring(gameModeMatch.index + gameModeMatch[0].length);

        if (topic.match(/<div class="forum-poll-row__result forum-poll-row__result--total">/g).length !== 2) {
            console.log(`Skipping poll with more than 2 options "${title}" (#${topicId})`.yellow)
            continue;
        }

        const beatmapset = parseInt(topic.match(/https?:\/\/osu\.ppy\.sh\/(?:beatmapset)?s\/(\d+)/)[1]);
        const pollMatch = pollData.find(p => p.beatmapset === beatmapset);
        const voteCounts = [];

        if (pollMatch === undefined) {
            for (let i = 0; i < 2; i++) {
                const match = topic.match(/<div class="forum-poll-row__result forum-poll-row__result--total">\s*([\d,]+)\s*<\/div>/);
                voteCounts.push(parseInt(match[1].replace(/,/g, '')));
                topic = topic.substring(match.index + match[0].length);
            }
        } else {
            voteCounts[0] = pollMatch.yes_count;
            voteCounts[1] = pollMatch.no_count;
        }

        const endTimeMatch = topic.match(/Polling ended\s+<time[^>]+?datetime='(.+?)'/);

        if (endTimeMatch === null) {
            console.error(`Couldn't find poll end time for topic "${title}" (#${topicId})`.red);
            continue;
        }

        polls.push({
            beatmapset: beatmapset,
            topic: parseInt(topicId),
            topic_title: title,
            yes_count: voteCounts[0],
            no_count: voteCounts[1],
            mode: mode.integer,
            poll_end: endTimeMatch[1],
        });
    }

    const sortedPolls = polls.sort((a, b) => a.poll_end.localeCompare(b.poll_end));
    let lastDate = Date.parse(sortedPolls[0].poll_end);
    let round = 1;
    let tsv = [
        'Round',
        'Poll end time',
        'Game mode',
        'Beatmapset ID',
        'Topic ID',
        'Yes',
        'No',
        'Topic title',
    ].join('\t') + '\n';

    for (const poll of sortedPolls) {
        const date = Date.parse(poll.poll_end);

        if (date - lastDate > 86400000) // 1 day
            round++;

        lastDate = date;
        tsv += [
            round,
            poll.poll_end,
            poll.mode,
            poll.beatmapset,
            poll.topic,
            poll.yes_count,
            poll.no_count,
            poll.topic_title,
        ].join('\t') + '\n';
    }

    if (!fs.existsSync(path.join(__dirname, '../output')))
        fs.mkdirSync(path.join(__dirname, '../output'));

    fs.writeFileSync(path.join(__dirname, '../output/poll-stats.tsv'), tsv);
})();
