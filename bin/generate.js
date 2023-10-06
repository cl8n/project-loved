#!/usr/bin/env node

import '../src/force-color.js';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import chalk from 'chalk';
import config from '../src/config.js';
import Discord from '../src/Discord.js';
import { pinTopic, storeTopicCover } from '../src/forum.js';
import Ruleset from '../src/Ruleset.js';
import { convertToMarkdown, escapeMarkdown, expandBbcodeRootLinks, joinList, loadTextResource, logAndExit, maxOf, minOf, textFromTemplate, videoHtml } from '../src/helpers.js';
import LovedWeb from '../src/LovedWeb.js';
import createBanners from '../src/createBanners.js';

async function generateBanners(bannersPath, beatmapsets) {
  console.error('Generating beatmapset banners');

  await mkdir(bannersPath, { recursive: true });

  await Promise.all(beatmapsets.map((beatmapset) =>
    createBanners(
      beatmapset.bgPath ?? 'resources/banner-default.png',
      join(bannersPath, beatmapset.id.toString()),
      beatmapset.title,
    )
      .then((generatedBanners) => console.error(
        generatedBanners
          ? chalk.dim.green(`Created banners for "${beatmapset.title}" [#${beatmapset.id}]`)
          : chalk.dim.yellow(`Skipped creating banners for "${beatmapset.title}" [#${beatmapset.id}]`),
      ))
      .catch((reason) => {
        console.error(chalk.dim.red(`Failed to create banners for "${beatmapset.title}" [#${beatmapset.id}]:\n${reason}`));
        throw new Error();
      }),
  ));
}

async function generateTopics(lovedWeb, nominations, roundTitle, extraGameModeInfo, resultsPostIds, discordWebhooks) {
  console.error('Generating forum topics');

  let error = false;

  // TODO: Check states instead
  for (const nomination of nominations) {
    if (nomination.description == null) {
      console.error(chalk.red(`Missing description for nomination #${nomination.id}`));
      error = true;
    }

    if (nomination.beatmapset_creators.length === 0) {
      console.error(chalk.red(`Missing creators for nomination #${nomination.id}`));
      error = true;
    }
  }

  if (error)
    throw new Error();

  const discordBeatmapsetTemplate = await loadTextResource('discord-template-beatmap.md');
  const mainTopicTemplate = await loadTextResource('main-thread-template.bbcode');
  const mainTopicBeatmapsetTemplate = await loadTextResource('main-thread-template-beatmap.bbcode');
  const votingPostTemplate = await loadTextResource('voting-thread-template.bbcode');
  const discordBeatmapsets = {};
  const mainTopicBodies = {};
  const nominationTopicBodies = {};

  for (const gameMode of Ruleset.all()) {
    const extraInfo = extraGameModeInfo[gameMode.id];
    const mainTopicBeatmapsets = [];
    const mainTopicTitle = `[${gameMode.longName}] ${roundTitle}`;
    const nominationsForMode = nominations.filter((n) => n.game_mode.id === gameMode.id);

    if (nominationsForMode.length === 0) {
      continue;
    }

    for (const nomination of nominationsForMode) {
      const beatmapset = nomination.beatmapset;
      const artistAndTitle = `${beatmapset.artist} - ${beatmapset.title}`;
      const creatorsBbcode = joinList(nomination.beatmapset_creators.map((c) => c.id >= 4294000000 ? c.name : `[url=https://osu.ppy.sh/users/${c.id}]${c.name}[/url]`));

      discordBeatmapsets[nomination.id] = textFromTemplate(discordBeatmapsetTemplate, {
        BEATMAPSET_ID: beatmapset.id,
        BEATMAPSET: escapeMarkdown(artistAndTitle),
        CREATORS: joinList(nomination.beatmapset_creators.map(
          (c) => c.id >= 4294000000 ? escapeMarkdown(c.name) : `[${escapeMarkdown(c.name)}](<https://osu.ppy.sh/users/${c.id}>)`,
        )),
        LINK_MODE: gameMode.linkName,
      });
      mainTopicBeatmapsets.push(textFromTemplate(mainTopicBeatmapsetTemplate, {
        BEATMAPSET: artistAndTitle,
        BEATMAPSET_ID: beatmapset.id,
        CREATORS: creatorsBbcode,
        LINK_MODE: gameMode.linkName,
        TOPIC_ID: `{{${nomination.id}_TOPIC_ID}}`,
      }));
      nominationTopicBodies[nomination.id] = textFromTemplate(votingPostTemplate, {
        BEATMAPSET: artistAndTitle,
        BEATMAPSET_EXTRAS: getExtraBeatmapsetInfo(nomination),
        BEATMAPSET_ID: beatmapset.id,
        CAPTAIN: nomination.description_author.name,
        CAPTAIN_ID: nomination.description_author.id,
        CREATORS: creatorsBbcode,
        DESCRIPTION: expandBbcodeRootLinks(nomination.description),
        LINK_MODE: gameMode.linkName,
        MAIN_TOPIC_TITLE: mainTopicTitle,
      });
    }

    mainTopicBodies[gameMode.id] = textFromTemplate(mainTopicTemplate, {
      BEATMAPS: mainTopicBeatmapsets.join('\n\n'),
      CAPTAINS: joinList(extraInfo.nominators.map((n) => `[url=https://osu.ppy.sh/users/${n.id}]${n.name}[/url]`)),
      GAME_MODE_LINK_NAME: gameMode.linkName,
      RESULTS_POST: `https://osu.ppy.sh/community/forums/posts/${resultsPostIds[gameMode.id]}`,
      THRESHOLD: extraInfo.thresholdFormatted,
    });
  }

  const { mainTopicIds, nominationTopicIds } = await lovedWeb.createPolls(
    config.lovedRoundId,
    mainTopicBodies,
    nominationTopicBodies,
  );

  console.error('Pinning main topics');

  await Promise.all(mainTopicIds.map((topicId) => pinTopic(topicId, 'announce')));

  console.error('Posting announcements to Discord');

  await Promise.all(Ruleset.all().map(async (gameMode) => {
    const discordBeatmapsetStrings = nominations
      .filter((nomination) => nomination.game_mode.id === gameMode.id)
      .map((nomination) => discordBeatmapsets[nomination.id].replace(
        '{{TOPIC_ID}}',
        nominationTopicIds[nomination.id],
      ));
    const discordWebhook = discordWebhooks[gameMode.id];

    if (discordBeatmapsetStrings.length > 0 && discordWebhook != null) {
      let discordMessage = textFromTemplate(config.messages.discordPost, { MAP_COUNT: discordBeatmapsetStrings.length }) + '\n\n';
      const sendMessage = (message) => new Discord(discordWebhook).post(`Project Loved: ${gameMode.longName}`, message.trim());

      for (const beatmapsetString of discordBeatmapsetStrings) {
        const newMessage = discordMessage + beatmapsetString + '\n\n';

        if (newMessage.length > Discord.maxLength) {
          await sendMessage(discordMessage);
          discordMessage = beatmapsetString + '\n\n';
          continue;
        }

        discordMessage = newMessage;
      }

      await sendMessage(discordMessage);
    }
  }));

  console.error('Uploading topic covers');

  await Promise.all(nominations.map((nomination) => {
    if (nomination.beatmapset.bgPath != null) {
      return storeTopicCover(
        nomination.beatmapset.bgPath,
        nominationTopicIds[nomination.id],
      );
    }
  }));
}

async function generateNews(newsPath, roundInfo, topicIds) {
  console.error('Generating news post');

  const gameModeSectionStrings = [];
  const gameModesPresent = [];
  const newsGameModeTemplate = await loadTextResource('news-post-template-mode.md');
  const newsNominationTemplate = await loadTextResource('news-post-template-beatmap.md');
  const newsTemplate = await loadTextResource('news-post-template.md');

  for (const gameMode of Ruleset.all()) {
    const extraInfo = roundInfo.extraGameModeInfo[gameMode.id];
    const nominationStrings = [];
    const nominationsForMode = roundInfo.allNominations
      .filter((n) => n.game_mode.id === gameMode.id);

    if (nominationsForMode.length === 0) {
      console.error(chalk.yellow(`Skipping ${gameMode.longName}, there are no nominations`));
      continue;
    }

    gameModesPresent.push(gameMode);

    for (const nomination of nominationsForMode) {
      const errors = [];

      if (nomination.description == null) {
        errors.push('missing description');
      } else if (nomination.description_state === 0) {
        errors.push('unreviewed description');
      }

      if (nomination.beatmapset_creators.length === 0) {
        errors.push('missing creators');
      }

      if (errors.length > 0) {
        console.error(chalk.yellow(`Skipping nomination #${nomination.id} with ${joinList(errors)}`));
        continue;
      }

      nominationStrings.push(textFromTemplate(newsNominationTemplate, {
        BEATMAPSET: escapeMarkdown(`${nomination.beatmapset.artist} - ${nomination.beatmapset.title}`),
        BEATMAPSET_EXTRAS: convertToMarkdown(getExtraBeatmapsetInfo(nomination)),
        BEATMAPSET_ID: nomination.beatmapset.id,
        CAPTAIN: escapeMarkdown(nomination.description_author.name),
        CAPTAIN_ID: nomination.description_author.id,
        CONSISTENT_CAPTAIN: extraInfo.descriptionAuthors.length === 1,
        CREATORS: joinList(nomination.beatmapset_creators.map((c) => c.id >= 4294000000 ? escapeMarkdown(c.name) : `[${escapeMarkdown(c.name)}](https://osu.ppy.sh/users/${c.id})`)),
        DESCRIPTION: convertToMarkdown(nomination.description),
        FOLDER: roundInfo.newsDirname,
        LINK_MODE: gameMode.linkName,
        TOPIC_ID: topicIds[nomination.id],
      }));
    }

    gameModeSectionStrings.push(textFromTemplate(newsGameModeTemplate, {
      ALL_CAPTAINS: joinList(extraInfo.nominators.map((n) => `[${escapeMarkdown(n.name)}](https://osu.ppy.sh/users/${n.id})`)),
      CONSISTENT_CAPTAIN: extraInfo.descriptionAuthors.length === 1 ? escapeMarkdown(extraInfo.descriptionAuthors[0].name) : null,
      CONSISTENT_CAPTAIN_ID: extraInfo.descriptionAuthors.length === 1 ? extraInfo.descriptionAuthors[0].id : null,
      MODE_LONG: gameMode.longName,
      NOMINATIONS: nominationStrings.join('\n\n'),
      VIDEO: videoHtml(extraInfo.video),
    }));
  }

  await mkdir(dirname(newsPath), { recursive: true });
  await writeFile(newsPath, textFromTemplate(newsTemplate, {
    AUTHOR: roundInfo.newsAuthorName,
    DATE: roundInfo.postDateString,
    GAME_MODES: gameModesPresent,
    HEADER: roundInfo.introPreview,
    INTRO: roundInfo.intro,
    NOMINATIONS: gameModeSectionStrings.join('\n\n'),
    OUTRO: roundInfo.outro,
    TIME: roundInfo.postTimeString,
    TITLE: roundInfo.title,
    VIDEO: videoHtml(roundInfo.video),
  }) + '\n');
}

function getExtraBeatmapsetInfo(nomination) {
  const beatmaps = [];
  const beatmapsForMode = nomination.beatmaps
    .filter((b) => b.game_mode === nomination.game_mode.id);
  const excludedDiffNames = [];
  const reverseExclude = beatmapsForMode.filter((b) => b.excluded).length / beatmapsForMode.length > 0.5;

  for (const beatmap of beatmapsForMode) {
    if (reverseExclude != beatmap.excluded) {
      const versionMatch = beatmap.version.match(/(?:\[\d+K\] )?(.+)/i);

      if (versionMatch == null)
        throw `Excluded beatmap version match failed for nomination #${nomination.id}`;

      excludedDiffNames.push(`[${versionMatch[1]}]`);
    }

    if (!beatmap.excluded)
      beatmaps.push(beatmap);
  }

  if (beatmaps.length === 0)
    throw `No beatmaps for nomination #${nomination.id}`;

  // TODO: should be done on website
  beatmaps
    .sort((a, b) => a.star_rating - b.star_rating)
    .sort((a, b) => a.key_mode - b.key_mode);

  const maxBpm = maxOf(beatmaps, 'bpm');
  const minBpm = minOf(beatmaps, 'bpm');
  const maxLength = maxOf(beatmaps, 'total_length');
  const lengthMinutes = Math.floor(maxLength / 60);
  const lengthSeconds = (maxLength % 60).toString().padStart(2, '0');
  let info = '';

  if (minBpm === maxBpm)
    info += minBpm;
  else
    info += `${minBpm} – ${maxBpm}`;

  info += ` BPM, ${lengthMinutes}:${lengthSeconds} | `;

  if (beatmaps.length > 5) {
    const maxSr = maxOf(beatmaps, 'star_rating');
    const minSr = minOf(beatmaps, 'star_rating');

    if (nomination.game_mode.id === 3) {
      const keyModes = [...new Set(beatmaps.map((beatmap) => beatmap.key_mode))]
        .filter((keyMode) => keyMode != null)
        .sort((a, b) => a - b);

      info += keyModes
        .map((k) => `${k}K, `)
        .join('');
    }

    info += `${minSr.toFixed(2)}★ – ${maxSr.toFixed(2)}★`;
  } else {
    info += beatmaps
      .map((beatmap) => (
        (beatmap.key_mode == null ? '' : `[${beatmap.key_mode}K] `) +
        `${beatmap.star_rating.toFixed(2)}★`
      ))
      .join(', ');
  }

  if (excludedDiffNames.length > 0) {
    const part = `${joinList(excludedDiffNames)} ${excludedDiffNames.length > 1 ? 'difficulties are' : 'difficulty is'}`;

    info += reverseExclude
      ? `\nOnly the ${part} being nominated for Loved.`
      : `\nThe ${part} [i]not[/i] being nominated for Loved.`;
  }

  return info;
}

async function loadBeatmapsetBgPaths(beatmapsets) {
  const dirents = await readdir('config', { withFileTypes: true });
  const paths = {};

  for (const dirent of dirents) {
    if (!dirent.isFile())
      continue;

    const filenameMatch = dirent.name.match(/(\d+)\.(?:jpeg|jpg|png)/i);

    if (filenameMatch != null)
      paths[parseInt(filenameMatch[1])] = join('config', filenameMatch[0]);
  }

  for (const beatmapset of beatmapsets) {
    if (paths[beatmapset.id] == null) {
      console.error(chalk.yellow(`Missing background image for ${beatmapset.title} [#${beatmapset.id}], using default`));
    }
  }

  return paths;
}

const outPath = process.argv.slice(2).find((arg) => !arg.startsWith('-'));
const shouldGenerateTopics = process.argv.includes('--threads', 2);

if (outPath == null && !shouldGenerateTopics) {
  logAndExit('No output path provided and not generating topics');
}

const lovedWeb = new LovedWeb(config.lovedApiKey);
const roundInfo = await lovedWeb.getRoundInfo(config.lovedRoundId).catch(logAndExit);
const postTimeIsoString = roundInfo.postTime.toISOString();

roundInfo.postDateString = postTimeIsoString.slice(0, 10);
roundInfo.postTimeString = postTimeIsoString.slice(11, 19);
roundInfo.postYear = postTimeIsoString.slice(0, 4);
roundInfo.newsDirname = `${roundInfo.postDateString}-${roundInfo.title.toLowerCase().replace(/\W+/g, '-')}`;

const beatmapsets = roundInfo.nominations.map((n) => n.beatmapset);
const beatmapsetBgPaths = await loadBeatmapsetBgPaths(beatmapsets).catch(logAndExit);

for (const nomination of roundInfo.allNominations) {
  nomination.beatmapset.bgPath = beatmapsetBgPaths[nomination.beatmapset.id];
}

if (outPath != null) {
  await generateBanners(
    join(outPath, `wiki/shared/news/${roundInfo.newsDirname}`),
    beatmapsets,
  ).catch(logAndExit);
}

if (shouldGenerateTopics) {
  // TODO: probably just pass roundInfo...
  await generateTopics(
    lovedWeb,
    roundInfo.allNominations,
    roundInfo.title,
    roundInfo.extraGameModeInfo,
    roundInfo.resultsPostIds,
    roundInfo.discordWebhooks,
  ).catch(logAndExit);
}

if (outPath != null) {
  await generateNews(
    join(outPath, `news/${roundInfo.postYear}/${roundInfo.newsDirname}.md`),
    roundInfo,
    await lovedWeb.getRoundTopicIds(config.lovedRoundId).catch(logAndExit),
  ).catch(logAndExit);
}
