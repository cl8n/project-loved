const fs = require('fs');
const Forum = require('../src/forum');
const Gamemode = require('../src/gamemode');
const path = require('path');

const POLL_DATA = [
    // This poll's online stats are misleading due to a brigade done by banned
    // accounts. peppy decided that this is the most accurate result instead.
    {
        beatmapset: 339222,
        yes_count: 504,
        no_count: 127
    }
];

(async function () {
    const topics = await Forum.getTopics(120);
    const polls = [];

    for (let topicId of topics) {
        let topic = await Forum.getTopic(topicId);

        // Sanity check to make sure we're viewing a completed poll
        if (topic.indexOf('Polling ended ') === -1)
            continue;

        const titleGameModeMatch = topic.match(/js-forum-topic-title--title">\n\s*\[([a-z!]+)\]/);

        if (titleGameModeMatch === null)
            continue;

        topic = topic.substring(titleGameModeMatch.index + titleGameModeMatch[0].length);

        if (topic.match(/<tr class="forum-poll-row /g).length !== 2)
            continue;

        const beatmapset = parseInt(topic.match(/https?:\/\/osu\.ppy\.sh\/(?:beatmapset)?s\/(\d+)/)[1]);
        const mode = new Gamemode(titleGameModeMatch[1]);
        const pollMatch = POLL_DATA.find(p => p.beatmapset === beatmapset);
        const voteCounts = [];

        if (pollMatch === undefined)
            for (let i = 0; i < 2; i++) {
                const match = topic.match(/<td class="forum-poll-row__column">\n\s*(\d+)\n\s*<\/td>/);
                voteCounts.push(parseInt(match[1]));
                topic = topic.substring(match.index + match[0].length);
            }
        else {
            voteCounts[0] = pollMatch.yes_count;
            voteCounts[1] = pollMatch.no_count;
        }

        polls.push({
            beatmapset: beatmapset,
            topic: parseInt(topicId),
            yes_count: voteCounts[0],
            no_count: voteCounts[1],
            mode: mode.integer,
            poll_end: topic.match(/Polling ended (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)[1]
        });
    }

    if (!fs.existsSync(path.join(__dirname, '../output')))
        fs.mkdirSync(path.join(__dirname, '../output'));

    fs.writeFileSync(path.join(__dirname, '../output/poll-info.json'), JSON.stringify(polls));
})();
