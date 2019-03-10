const fs = require('fs');

const MODES = ['osu', 'taiko', 'catch', 'mania'];

const DESCRIPTION_REGEX = /^(\d+)\t(.+?) - (.+?)\t([-_,. \[\]a-z0-9]+)\t([-_,. \[\]a-z0-9]+)\t((?:.|(?:\r|\n|\r\n){2})+?)$(?:\r|\n|\r\n)?/im;

const beatmaps = {};

exports.readSheets = function () {
    for (let mode of MODES) {
        let data = fs.readFileSync(`./config/spreadsheet-${mode}.tsv`, 'utf8').trim();
        let position = 0;

        while (data.length > 0) {
            const matches = DESCRIPTION_REGEX.exec(data);

            // TODO: Should not be necessary
            if (matches === null) {
                break;
            }

            beatmaps[matches[1]] = {
                position: position,
                id: matches[1],
                mode: mode,
                filename: `${matches[3].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^\-|\-$/g, '')}.jpg`,
                artist: matches[2],
                title: matches[3],
                creators: matches[4].split(','),
                captain: matches[5],
                description: matches[6].replace(/\\n/g, '\n\n')
            };

            data = data.slice(matches[0].length);
            position++;
        }
    }

    return beatmaps;
}

exports.singleCaptain = function (mode) {
    let captain;

    for (let beatmap of Object.values(beatmaps)) {
        if (beatmap.mode !== mode) {
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
