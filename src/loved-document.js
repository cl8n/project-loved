require('colors');
const path = require('path');
const {appendFileSync, readFileSync} = require('fs');
const Gamemode = require('./gamemode');
const Nomination = require('./nomination');

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

String.prototype.indexOfFirst = function (searches) {
    let index;

    for (let search of searches)
        if ((index = this.indexOf(search[0])) !== -1)
            return index + search[1];

    return -1;
}

module.exports.readDocument = function () {
    const logError = (shortMessage, longMessage) => {
        console.error((shortMessage + '\nSee error.log for more details.').red);

        const error = `> ${new Date()}\n> ${shortMessage}\n\n${longMessage}\n\n------------------------\n\n`;
        appendFileSync(path.join(__dirname, '../error.log'), error);

        process.exit();
    };

    let file = readFileSync(path.join(__dirname, '../config/document'), 'utf8');
    let noteMatch;

    file = file.replace(/\r\n/g, '\n');
    file = file.substring(file.match(/^News post$/m).index);

    const header = file.match(/^Header$(.+?)^Intro$/ms)[1].trim();
    const intro = file.match(/^Intro$(.+?)^Outro$/ms)[1].trim();
    const outro = file.match(/^Outro$(.+?)^osu!standard$/ms)[1].trim();

    file = file.substring(file.match(/^osu!standard$/m).index).trim();

    for (let mode of Gamemode.modes()) {
        file = file.substring(file.indexOf(`${mode.longName}\n`) + mode.longName.length);
        let data = (mode.integer === 3 ? file : file.substring(0, file.indexOf(`\n${new Gamemode(mode.integer + 1).longName}`))).trim();

        for (let position = 1; data.length > 0; position++) {
            const descriptionsMatch = [...data.matchAll(/^\d+\t/gm)];
            let description = '';

            if (descriptionsMatch.length === 0)
                logError(
                    'Invalid document format. Make sure each map starts with a beatmapset ID, then a tab',
                    `Occurred in ${mode.longName} portion of the document`
                );

            if (descriptionsMatch.length === 1) {
                description = data.trim();
                data = '';
            } else {
                description = data.substring(0, descriptionsMatch[1].index).trim();
                data = data.substring(descriptionsMatch[1].index);
            }

            const descriptionSplit = description.splitWithLeftOver('\n', 2);

            if (descriptionSplit.length !== 2)
                logError(
                    'Invalid description format. Expected at least 1 newline, got 0',
                    `Contents of descriptionSplit[0]:\n${descriptionSplit[0]}`
                );

            if (descriptionSplit[1].includes('\n\n'))
                logError(
                    'Invalid description format. Descriptions cannot contain double newlines',
                    `Contents of description:\n${description}`
                );

            let metadataSender;
            let metadataMessage;

            while ((noteMatch = descriptionSplit[1].match(/^(Noffy|hypercyte|eiri-|Video): /)) !== null) {
                let substringIndex;

                if (noteMatch[1] === 'Video')
                    substringIndex = descriptionSplit[1].indexOf('\n\\\n') + 3;
                else {
                    metadataSender = noteMatch[1];
                    metadataMessage = descriptionSplit[1].substring(
                        noteMatch[0].length,
                        substringIndex = descriptionSplit[1].indexOfFirst([
                            ['\nVideo: ', 1],
                            ['\n\\\n', 3]
                        ])
                    ).replace(/^[\n\\ ]+|[\n\\ ]+$/g, '');
                }

                descriptionSplit[1] = descriptionSplit[1].substring(substringIndex);
            }

            const infoSplit = descriptionSplit[0].split('\t');

            if (infoSplit.length < 4 || infoSplit.length > 5)
                logError(
                    `Invalid description info line format. Expected 3 or 4 tabs, got ${infoSplit.length - 1}`,
                    `Contents of descriptionSplit[0]:\n${descriptionSplit[0]}\n\nContents of description:\n${description}`
                );

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

    return {
        header: header,
        intro: intro,
        outro: outro,
        nominations: beatmaps
    };
}

module.exports.singleCaptain = function (mode) {
    let captain;

    for (let beatmap of Object.values(beatmaps)) {
        if (beatmap.mode.integer !== mode.integer)
            continue;

        if (captain === undefined) {
            captain = beatmap.captain;
            continue;
        }

        if (beatmap.captain !== captain)
            return null;
    }

    return captain === undefined ? null : captain;
}
