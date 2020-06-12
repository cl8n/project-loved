const document = require('../src/loved-document').readDocument();
const open = require('open');

for (const beatmapsetId of Object.keys(document.nominations))
    open(`https://osu.ppy.sh/beatmapsets/${beatmapsetId}`);
