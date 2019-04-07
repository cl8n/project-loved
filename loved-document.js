const {readFileSync} = require('fs');
const Gamemode = require('./lib/Gamemode');
const Nomination = require('./lib/Nomination');

const beatmaps = {};

module.exports.readDocuments = function () {
    for (let mode of Gamemode.modes()) {
        let data = readFileSync(`./config/document-${mode.shortName}`, 'utf8').trim();

        for (let position = 1; data.length > 0; position++) {
            const split = data.split('\n\n', 2);
            data = split[1].trim();

            const description = split[0];
            const descriptionSplit = description.split('\n', 2);

            // osu!catch captains like to put notes after a pipe behind the beatmap info
            if (descriptionSplit[0].includes(' | '))
                descriptionSplit[0] = descriptionSplit[0].substring(0, descriptionSplit[0].indexOf(' | '));

            // osu!mania captains like to put notes in parenthesis below the beatmap info
            if (descriptionSplit[1].startsWith('('))
                descriptionSplit[1] = descriptionSplit[1].substring(descriptionSplit[1].indexOf('\n') + 1);

            const infoSplit = descriptionSplit[0].split('\t');
            const titleSplit = infoSplit[1].split(' - ', 2);
            const nomination = new Nomination({
                mode: mode,
                position: position,
                id: infoSplit[0],
                artist: titleSplit[0],
                title: titleSplit[1],
                creators: infoSplit[2],
                captain: infoSplit[3],
                description: descriptionSplit[1]
            });

            if (infoSplit.length > 4)
                nomination.excludedBeatmaps = infoSplit[4];

            beatmaps[nomination.id] = nomination;
        }
    }

    return beatmaps;
}

module.exports.singleCaptain = function (mode) {
    let captain;

    for (let beatmap of Object.values(beatmaps)) {
        if (beatmap.mode.integer !== mode.integer) {
            continue;
        }

        if (captain === undefined) {
            captain = beatmap.captain;
            continue;
        }

        if (beatmap.captain !== captain) {
            return null;
        }
    }

    return captain === undefined ? null : captain;
}
