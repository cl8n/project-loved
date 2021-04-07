const { writeFile } = require('fs').promises;
const path = require('path');
const superagent = require('superagent');
const config = require('./config');

let beatmapsetStorage;
try { beatmapsetStorage = require('../storage/beatmapsets.json') }
catch { beatmapsetStorage = {beatmapsets: {}} }

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

async function osuApiRequest(endpoint, params) {
    const response = await superagent
        .get(`https://osu.ppy.sh/api/${endpoint}`)
        .query({ ...params, k: config.osuApiKey })
        .ok((response) => response.status === 200 || response.status === 401);

    if (response.status === 401) {
        throw new Error('Invalid osu! API key');
    }

    return response.body;
}

module.exports.getBeatmapset = async function (beatmapsetId) {
    if (beatmapsetStorage.beatmapsets[beatmapsetId] != null)
        return clone(beatmapsetStorage.beatmapsets[beatmapsetId]);

    const result = await osuApiRequest('get_beatmaps', { s: beatmapsetId });

    if (result.length === 0)
        throw new Error(`Beatmapset not found: ${beatmapsetId}`);

    beatmapsetStorage.beatmapsets[result[0].beatmapset_id] = result;

    await writeFile(path.join(__dirname, '../storage/beatmapsets.json'), JSON.stringify(beatmapsetStorage, null, 4));

    return clone(result);
}
