const fs = require('fs');
const Forum = require('./forum.js');

function convertMode(mode) {
    switch (mode) {
        case 'osu!standard':
        case 'osu!std':
            return 'osu!';
        case 'osu!taiko':
            return 'osu!taiko';
        case 'osu!catch':
        case 'osu!ctb':
            return 'osu!catch';
        case 'osu!mania':
            return 'osu!mania';
    }

    return null;
}

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

        const mode = convertMode(titleGameModeMatch[1]);
        topic = topic.substring(titleGameModeMatch.index + titleGameModeMatch[0].length);

        if (topic.match(/<tr class="forum-poll-row /g).length !== 2)
            continue;

        const voteCounts = [];

        for (let i = 0; i < 2; i++) {
            const match = topic.match(/<td class="forum-poll-row__column">\n\s*(\d+)\n\s*<\/td>/);
            voteCounts.push(parseInt(match[1]));
            topic = topic.substring(match.index + match[0].length);
        }

        polls.push({
            beatmapset: topic.match(/https?:\/\/osu\.ppy\.sh\/(?:beatmapset)?s\/(\d+)/)[1],
            topic: topicId,
            yes_count: voteCounts[0],
            no_count: voteCounts[1],
            mode: mode,
            poll_end: topic.match(/Polling ended (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)[1]
        });
    }

    if (!fs.existsSync('./output'))
        fs.mkdirSync('./output');
    fs.writeFileSync('./output/poll-info.json', JSON.stringify(polls));
})();
