#!/usr/bin/env node

import '../src/force-color.js';
import open from 'open';
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

for (const beatmapsetId of beatmapsetIdSet) {
	await open(`https://osu.ppy.sh/beatmapsets/${beatmapsetId}`);
}
