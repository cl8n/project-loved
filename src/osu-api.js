const { writeFileSync } = require('fs');
const path = require('path');
const syncRequest = require('sync-request');
const config = require('./config');

let beatmapsetStorage;
try { beatmapsetStorage = require('../storage/beatmapsets.json') }
catch { beatmapsetStorage = {beatmapsets: {}} }

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function osuApiRequestSync(endpoint, params) {
    let url = `https://osu.ppy.sh/api/${endpoint}?k=${config.osuApiKey}`;

    Object.keys(params).forEach(key => {
        url += `&${key}=${params[key]}`;
    });

    const response = syncRequest('GET', url);

    if (response.statusCode === 401)
        throw new Error('Invalid osu! API key');

    return JSON.parse(response.getBody());
}

module.exports.getBeatmapset = function (beatmapsetId) {
    if (beatmapsetStorage.beatmapsets[beatmapsetId] != null)
        return clone(beatmapsetStorage.beatmapsets[beatmapsetId]);

    const result = osuApiRequestSync('get_beatmaps', {
        s: beatmapsetId
    });

    if (result.length === 0)
        throw new Error(`Beatmapset not found: ${beatmapsetId}`);

    beatmapsetStorage.beatmapsets[result[0].beatmapset_id] = result;

    writeFileSync(path.join(__dirname, '../storage/beatmapsets.json'), JSON.stringify(beatmapsetStorage, null, 4));

    return clone(result);
}
