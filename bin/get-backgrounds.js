#!/usr/bin/env node

import '../src/force-color.js';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import config from '../src/config.js';
import { logAndExit } from '../src/helpers.js';
import LovedWeb from '../src/LovedWeb.js';
import { getOsuBackground } from '../src/osu-background.js';

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
