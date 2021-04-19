const { dim, green, red, yellow } = require('chalk');
const { existsSync } = require('fs');
const { readdir, writeFile } = require('fs').promises;
const { join } = require('path');
const BeatmapsetBanner = require('../src/BeatmapsetBanner');
const config = require('../src/config');
const Discord = require('../src/discord');
const Forum = require('../src/forum');
const GameMode = require('../src/gamemode');
const { convertToMarkdown, escapeMarkdown, joinList, loadTextResource, maxOf, minOf, mkdirTreeSync, textFromTemplate } = require('../src/helpers');
const LovedWeb = require('../src/LovedWeb');

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

async function generateTopics(nominations, roundTitle, extraGameModeInfo, resultsPosts, discordWebhooks) {
  console.log('Generating forum topics');

  let error = false;

  for (const gameMode of GameMode.modes()) {
    const nominationsForMode = nominations.filter((n) => n.game_mode.integer === gameMode.integer);

    if (nominationsForMode.length === 0) {
      console.error(red(`No nominations for ${gameMode.longName}`));
      error = true;
    }
  }

  // TODO: Check states instead
  for (const nomination of nominations) {
    if (nomination.description == null) {
      console.error(red(`Missing description for nomination #${nomination.id}`));
      error = true;
    }

    if (nomination.beatmapset_creators.length === 0) {
      console.error(red(`Missing creators for nomination #${nomination.id}`));
      error = true;
    }
  }

  if (error)
    process.exit(1);

  const discordBeatmapsetTemplate = loadTextResource('discord-template-beatmap.md');
  const mainPostTemplate = loadTextResource('main-thread-template.bbcode');
  const mainPostBeatmapsetTemplate = loadTextResource('main-thread-template-beatmap.bbcode');
  const votingPostTemplate = loadTextResource('voting-thread-template.bbcode');

  // Post in reverse so that it looks in-order on the topic listing
  for (const gameMode of GameMode.modes().reverse()) {
    console.log(`Posting ${gameMode.longName} forum topics`);

    const discordBeatmapsetStrings = [];
    const extraInfo = extraGameModeInfo[gameMode.integer];
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
      CAPTAINS: joinList(extraInfo.nominators.map((n) => `[url=https://osu.ppy.sh/users/${n.id}]${n.name}[/url]`)),
      GOOGLE_FORM: config.googleForm[gameMode.shortName] || config.googleForm.main,
      GOOGLE_SHEET: config.googleSheet[gameMode.shortName] || config.googleSheet.main,
      RESULTS_POST: resultsPosts[gameMode.integer],
      THRESHOLD: extraInfo.thresholdFormatted,
    }));

    Forum.pinTopic(mainTopicId, 'announce');

    for (const nomination of nominationsForMode) {
      const postInfo = postsByNominationId[nomination.id];

      Forum.updatePost(postInfo.id, postInfo.content.replace('MAIN_TOPIC_ID', mainTopicId));
    }

    const discordWebhook = discordWebhooks[gameMode.integer];

    if (discordWebhook != null) {
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

    if (nominationsForMode.length === 0) {
      console.error(yellow(`Skipping ${gameMode.longName}, there are no nominations`));
      continue;
    }

    for (const nomination of nominationsForMode) {
      const errors = [];

      // TODO: check states instead
      if (nomination.description == null) {
        errors.push('missing description');
      }

      if (nomination.beatmapset_creators.length === 0) {
        errors.push('missing creators');
      }

      if (errors.length > 0) {
        console.error(yellow(`Skipping nomination #${nomination.id} with ${joinList(errors)}`));
        continue;
      }

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
      ALL_CAPTAINS: joinList(extraInfo.nominators.map((n) => `[${escapeMarkdown(n.name)}](https://osu.ppy.sh/users/${n.id})`)),
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

function getExtraBeatmapsetInfo(nomination) {
  const beatmaps = [];
  const excludedDiffNames = [];

  for (const beatmap of nomination.beatmaps) {
    if (beatmap.game_mode !== nomination.game_mode.integer)
      continue;

    if (beatmap.excluded) {
      const versionMatch = beatmap.version.match(/(?:\[\d+K\] )?(.+)/i);

      if (versionMatch == null)
        throw new Error('Excluded beatmap version match failed');

      excludedDiffNames.push(`[${versionMatch[1]}]`);
      continue;
    }

    beatmaps.push(beatmap);
  }

  if (beatmaps.length === 0)
    throw new Error('No beatmaps for this nomination');

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

    if (nomination.game_mode.integer === 3) {
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
    process.exit(1);

  return paths;
}

(async () => {
  const outPath = process.argv.slice(2).find((arg) => !arg.startsWith('-')) || join(__dirname, '../output');
  const shouldGenerateBanners = process.argv.includes('--images', 2);
  const shouldGenerateTopics = process.argv.includes('--threads', 2);
  const lovedWeb = new LovedWeb(config.lovedApiKey);

  // TODO: Request times out
  if (false && shouldGenerateTopics) {
    console.log('Updating beatmapsets on loved.sh');

    let error = false;
    const messages = await lovedWeb.updateBeatmapsets(config.lovedRoundId);

    for (const message of messages) {
      if (message.startsWith('Failed')) {
        console.error(red(message));
        error = true;
      } else {
        console.log(dim(green(message)));
      }
    }

    if (error) {
      process.exit(1);
    }
  }

  const roundInfo = await lovedWeb.getRoundInfo(config.lovedRoundId);

  if (shouldGenerateBanners || shouldGenerateTopics) {
    const beatmapsetIds = roundInfo.nominations.map((n) => n.beatmapset.id);
    const beatmapsetBgPaths = await loadBeatmapsetBgPaths(beatmapsetIds);

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
    // TODO: probably just pass roundInfo...
    await generateTopics(
      roundInfo.allNominations,
      roundInfo.title,
      roundInfo.extraGameModeInfo,
      roundInfo.resultsPosts,
      roundInfo.discordWebhooks,
    );
  }

  // TODO: Rewrite with async functions?
  mkdirTreeSync(join(outPath, 'news'));

  await generateNews(
    join(outPath, `news/${roundInfo.newsDirname}.md`),
    roundInfo,
  );
})();
