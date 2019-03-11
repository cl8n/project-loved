const config = require('./config/config.json');
const syncRequest = require('sync-request');
const {writeFileSync} = require('fs');

let beatmapsetStorage;
try { beatmapsetStorage = require('./storage/beatmapsets.json') }
catch { beatmapsetStorage = {beatmapsets: {}} }

let userStorage;
try { userStorage = require('./storage/users.json') }
catch { userStorage = {users: {}, ids: {}} }

function osuApiRequestSync(endpoint, params) {
    let url = `https://osu.ppy.sh/api/${endpoint}?k=${config.osuApiKey}`;

    Object.keys(params).forEach(key => {
        url += `&${key}=${params[key]}`;
    });

    const response = syncRequest('GET', url);

    if (response.statusCode === 401) {
        throw 'Invalid osu!API key';
    }

    return JSON.parse(response.getBody());
}

exports.getBeatmapset = function (beatmapsetId) {
    if (beatmapsetStorage.beatmapsets[beatmapsetId] !== undefined)
        return beatmapsetStorage.beatmapsets[beatmapsetId];

    const result = osuApiRequestSync('get_beatmaps', {
        s: beatmapsetId
    });

    if (result.length === 0)
        throw `Beatmapset not found: ${beatmapsetId}`;

    beatmapsetStorage.beatmapsets[result[0].beatmapset_id] = result;

    writeFileSync('./storage/beatmapsets.json', JSON.stringify(beatmapsetStorage, null, 4));

    return result;
}

exports.getUser = function (userIdOrName, byName = false) {
    if (byName && userStorage.ids[userIdOrName] !== undefined)
        return userStorage.users[userStorage.ids[userIdOrName]];
    if (!byName && userStorage.users[userIdOrName] !== undefined)
        return userStorage.users[userIdOrName];

    const result = osuApiRequestSync('get_user', {
        u: userIdOrName,
        type: byName ? 'string' : 'id'
    });

    if (result.length === 0)
        throw `User not found: ${userIdOrName}`;

    // We will never need to work with events, and they take up a lot of space
    delete result[0].events;

    userStorage.users[result[0].user_id] = result[0];
    userStorage.ids[result[0].username] = result[0].user_id;

    writeFileSync('./storage/users.json', JSON.stringify(userStorage, null, 4));

    return result[0];
}
