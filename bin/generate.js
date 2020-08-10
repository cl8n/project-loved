const {exec, execFile} = require('child_process');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const config = {...require('../resources/info.json'), ...require('../config/config.json')};
const discordTemplateBeatmap = fs.readFileSync(path.join(__dirname, '../resources/discord-template-beatmap.md'), 'utf8');
const mainThreadTemplate = fs.readFileSync(path.join(__dirname, '../resources/main-thread-template.bbcode'), 'utf8');
const mainThreadTemplateBeatmap = fs.readFileSync(path.join(__dirname, '../resources/main-thread-template-beatmap.bbcode'), 'utf8');
const newsPostTemplate = fs.readFileSync(path.join(__dirname, '../resources/news-post-template.md'), 'utf8');
const newsPostTemplateBeatmap = fs.readFileSync(path.join(__dirname, '../resources/news-post-template-beatmap.md'), 'utf8');
const newsPostTemplateMode = fs.readFileSync(path.join(__dirname, '../resources/news-post-template-mode.md'), 'utf8');
const votingThreadTemplate = fs.readFileSync(path.join(__dirname, '../resources/voting-thread-template.bbcode'), 'utf8');
const LovedDocument = require('../src/loved-document');
const Discord = require('../src/discord');
const Forum = require('../src/forum');
const Gamemode = require('../src/gamemode');
const OsuApi = require('../src/osu-api');
const { convertToMarkdown, escapeHtml, getUserLink, joinList, mkdirTreeSync, textFromTemplate } = require('../src/helpers');

const generateImages = process.argv.includes('--images', 2);
const generateThreads = process.argv.includes('--threads', 2);

let outPath = process.argv.slice(2).find(a => !a.startsWith('-'));
if (outPath === undefined)
  outPath = path.join(__dirname, '../output');

let jpegRecompress =
  fs
    .readdirSync(__dirname)
    .find(
      f =>
        fs.statSync(path.join(__dirname, f)).isFile() &&
        f.includes('jpeg-recompress')
    );

if (generateImages)
  if (jpegRecompress === undefined) {
    console.error('jpeg-recompress must be in bin/ to generate images');
    process.exit(1);
  } else
    jpegRecompress = path.join(__dirname, jpegRecompress);

async function generateImage(
  browser,
  backgroundImage,
  title,
  artist,
  creators,
  outputImage
) {
  const page = await browser.newPage();

  await page.setViewport({
    width: 920,
    height: 300
  });
  await page.goto(`file://${path.join(__dirname, '../resources/image-template/index.html').replace(/\\/g, '/')}`);

  await Promise.all([
    page.$eval('img', (el, img) => el.style.backgroundImage = `url('${img}')`, backgroundImage),
    page.$eval('#title', (el, title) => el.innerHTML = title, escapeHtml(title)),
    page.$eval('#artist', (el, artist) => el.innerHTML = artist, escapeHtml(artist)),
    page.$eval('#creator', (el, creatorsList) => el.innerHTML = `mapped by ${creatorsList}`, joinList(creators.map((name) => `<b>${name}</b>`)))
  ]);

  await new Promise(resolve => {
    setTimeout(async () => {
      await page.screenshot({
        path: outputImage,
        quality: 100
      });

      await page.close();

      resolve();
    }, config.imageLoadWait);
  });
}

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

    if (minBpm === undefined || beatmap.bpm < minBpm)
      minBpm = beatmap.bpm;
    if (maxBpm === undefined || beatmap.bpm > maxBpm)
      maxBpm = beatmap.bpm;
    if (maxLength === undefined || beatmap.total_length > maxLength)
      maxLength = beatmap.total_length;
    if (minDiff === undefined || beatmap.difficultyrating < minDiff)
      minDiff = beatmap.difficultyrating;
    if (maxDiff === undefined || beatmap.difficultyrating > maxDiff)
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

function fixCommonMistakes(text) {
  return text.toString()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/½/g, '1/2')
    .replace(/⅓/g, '1/3')
    .replace(/¼/g, '1/4')
    .replace(/⅙/g, '1/6')
    .replace(/⅛/g, '1/8')

    .replace(/(\d+) ?k(?<=\s)/gi, '$1K')
    .replace(/(\d+) ?bpm/gi, '$1 BPM')
    .replace(/o2jam/gi, 'O2Jam');
}

function osuModernLinks(text) {
  return text.toString()
    .replace(/https\:\/\/osu.ppy.sh\/s\//g, 'https://osu.ppy.sh/beatmapsets/')
    .replace(/https\:\/\/osu.ppy.sh\/u\/([0-9]+)/g, 'https://osu.ppy.sh/users/$1')
    .replace(/https\:\/\/osu.ppy.sh\/u\/([0-9A-Za-z-_%\[\]]+)/g, (match, p1) => getUserLink(p1))
    .replace(/https\:\/\/osu.ppy.sh\/b\//g, 'https://osu.ppy.sh/beatmaps/')
    .replace(/https\:\/\/osu.ppy.sh\/forum\/t\//g, 'https://osu.ppy.sh/community/forums/topics/');
}

mkdirTreeSync(path.join(outPath, 'news'));

const newsFolder = `${config.date}-${config.title.toLowerCase().replace(/\W+/g, '-')}`;
const document = LovedDocument.readDocument();
const beatmaps = document.nominations;

const images =
  fs
    .readdirSync(path.join(__dirname, '../config'))
    .filter(
      f =>
        fs.statSync(path.join(__dirname, '../config', f)).isFile() &&
        path.extname(f).match(/png|jpg|jpeg/i) !== null
    );

if (generateImages) {
  console.log('Generating images');

  Gamemode.modes().forEach(function (mode) {
    mkdirTreeSync(path.join(__dirname, `../storage/${newsFolder}/${mode.shortName}`));
    mkdirTreeSync(path.join(outPath, `wiki/shared/news/${newsFolder}/${mode.shortName}`));
  });

  (async function () {
    const browser = await puppeteer.launch();
    const imagePromises = [];

    images.forEach(function (image) {
      const id = parseInt(image.split('.')[0]);
      const beatmap = beatmaps[id];

      if (beatmap === undefined) {
        console.log(`Could not find beatmapset with ID ${id}; skipping`);
        return;
      }

      const storageLocation = path.join(__dirname, `../storage/${newsFolder}/${beatmap.mode.shortName}/${beatmap.imageFilename()}`);

      const promise = generateImage(
        browser,
        `file://${path.join(__dirname, `../config/${image}`).replace(/\\/g, '/')}`,
        beatmap.title,
        beatmap.artist,
        beatmap.creators,
        storageLocation
      );

      promise.then(
        () => {
          console.log(`Generated ${beatmap.imageFilename()}`);
          execFile(jpegRecompress, [
            '--accurate',
            '--quiet',
            '--strip',
            storageLocation,
            storageLocation.replace(/.+[\/\\]storage/, path.join(outPath, 'wiki/shared/news'))
          ], error => {
            if (error) {
              console.error(`Failed to minimize ${beatmap.imageFilename()}. Copied uncompressed image to output folder`);
              console.error(error);
            } else
              console.log(`Minimized ${beatmap.imageFilename()}`);
          });
        },
        () => console.error(`Failed to generate ${beatmap.imageFilename()}`)
      );

      imagePromises.push(promise);
    });

    const afterAllImages = () => {
      browser.close();
      exec(`rm -rf storage/${newsFolder}`);
    };

    // Each promise is mapped to catch and return errors so that Promise.all()
    // does not resolve until all of the promises are resolved, regardless of
    // if any fail. This is important because we don't want the browser to close
    // while new pages are still being opened.
    Promise
      .all(imagePromises.map(p => p.catch(e => e)))
      .then(afterAllImages, afterAllImages);
  })();
}

const threadIds = fs.existsSync(path.join(__dirname, '../storage/thread-ids.json'))
  ? require('../storage/thread-ids.json')
  : {};

(async function () {
  if (generateThreads) {
    console.log('Posting threads');

    for (let mode of Gamemode.modes().reverse()) {
      const modeBeatmaps = Object.values(beatmaps)
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
          DESCRIPTION: fixCommonMistakes(osuModernLinks(beatmap.description)),
          LINK_MODE: mode.linkName
        });

        const pollTitle = `Should ${beatmap.artist} - ${beatmap.title} by ${beatmap.creators[0]} be Loved?`;

        let coverFile = images.find(f => parseInt(f.split('.')[0]) === beatmap.id);
        coverFile = path.join(__dirname, `../config/${coverFile}`);

        let topicId;
        if (threadIds[beatmap.id] === undefined) {
          const coverId = await Forum.storeTopicCover(coverFile);
          topicId = await Forum.storeTopicWithPoll(postTitle, postContent, coverId, pollTitle);

          threadIds[beatmap.id] = topicId;
          fs.writeFileSync(path.join(__dirname, '../storage/thread-ids.json'), JSON.stringify(threadIds, null, 4));
        } else
          topicId = threadIds[beatmap.id];

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

        posts[beatmap.id] = {
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
          posts[beatmap.id].id,
          posts[beatmap.id].content.replace('MAIN_TOPIC_ID', mainTopicId)
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

    const modeBeatmaps = Object.values(beatmaps)
      .filter(bm => bm.mode.integer === mode.integer)
      .sort((a, b) => a.position - b.position);

    for (let beatmap of modeBeatmaps) {
      postBeatmaps.push(textFromTemplate(newsPostTemplateBeatmap, {
        DATE: config.date,
        FOLDER: newsFolder,
        MODE: mode.shortName,
        LINK_MODE: mode.linkName,
        IMAGE: beatmap.imageFilename(),
        TOPIC_ID: threadIds[beatmap.id],
        BEATMAP: convertToMarkdown(`${beatmap.artist} - ${beatmap.title}`),
        BEATMAP_EXTRAS: convertToMarkdown(getExtraBeatmapsetInfo(OsuApi.getBeatmapset(beatmap.id), beatmap)),
        BEATMAP_ID: beatmap.id,
        CREATORS_MD: joinList(beatmap.creators.map((name) => name === 'et al.' ? name : `[${convertToMarkdown(name)}](${getUserLink(name)})`)),
        CAPTAIN: convertToMarkdown(beatmap.captain),
        CAPTAIN_LINK: getUserLink(beatmap.captain),
        CONSISTENT_CAPTAIN: LovedDocument.singleCaptain(mode),
        DESCRIPTION: fixCommonMistakes(osuModernLinks(convertToMarkdown(beatmap.description)))
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

  fs.writeFileSync(path.join(outPath, `news/${newsFolder}.md`), textFromTemplate(newsPostTemplate, {
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
