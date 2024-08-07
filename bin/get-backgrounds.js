#!/usr/bin/env node

import '../src/force-color.js';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import superagent from 'superagent';
import LovedWeb from '../src/LovedWeb.js';
import config from '../src/config.js';
import { logAndExit } from '../src/helpers.js';
import tryUpdate from '../src/tryUpdate.js';

await tryUpdate();

const roundInfo = await new LovedWeb(config.lovedApiKey)
	.getRoundInfo(config.lovedRoundId)
	.catch(logAndExit);
const beatmapsetIds = roundInfo.nominations.map((n) => n.beatmapset_id);
const beatmapsetIdSet = new Set(beatmapsetIds);
const cacheKey = Math.floor(Date.now() / 1000);

for (const beatmapsetId of beatmapsetIdSet) {
	superagent
		.get(`https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/fullsize.jpg?${cacheKey}`)
		.then((response) => writeFile(join('config', `${beatmapsetId}.jpg`), response.body))
		.catch((error) => {
			if (typeof error === 'object' && (error.status === 403 || error.status === 404)) {
				console.error(chalk.yellow(`Beatmapset #${beatmapsetId} does not have a background`));
			} else {
				logAndExit(error);
			}
		});
}
