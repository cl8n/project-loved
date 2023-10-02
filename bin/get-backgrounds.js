require('../src/force-color');
const { default: chalk } = require('chalk');
const { writeFile } = require('fs').promises;
const { join } = require('path');
const config = require('../src/config');
const { logAndExit } = require('../src/helpers');
const LovedWeb = require('../src/LovedWeb');
const { getOsuBackground } = require('../src/osu-background');

(async () => {
  const roundInfo = await new LovedWeb(config.lovedApiKey)
    .getRoundInfo(config.lovedRoundId)
    .catch(logAndExit);
  const beatmapsetIds = roundInfo.nominations.map((n) => n.beatmapset_id);
  const beatmapsetIdSet = new Set(beatmapsetIds);

  for (const beatmapsetId of beatmapsetIdSet) {
    getOsuBackground(beatmapsetId)
      .then((bgData) => {
        writeFile(join(__dirname, '../config', `${beatmapsetId}.jpg`), bgData);
      })
      .catch((error) => {
        if (typeof error === 'object' && (error.status === 403 || error.status === 404)) {
          console.error(chalk.yellow(`Beatmapset #${beatmapsetId} does not have a background`));
        } else {
          logAndExit(error);
        }
      });
  }
})();
