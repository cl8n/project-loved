require('../src/force-color');
const { default: open } = require('open');
const config = require('../src/config');
const { logAndExit } = require('../src/helpers');
const LovedWeb = require('../src/LovedWeb');

(async () => {
  const roundInfo = await new LovedWeb(config.lovedApiKey).getRoundInfo(config.lovedRoundId).catch(logAndExit);
  const beatmapsetIds = roundInfo.nominations.map((n) => n.beatmapset_id);
  const beatmapsetIdSet = new Set(beatmapsetIds);

  for (const beatmapsetId of beatmapsetIdSet)
    await open(`https://osu.ppy.sh/beatmapsets/${beatmapsetId}`);
})();
