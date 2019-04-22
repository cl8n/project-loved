const {readFileSync} = require('fs');
const Gamemode = require('./lib/Gamemode');
const Nomination = require('./lib/Nomination');

const beatmaps = {};

String.prototype.splitWithLeftOver = function (separator, limit) {
    if (limit <= 1)
        return [this];

    const split = this.split(separator, limit);

    if (split.length === limit) {
        let index = 0;
        let n = limit;

        while (--n) {
            index = this.indexOf(separator, index);
        }

        split[limit - 1] = this.substring(index + separator.length);
    }

    return split;
};

String.prototype.indexOfFirst = function (searchStrings) {
    let index;

    for (let search of searchStrings)
        if ((index = this.indexOf(search)) !== -1)
            return index;

    return -1;
}

module.exports.readDocuments = function () {
    let file = readFileSync('./config/document', 'utf8').trim();
    let noteMatch;

    for (let mode of Gamemode.modes()) {
        file = file.substring(file.indexOf(mode.longName) + mode.longName.length);
        let data = (mode.integer === 3 ? file : file.substring(0, file.indexOf(`\n${new Gamemode(mode.integer + 1).longName}`))).trim();

        for (let position = 1; data.length > 0; position++) {
            const split = data.splitWithLeftOver('\n\n', 2);
            data = split.length === 2 ? split[1].trim() : '';

            const description = split[0];
            const descriptionSplit = description.splitWithLeftOver('\n', 2);

            let metadataSender;
            let metadataMessage;

            while ((noteMatch = descriptionSplit[1].match(/^([-_a-z0-9\[\] ]+): /i)) !== null) {
                let substringIndex;

                if (noteMatch[1] === 'Video')
                    substringIndex = descriptionSplit[1].indexOf('\n\n') + 2;
                else {
                    metadataSender = noteMatch[1];
                    metadataMessage = descriptionSplit[1].substring(
                        noteMatch[0].length,
                        substringIndex = descriptionSplit[1].indexOfFirst(['Video: ', '\n\n'])
                    );
                }

                descriptionSplit[1] = descriptionSplit[1].substring(substringIndex);
            }

            const infoSplit = descriptionSplit[0].split('\t');
            const titleSplit = infoSplit[1].splitWithLeftOver(' - ', 2);
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

            if (metadataSender !== undefined && metadataMessage !== undefined) {
                nomination.metadataMessageAuthor = metadataSender;
                nomination.metadataEdits = metadataMessage;
            }

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
