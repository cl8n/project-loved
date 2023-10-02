#!/usr/bin/env node

import '../src/force-color.js';
import open from 'open';
import config from '../src/config.js';
import { logAndExit } from '../src/helpers.js';
import LovedWeb from '../src/LovedWeb.js';

const roundInfo = await new LovedWeb(config.lovedApiKey).getRoundInfo(config.lovedRoundId).catch(logAndExit);
const beatmapsetIds = roundInfo.nominations.map((n) => n.beatmapset_id);
const beatmapsetIdSet = new Set(beatmapsetIds);

for (const beatmapsetId of beatmapsetIdSet)
  await open(`https://osu.ppy.sh/beatmapsets/${beatmapsetId}`);
