const { writeFileSync } = require('fs');
const path = require('path');
const syncRequest = require('sync-request');
const config = require('./config');

let beatmapsetStorage;
try { beatmapsetStorage = require('../storage/beatmapsets.json') }
catch { beatmapsetStorage = {beatmapsets: {}} }

let userStorage;
try { userStorage = require('../storage/users.json') }
catch { userStorage = {users: {}, ids: {}} }

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

module.exports.getUser = function (userIdOrName, byName = false) {
    if (byName && userStorage.ids[userIdOrName] != null)
        return clone(userStorage.users[userStorage.ids[userIdOrName]]);
    if (!byName && userStorage.users[userIdOrName] != null)
        return clone(userStorage.users[userIdOrName]);

    const result = osuApiRequestSync('get_user', {
        u: userIdOrName,
        type: byName ? 'string' : 'id'
    });

    if (result.length === 0)
        throw new Error(`User not found: ${userIdOrName}`);

    // We will never need to work with events, and they take up a lot of space
    delete result[0].events;

    userStorage.users[result[0].user_id] = result[0];
    userStorage.ids[result[0].username] = result[0].user_id;

    writeFileSync(path.join(__dirname, '../storage/users.json'), JSON.stringify(userStorage, null, 4));

    return clone(result[0]);
}
