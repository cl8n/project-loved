const { dim, green, red } = require('chalk');
const { existsSync } = require('fs');
const { readdir, writeFile } = require('fs').promises;
const { join } = require('path');
const BeatmapsetBanner = require('../src/BeatmapsetBanner');
const config = require('../src/config');
const Discord = require('../src/discord');
const Forum = require('../src/forum');
const GameMode = require('../src/gamemode');
const { convertToMarkdown, escapeMarkdown, getUserLink, joinList, loadTextResource, mkdirTreeSync, textFromTemplate } = require('../src/helpers');
const LovedWeb = require('../src/LovedWeb');
const { getBeatmapset } = require('../src/osu-api');

// TODO: Move to file dedicated to topic storage (also see topics-cache)
const topicIds = existsSync(join(__dirname, '../storage/topic-ids.json'))
  ? require('../storage/topic-ids.json')
  : {};

async function generateBanners(bannersPath, beatmapsets) {
  console.log('Generating beatmapset banners');

  mkdirTreeSync(bannersPath);

  const bannerPromises = [];

  for (const beatmapset of beatmapsets) {
    const banner = new BeatmapsetBanner(beatmapset);
    const bannerPath = join(bannersPath, `${beatmapset.id}.jpg`);
    const bannerPromise = banner.createBanner(bannerPath)
      .then(() => {
        console.log(dim(green(`Created banner for ${beatmapset.title} [#${beatmapset.id}]`)));
      })
      .catch((reason) => {
        console.error(dim(red(`Failed to create banner for ${beatmapset.title} [#${beatmapset.id}]:\n${dim(reason)}`)));
      });

    bannerPromises.push(bannerPromise);
  }

  await Promise.all(bannerPromises);
}

async function generateTopics(nominations, roundTitle) {
  const discordBeatmapsetTemplate = loadTextResource('discord-template-beatmap.md');
  const mainPostTemplate = loadTextResource('main-thread-template.bbcode');
  const mainPostBeatmapsetTemplate = loadTextResource('main-thread-template-beatmap.bbcode');
  const votingPostTemplate = loadTextResource('voting-thread-template.bbcode');

  // Post in reverse so that it looks in-order on the topic listing
  for (const gameMode of GameMode.modes().reverse()) {
    console.log(`Posting ${gameMode.longName} forum topics`);

    const discordBeatmapsetStrings = [];
    const mainPostBeatmapsetStrings = [];
    const mainTopicTitle = `[${gameMode.longName}] ${roundTitle}`;
    const nominationsForMode = nominations
      .filter((n) => n.game_mode.integer === gameMode.integer)
      .reverse();
    const postsByNominationId = {};

    for (const nomination of nominationsForMode) {
      const beatmapset = nomination.beatmapset;
      const artistAndTitle = `${beatmapset.artist} - ${beatmapset.title}`;
      const creatorsBbcode = joinList(nomination.beatmapset_creators.map((c) => `[url=https://osu.ppy.sh/users/${c.id}]${c.name}[/url]`));
      const postContent = textFromTemplate(votingPostTemplate, {
        BEATMAPSET: artistAndTitle,
        BEATMAPSET_EXTRAS: getExtraBeatmapsetInfo(nomination),
        BEATMAPSET_ID: beatmapset.id,
        CAPTAIN: nomination.description_author.name,
        CAPTAIN_ID: nomination.description_author.id,
        CREATORS: creatorsBbcode,
        DESCRIPTION: nomination.description,
        LINK_MODE: gameMode.linkName,
        MAIN_TOPIC_TITLE: mainTopicTitle,
      });
      let topicId = topicIds[nomination.id];

      if (topicId == null) {
        const coverId = await Forum.storeTopicCover(beatmapset.bgPath);
        const pollTitle = `Should ${artistAndTitle} be Loved?`;
        let postTitle = `[${gameMode.longName}] ${artistAndTitle} by ${beatmapset.creator_name}`;

        if (postTitle.length > 100) {
          const longerMeta = beatmapset.title.length > beatmapset.artist.length ? beatmapset.title : beatmapset.artist;

          // TODO: Could break if `longerMeta` appears more than once in the post title
          //       Also could break if both artist and title are very long
          postTitle = postTitle.replace(
            longerMeta,
            longerMeta.slice(0, longerMeta.length - postTitle.length + 97) + '...',
          );
        }

        topicId = await Forum.storeTopicWithPoll(postTitle, postContent, coverId, pollTitle);
        topicIds[nomination.id] = topicId;

        await writeFile(join(__dirname, '../storage/topic-ids.json'), JSON.stringify(topicIds));
      }

      postsByNominationId[nomination.id] = {
        id: await Forum.findFirstPostId(topicId),
        content: postContent,
      };

      mainPostBeatmapsetStrings.push(textFromTemplate(mainPostBeatmapsetTemplate, {
        BEATMAPSET: artistAndTitle,
        BEATMAPSET_ID: beatmapset.id,
        CREATORS: creatorsBbcode,
        LINK_MODE: gameMode.linkName,
        TOPIC_ID: topicId,
      }));

      discordBeatmapsetStrings.push(textFromTemplate(discordBeatmapsetTemplate, {
        BEATMAPSET_ID: beatmapset.id,
        BEATMAPSET: escapeMarkdown(artistAndTitle),
        CREATORS: joinList(nomination.beatmapset_creators.map((c) => `[${escapeMarkdown(c.name)}](<https://osu.ppy.sh/users/${c.id}>)`)),
        LINK_MODE: gameMode.linkName,
        TOPIC_ID: topicId,
      }));
    }

    const mainTopicId = await Forum.storeTopic(mainTopicTitle, textFromTemplate(mainPostTemplate, {
      BEATMAPS: mainPostBeatmapsetStrings.reverse().join('\n\n'),
      CAPTAINS: joinList(config.captains[gameMode.shortName].map((c) => `[url=${getUserLink(c)}]${c}[/url]`)),
      GOOGLE_FORM: config.googleForm[gameMode.shortName] || config.googleForm.main,
      GOOGLE_SHEET: config.googleSheet[gameMode.shortName] || config.googleSheet.main,
      RESULTS_POST: config.resultsPost[gameMode.shortName],
      THRESHOLD: config.threshold[gameMode.shortName],
    }));

    Forum.pinTopic(mainTopicId, 'announce');

    for (const nomination of nominationsForMode) {
      const postInfo = postsByNominationId[nomination.id];

      Forum.updatePost(postInfo.id, postInfo.content.replace('MAIN_TOPIC_ID', mainTopicId));
    }

    const discordWebhook = config.discord[gameMode.shortName];

    if (discordWebhook) {
      new Discord(discordWebhook).post(
        `Project Loved: ${gameMode.longName}`,
        // TODO: Why is this not a normal template
        textFromTemplate(config.messages.discordPost, { MAP_COUNT: discordBeatmapsetStrings.length })
          + '\n\n'
          + discordBeatmapsetStrings.reverse().join('\n\n'),
      );
    }
  }
}

async function generateNews(newsPath, roundInfo) {
  console.log('Generating news post');

  const gameModeSectionStrings = [];
  const newsGameModeTemplate = loadTextResource('news-post-template-mode.md');
  const newsNominationTemplate = loadTextResource('news-post-template-beatmap.md');
  const newsTemplate = loadTextResource('news-post-template.md');

  for (const gameMode of GameMode.modes()) {
    const extraInfo = roundInfo.extraGameModeInfo[gameMode.integer];
    const nominationStrings = [];
    const nominationsForMode = roundInfo.allNominations
      .filter((n) => n.game_mode.integer === gameMode.integer);

    for (const nomination of nominationsForMode) {
      nominationStrings.push(textFromTemplate(newsNominationTemplate, {
        BEATMAPSET: escapeMarkdown(`${nomination.beatmapset.artist} - ${nomination.beatmapset.title}`),
        BEATMAPSET_EXTRAS: convertToMarkdown(getExtraBeatmapsetInfo(nomination)),
        BEATMAPSET_ID: nomination.beatmapset.id,
        CAPTAIN: escapeMarkdown(nomination.description_author.name),
        CAPTAIN_ID: nomination.description_author.id,
        CONSISTENT_CAPTAIN: extraInfo.descriptionAuthors.length === 1,
        CREATORS: joinList(nomination.beatmapset_creators.map((c) => `[${escapeMarkdown(c.name)}](https://osu.ppy.sh/users/${c.id})`)),
        DESCRIPTION: convertToMarkdown(nomination.description),
        FOLDER: roundInfo.newsDirname,
        LINK_MODE: gameMode.linkName,
        TOPIC_ID: topicIds[nomination.id],
      }));
    }

    gameModeSectionStrings.push(textFromTemplate(newsGameModeTemplate, {
      // TODO: This should use extraInfo.nominators.sort(...), not config. Website needs support for either setting this explicitly or setting multiple nominators per map
      ALL_CAPTAINS: joinList(config.captains[gameMode.shortName].map((c) => `[${escapeMarkdown(c)}](${getUserLink(c)})`)),
      CONSISTENT_CAPTAIN: extraInfo.descriptionAuthors.length === 1 ? escapeMarkdown(extraInfo.descriptionAuthors[0].name) : null,
      CONSISTENT_CAPTAIN_ID: extraInfo.descriptionAuthors.length === 1 ? extraInfo.descriptionAuthors[0].id : null,
      MODE_LONG: gameMode.longName,
      MODE_SHORT: gameMode.shortName,
      NOMINATIONS: nominationStrings.join('\n\n'),
      VIDEO: config.videos[gameMode.shortName],
    }));
  }

  await writeFile(newsPath, textFromTemplate(newsTemplate, {
    AUTHOR: config.username,
    DATE: roundInfo.postDateString,
    HEADER: roundInfo.introPreview,
    INTRO: roundInfo.intro,
    NOMINATIONS: gameModeSectionStrings.join('\n\n'),
    OUTRO: roundInfo.outro,
    TIME: roundInfo.postTimeString,
    TITLE: roundInfo.title,
    VIDEO: config.videos.intro,
  }) + '\n');
}

// TODO: This should not depend on API v1 and shouldn't need to fetch extra data at all
function getExtraBeatmapsetInfo(nomination) {
  let minBpm;
  let maxBpm;
  let maxLength;
  let diffs = [];
  let minDiff;
  let maxDiff;
  const keyModes = [];
  const excludedDiffNames = [];

  getBeatmapset(nomination.beatmapset.id).forEach(beatmap => {
    if (parseInt(beatmap.mode) !== nomination.game_mode.integer)
      return;

    if (nomination.beatmaps.find((b) => b.id === parseInt(beatmap.beatmap_id)).excluded) {
      excludedDiffNames.push(`[${beatmap.version}]`);
      return;
    }

    beatmap.diff_size = parseInt(beatmap.diff_size);
    beatmap.bpm = Math.round(parseFloat(beatmap.bpm));
    beatmap.difficultyrating = parseFloat(beatmap.difficultyrating);
    beatmap.total_length = parseInt(beatmap.total_length);

    diffs.push([beatmap.diff_size, beatmap.difficultyrating]);

    if (!keyModes.includes(beatmap.diff_size))
      keyModes.push(beatmap.diff_size);

    if (minBpm == null || beatmap.bpm < minBpm)
      minBpm = beatmap.bpm;
    if (maxBpm == null || beatmap.bpm > maxBpm)
      maxBpm = beatmap.bpm;
    if (maxLength == null || beatmap.total_length > maxLength)
      maxLength = beatmap.total_length;
    if (minDiff == null || beatmap.difficultyrating < minDiff)
      minDiff = beatmap.difficultyrating;
    if (maxDiff == null || beatmap.difficultyrating > maxDiff)
      maxDiff = beatmap.difficultyrating;
  });

  const lengthMinutes = Math.floor(maxLength / 60);
  const lengthSeconds = (maxLength % 60).toString().padStart(2, '0');

  let info = '';

  if (minBpm === maxBpm)
    info += minBpm;
  else
    info += `${minBpm} – ${maxBpm}`;

  info += ` BPM, ${lengthMinutes}:${lengthSeconds} | `;

  const filteredDiffs = diffs.filter(d => d[1] !== 0);

  if (filteredDiffs.length > 0)
    diffs = filteredDiffs;

  if (diffs.length > 5) {
    if (nomination.game_mode.integer === 3)
      info += keyModes.sort((a, b) => a - b).map(k => `[${k}K]`).join(' ') + ', ';

    info += `${minDiff.toFixed(2)}★ – ${maxDiff.toFixed(2)}★`
  } else {
    diffs = diffs.sort((a, b) => a[1] - b[1]);
    if (nomination.game_mode.integer === 3)
      diffs = diffs.sort((a, b) => a[0] - b[0]);

    info += diffs.map(d => (nomination.game_mode.integer === 3 ? `[${d[0]}K] ` : '') + `${d[1].toFixed(2)}★`).join(', ');
  }

  if (excludedDiffNames.length > 0)
    info += `\nThe ${joinList(excludedDiffNames)} ${excludedDiffNames.length > 1 ? 'difficulties are' : 'difficulty is'} [i]not[/i] being nominated for Loved.`;

  return info;
}

async function loadBeatmapsetBgPaths(beatmapsetIds) {
  const dirents = await readdir(join(__dirname, '../config'), { withFileTypes: true });
  const paths = {};

  for (const dirent of dirents) {
    if (!dirent.isFile())
      continue;

    const filenameMatch = dirent.name.match(/(\d+)\.(?:jpeg|jpg|png)/i);

    if (filenameMatch != null)
      paths[parseInt(filenameMatch[1])] = join(__dirname, '../config', filenameMatch[0]);
  }

  let error = false;

  for (const beatmapsetId of beatmapsetIds) {
    if (paths[beatmapsetId] == null) {
      console.error(red(`Missing background image for beatmapset #${beatmapsetId}`));
      error = true;
    }
  }

  if (error)
    throw new Error();

  return paths;
}

(async () => {
  const outPath = process.argv.slice(2).find((arg) => !arg.startsWith('-')) || join(__dirname, '../output');
  const shouldGenerateBanners = process.argv.includes('--images', 2);
  const shouldGenerateTopics = process.argv.includes('--threads', 2);
  const roundInfo = await new LovedWeb(config.lovedApiKey).getRoundInfo(config.lovedRoundId);

  if (shouldGenerateBanners || shouldGenerateTopics) {
    const beatmapsetIds = roundInfo.nominations.map((n) => n.beatmapset.id);
    const beatmapsetBgPaths = await loadBeatmapsetBgPaths(beatmapsetIds)
      .catch(() => process.exit(1));

    for (const nomination of roundInfo.allNominations) {
      nomination.beatmapset.bgPath = beatmapsetBgPaths[nomination.beatmapset.id];
    }
  }

  const postTimeIsoString = roundInfo.postTime.toISOString();
  roundInfo.postDateString = postTimeIsoString.slice(0, 10);
  roundInfo.postTimeString = postTimeIsoString.slice(11, 19);
  roundInfo.newsDirname = `${roundInfo.postDateString}-${roundInfo.title.toLowerCase().replace(/\W+/g, '-')}`;

  if (shouldGenerateBanners) {
    await generateBanners(
      join(outPath, `wiki/shared/news/${roundInfo.newsDirname}`),
      roundInfo.nominations.map((n) => n.beatmapset),
    );
  }

  if (shouldGenerateTopics) {
    await generateTopics(roundInfo.allNominations, roundInfo.title);
  }

  // TODO: Rewrite with async functions?
  mkdirTreeSync(join(outPath, 'news'));

  await generateNews(
    join(outPath, `news/${roundInfo.newsDirname}.md`),
    roundInfo,
  );
})();
