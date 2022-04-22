const superagent = require('superagent');

function getOsuBackground(beatmapsetId) {
  const cacheKey = Math.floor(Date.now() / 1000);
  const url = `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/fullsize.jpg?${cacheKey}`;

  return superagent.get(url).then((response) => response.body);
}

module.exports = {
  getOsuBackground,
};
