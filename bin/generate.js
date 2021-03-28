const { red, yellow } = require('chalk');
const { existsSync, readdirSync, statSync, writeFileSync } = require('fs');
const { extname, join } = require('path');
const BeatmapImage = require('../src/BeatmapImage');
const config = require('../src/config');
const Discord = require('../src/discord');
const Forum = require('../src/forum');
const Gamemode = require('../src/gamemode');
const { convertToMarkdown, getUserLink, joinList, loadTextResource, mkdirTreeSync, textFromTemplate } = require('../src/helpers');
const LovedDocument = require('../src/loved-document');
const OsuApi = require('../src/osu-api');

function getExtraBeatmapsetInfo(beatmapset, nomination) {
  let minBpm;
  let maxBpm;
  let maxLength;
  let diffs = [];
  let minDiff;
  let maxDiff;
  const keyModes = [];
  const excludedDiffNames = [];

  beatmapset.forEach(beatmap => {
    if (nomination.excludedBeatmaps.includes(parseInt(beatmap.beatmap_id))) {
      excludedDiffNames.push(`[${beatmap.version}]`);
      return;
    }

    if (parseInt(beatmap.mode) !== nomination.mode.integer)
      return;

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
    if (nomination.mode.integer === 3)
      info += keyModes.sort((a, b) => a - b).map(k => `[${k}K]`).join(' ') + ', ';

    info += `${minDiff.toFixed(2)}★ – ${maxDiff.toFixed(2)}★`
  } else {
    diffs = diffs.sort((a, b) => a[1] - b[1]);
    if (nomination.mode.integer === 3)
      diffs = diffs.sort((a, b) => a[0] - b[0]);

    info += diffs.map(d => (nomination.mode.integer === 3 ? `[${d[0]}K] ` : '') + `${d[1].toFixed(2)}★`).join(', ');
  }

  if (excludedDiffNames.length > 0)
    info += `\nThe ${joinList(excludedDiffNames)} ${excludedDiffNames.length > 1 ? 'difficulties are' : 'difficulty is'} [i]not[/i] being nominated for Loved.`;

  return info;
}

const discordTemplateBeatmap = loadTextResource('discord-template-beatmap.md');
const mainThreadTemplate = loadTextResource('main-thread-template.bbcode');
const mainThreadTemplateBeatmap = loadTextResource('main-thread-template-beatmap.bbcode');
const newsPostTemplate = loadTextResource('news-post-template.md');
const newsPostTemplateBeatmap = loadTextResource('news-post-template-beatmap.md');
const newsPostTemplateMode = loadTextResource('news-post-template-mode.md');
const votingThreadTemplate = loadTextResource('voting-thread-template.bbcode');

const generateImages = process.argv.includes('--images', 2);
const generateThreads = process.argv.includes('--threads', 2);

const outPath = process.argv.slice(2).find((arg) => !arg.startsWith('-')) || join(__dirname, '../output');

mkdirTreeSync(join(outPath, 'news'));

const newsFolder = `${config.date}-${config.title.toLowerCase().replace(/\W+/g, '-')}`;
const document = LovedDocument.readDocument();

const images =
  readdirSync(join(__dirname, '../config'))
    .filter(
      f =>
        statSync(join(__dirname, '../config', f)).isFile() &&
        extname(f).match(/png|jpg|jpeg/i) != null
    );

const threadIds = existsSync(join(__dirname, '../storage/thread-ids.json'))
  ? require('../storage/thread-ids.json')
  : {};

if (generateImages) {
  console.log('Generating images');

  const imagesDirname = join(outPath, `wiki/shared/news/${newsFolder}`);

  for (const mode of Gamemode.modes())
    mkdirTreeSync(join(imagesDirname, mode.shortName));

  for (const imageBasename of images) {
    const id = parseInt(imageBasename.split('.')[0]);
    const beatmap = document.nominations[id];

    if (beatmap == null) {
      console.error(yellow(`No nomination corresponding to ${imageBasename}`));
      continue;
    }

    const imageFilename = join(__dirname, '../config', imageBasename);
    const outputFilename = join(imagesDirname, `${beatmap.mode.shortName}/${beatmap.imageBasename}`);
    const beatmapImage = new BeatmapImage(beatmap, imageFilename);

    beatmapImage.createBanner(outputFilename)
      .catch((reason) => {
        console.error(red(`Failed to create banner image for ${beatmap.title} (#${beatmap.id}):\n${reason}`));
      });
  }
}

(async function () {
  if (generateThreads) {
    console.log('Posting threads');

    for (let mode of Gamemode.modes().reverse()) {
      const modeBeatmaps = [...Object.values(document.nominations), ...document.otherModeNominations]
        .filter(bm => bm.mode.integer === mode.integer)
        .sort((a, b) => a.position - b.position)
        .reverse();
      const posts = {};
      const mainPostTitle = `[${mode.longName}] ${config.title}`;
      const mainPostBeatmaps = [];
      const discordBeatmaps = [];

      for (let beatmap of modeBeatmaps) {
        let postTitle = `[${mode.longName}] ${beatmap.artist} - ${beatmap.title} by ${beatmap.creators[0]}`;

        if (postTitle.length > 100) {
          const longerMeta = beatmap.title.length > beatmap.artist.length ? beatmap.title : beatmap.artist;

          postTitle = postTitle.replace(longerMeta, longerMeta.slice(0, longerMeta.length - postTitle.length + 100 - 4) + ' ...');
        }

        const postContent = textFromTemplate(votingThreadTemplate, {
          MAIN_THREAD_TITLE: mainPostTitle,
          BEATMAP_EXTRAS: getExtraBeatmapsetInfo(OsuApi.getBeatmapset(beatmap.id), beatmap),
          BEATMAPSET_ID: beatmap.id,
          BEATMAPSET: `${beatmap.artist} - ${beatmap.title}`,
          CREATORS: joinList(beatmap.creators.map((name) => name === 'et al.' ? name : `[url=${getUserLink(name)}]${name}[/url]`)),
          CAPTAIN: beatmap.captain,
          DESCRIPTION: beatmap.description,
          LINK_MODE: mode.linkName
        });

        const pollTitle = `Should ${beatmap.artist} - ${beatmap.title} by ${beatmap.creators[0]} be Loved?`;

        let coverFile = images.find(f => parseInt(f.split('.')[0]) === beatmap.id);
        coverFile = join(__dirname, `../config/${coverFile}`);

        let topicId;
        if (threadIds[beatmap.indexer] == null) {
          const coverId = await Forum.storeTopicCover(coverFile);
          topicId = await Forum.storeTopicWithPoll(postTitle, postContent, coverId, pollTitle);

          threadIds[beatmap.indexer] = topicId;
          writeFileSync(join(__dirname, '../storage/thread-ids.json'), JSON.stringify(threadIds, null, 4));
        } else
          topicId = threadIds[beatmap.indexer];

        mainPostBeatmaps.push(textFromTemplate(mainThreadTemplateBeatmap, {
          BEATMAPSET_ID: beatmap.id,
          BEATMAPSET: `${beatmap.artist} - ${beatmap.title}`,
          CREATORS: joinList(beatmap.creators.map((name) => name === 'et al.' ? name : `[url=${getUserLink(name)}]${name}[/url]`)),
          LINK_MODE: mode.linkName,
          THREAD_ID: topicId
        }));

        discordBeatmaps.push(textFromTemplate(discordTemplateBeatmap, {
          BEATMAPSET_ID: beatmap.id,
          BEATMAPSET: convertToMarkdown(`${beatmap.artist} - ${beatmap.title}`),
          CREATORS: joinList(beatmap.creators.map((name) => name === 'et al.' ? name : `[${convertToMarkdown(name)}](<${getUserLink(name)}>)`)),
          LINK_MODE: mode.linkName,
          THREAD_ID: topicId
        }));

        const postId = await Forum.findFirstPostId(topicId);

        posts[beatmap.indexer] = {
          id: postId,
          content: postContent
        };
      }

      const mainPostContent = textFromTemplate(mainThreadTemplate, {
        GOOGLE_FORM: config.googleForm[mode.shortName] || config.googleForm.main,
        GOOGLE_SHEET: config.googleSheet[mode.shortName] || config.googleSheet.main,
        RESULTS_POST: config.resultsPost[mode.shortName],
        THRESHOLD: config.threshold[mode.shortName],
        CAPTAINS: joinList(config.captains[mode.shortName].map((name) => `[url=${getUserLink(name)}]${name}[/url]`)),
        BEATMAPS: mainPostBeatmaps.reverse().join('\n\n')
      });

      const mainTopicId = await Forum.storeTopic(mainPostTitle, mainPostContent);
      Forum.pinTopic(mainTopicId, 'announce');

      for (let beatmap of modeBeatmaps) {
        Forum.updatePost(
          posts[beatmap.indexer].id,
          posts[beatmap.indexer].content.replace('MAIN_TOPIC_ID', mainTopicId)
        );
      }

      if (config.discord[mode.shortName])
        new Discord(config.discord[mode.shortName]).post(
          `Project Loved: ${mode.longName}`,
          `${textFromTemplate(config.messages.discordPost, { MAP_COUNT: discordBeatmaps.length })}\n\n${discordBeatmaps.reverse().join('\n\n')}`
        );
    }
  }

  console.log('Generating news post');

  const beatmapSectionModes = [];

  Gamemode.modes().forEach(function (mode) {
    const postBeatmaps = [];

    const modeBeatmaps = [...Object.values(document.nominations), ...document.otherModeNominations]
      .filter(bm => bm.mode.integer === mode.integer)
      .sort((a, b) => a.position - b.position);

    for (let beatmap of modeBeatmaps) {
      postBeatmaps.push(textFromTemplate(newsPostTemplateBeatmap, {
        DATE: config.date,
        FOLDER: newsFolder,
        MODE: (beatmap.hostMode || mode).shortName, // this is only used in the image link
        LINK_MODE: mode.linkName,
        IMAGE: beatmap.hostMode == null ? beatmap.imageBasename : document.nominations[beatmap.id].imageBasename,
        TOPIC_ID: threadIds[beatmap.indexer],
        BEATMAP: convertToMarkdown(`${beatmap.artist} - ${beatmap.title}`),
        BEATMAP_EXTRAS: convertToMarkdown(getExtraBeatmapsetInfo(OsuApi.getBeatmapset(beatmap.id), beatmap)),
        BEATMAP_ID: beatmap.id,
        CREATORS_MD: joinList(beatmap.creators.map((name) => name === 'et al.' ? name : `[${convertToMarkdown(name)}](${getUserLink(name)})`)),
        CAPTAIN: convertToMarkdown(beatmap.captain),
        CAPTAIN_LINK: getUserLink(beatmap.captain),
        CONSISTENT_CAPTAIN: LovedDocument.singleCaptain(mode),
        DESCRIPTION: convertToMarkdown(beatmap.description)
      }));
    }

    beatmapSectionModes.push(textFromTemplate(newsPostTemplateMode, {
      MODE_SHORT: mode.shortName,
      MODE_LONG: mode.longName,
      VIDEO: config.videos[mode.shortName],
      ALL_CAPTAINS: joinList(config.captains[mode.shortName].map((name) => `[${convertToMarkdown(name)}](${getUserLink(name)})`)),
      CONSISTENT_CAPTAINS: LovedDocument.singleCaptain(mode),
      BEATMAPS: postBeatmaps.join('\n\n')
    }));
  });

  writeFileSync(join(outPath, `news/${newsFolder}.md`), textFromTemplate(newsPostTemplate, {
    TITLE: config.title,
    DATE: config.date,
    TIME: config.time,
    HEADER: document.header,
    INTRO: document.intro,
    VIDEO: config.videos,
    OUTRO: document.outro,
    BEATMAPS: beatmapSectionModes.join('\n\n'),
    AUTHOR: config.username
  }) + '\n');
})();
