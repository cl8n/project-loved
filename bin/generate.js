const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const config = {...require('../resources/info.json'), ...require('../config/config.json')};
const discordTemplateBeatmap = fs.readFileSync(path.join(__dirname, '../resources/discord-template-beatmap.md'), 'utf8');
const mainThreadTemplate = fs.readFileSync(path.join(__dirname, '../resources/main-thread-template.bbcode'), 'utf8');
const mainThreadTemplateBeatmap = fs.readFileSync(path.join(__dirname, '../resources/main-thread-template-beatmap.bbcode'), 'utf8');
const newsPostTemplate = fs.readFileSync(path.join(__dirname, '../resources/news-post-template.md'), 'utf8');
const newsPostTemplateBeatmap = fs.readFileSync(path.join(__dirname, '../resources/news-post-template-beatmap.md'), 'utf8');
const votingThreadTemplate = fs.readFileSync(path.join(__dirname, '../resources/voting-thread-template.bbcode'), 'utf8');
const newsPostHeader = fs.readFileSync(path.join(__dirname, '../config/news-post-header.md'), 'utf8').trim();
const newsPostIntro = fs.readFileSync(path.join(__dirname, '../config/news-post-intro.md'), 'utf8').trim();
const LovedDocument = require('../src/loved-document');
const Discord = require('../src/discord');
const Forum = require('../src/forum');
const Gamemode = require('../src/gamemode');
const OsuApi = require('../src/osu-api');

const generateImages = process.argv.includes('--images', 2);
const generateMessages = process.argv.includes('--messages', 2);
const generateThreads = process.argv.includes('--threads', 2);

let outPath = process.argv.slice(2).find(a => !a.startsWith('-'));
if (outPath === undefined)
  outPath = path.join(__dirname, '../output');

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

  await page.screenshot({
    path: outputImage,
    quality: 100
  });

  await page.close();
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
      info += keyModes.sort((a, b) => a > b).map(k => `[${k}K]`).join(' ') + ', ';

    info += `${minDiff.toFixed(2)}★ – ${maxDiff.toFixed(2)}★`
  } else {
    diffs = diffs.sort((a, b) => a[1] > b[1]);
    if (nomination.mode.integer === 3)
      diffs = diffs.sort((a, b) => a[0] > b[0]);

    info += diffs.map(d => (nomination.mode.integer === 3 ? `[${d[0]}K] ` : '') + `${d[1].toFixed(2)}★`).join(', ');
  }

  if (excludedDiffNames.length > 0) {
    info += `\nThe ${joinList(excludedDiffNames)} ${excludedDiffNames.length > 1 ? 'difficulties are' : 'difficulty is'} [i]not[/i] being nominated for Loved.`;
  }

  return info;
}

function getUserLink(name) {
  const user = OsuApi.getUser(name, true);

  return `https://osu.ppy.sh/users/${user.user_id}`;
}

let threadIds;
try { threadIds = require('../storage/thread-ids.json') }
catch { threadIds = {} }

function textFromTemplate(template, vars = {}) {
  return template
    .replace(/<\?(.+?)\?>/gs, function (_, script) {
      let result = eval(script);

      return result === undefined || result === null ? '' : result;
    })
    .trim();
}

function fixCommonMistakes(text) {
  return text

    // "smart" characters
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/½/g, '1/2')
    .replace(/⅓/g, '1/3')
    .replace(/¼/g, '1/4')
    .replace(/⅙/g, '1/6')
    .replace(/⅛/g, '1/8')

    // acronym consistency
    .replace(/(\d+) ?k(?<=\s)/gi, '$1K')
    .replace(/(\d+) ?bpm/gi, '$1 BPM');
}

function osuModernLinks(text) {
  return text.toString()
    .replace(/https\:\/\/osu.ppy.sh\/s\//g, 'https://osu.ppy.sh/beatmapsets/')
    .replace(/https\:\/\/osu.ppy.sh\/u\/([0-9]+)/g, 'https://osu.ppy.sh/users/$1')
    .replace(/https\:\/\/osu.ppy.sh\/u\/([0-9A-Za-z-_%\[\]]+)/g, (match, p1) => getUserLink(p1))
    .replace(/https\:\/\/osu.ppy.sh\/b\//g, 'https://osu.ppy.sh/beatmaps/')
    .replace(/https\:\/\/osu.ppy.sh\/forum\/t\//g, 'https://osu.ppy.sh/community/forums/topics/');
}

function convertToMarkdown(bbcode) {
  return bbcode.toString()
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/\[(.+?)\]\(/g, '\\[$1\\](')
    .replace(/~/g, '\\~')

    .replace(/\[b\](.+?)\[\/b\]/gs, '**$1**')
    .replace(/\[\i\](.+?)\[\/\i\]/gs, '*$1*')
    .replace(/\[\u\](.+?)\[\/\u\]/gs, '$1')
    .replace(/\[s\](.+?)\[\/s\]/gs, '~~$1~~')
    .replace(/\[color\=.+?\](.+?)\[\/color\]/gs, '$1')
    .replace(/\[url=(.+?)\](.+?)\[\/url\]/gs, '[$2]($1)')
    .replace(/\[quote(?:=".+?")?\](.+?)\[\/quote\]/gs, '> $1')
    .replace(/\[profile\](.+?)\[\/profile\]/g, (match, p1) => '[' + p1 + '](' + getUserLink(p1) + ')')
    .replace(/([^\n]|^)\n([^\n]|$)/g, '$1  \n$2')

    .replace(/(\s|^|\[)_/g, '$1\\_')
    .replace(/_(\s|$|\])/g, '\\_$1');
}

function escapeHtml(text) {
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function joinList(array) {
  if (array.length === 0) {
    throw 'Invalid array';
  }

  let line = array[0];

  for (let i = 1; i < array.length; i++) {
    if (i === array.length - 1) {
      if (array[i].includes('et al.')) {
        line += ' et al.';
      } else {
        line += ` and ${array[i]}`;
      }
    } else {
      line += `, ${array[i]}`;
    }
  }

  return line;
}

function mkdirTreeSync(dir) {
  if (fs.existsSync(dir)) {
    return;
  }

  try {
    fs.mkdirSync(dir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      mkdirTreeSync(path.dirname(dir));
      mkdirTreeSync(dir);
    } else {
      throw error;
    }
  }
}

mkdirTreeSync(path.join(outPath, 'news'));

const newsFolder = `${config.date}-${config.title.toLowerCase().replace(/\W+/g, '-')}`;
const beatmaps = LovedDocument.readDocuments();

const images =
  fs
    .readdirSync(path.join(__dirname, '../config'))
    .filter(
      f =>
        fs.statSync(path.join(__dirname, '../config', f)).isFile() &&
        path.extname(f).match(/png|jpg|jpeg/) !== null
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

      const promise = generateImage(
        browser,
        `file://${path.join(__dirname, `../config/${image}`).replace(/\\/g, '/')}`,
        beatmap.title,
        beatmap.artist,
        beatmap.creators,
        path.join(__dirname, `../storage/${newsFolder}/${beatmap.mode.shortName}/${beatmap.imageFilename()}`)
      );

      promise.then(() => console.log(`Generated ${beatmap.imageFilename()}`),
                   () => console.log(`Failed to generate ${beatmap.imageFilename()}`));

      imagePromises.push(promise);
    });

    // Each promise is mapped to catch and return errors so that Promise.all()
    // does not resolve until all of the promises are resolved, regardless of
    // if any fail. This is important because we don't want the browser to close
    // while new pages are still being opened.
    Promise.all(imagePromises.map(p => p.catch(e => e)))
      .then(() => browser.close(), () => browser.close());
  })();
}

if (generateMessages) {
  Object.values(beatmaps).forEach(beatmap => {
    const hasMetadataChanges = beatmap.metadataEdits !== undefined;
    const apiBeatmap = OsuApi.getBeatmapset(beatmap.id)[0];
    const message = hasMetadataChanges
      ? `Hello,\n\nYour beatmap, [url=https://osu.ppy.sh/beatmapsets/${beatmap.id}]${apiBeatmap.artist} - ${apiBeatmap.title}[/url], is going to be up for vote in next week's round of [url=https://osu.ppy.sh/community/forums/120]Project Loved[/url]. If your map receives over ${config.threshold[beatmap.mode.shortName]} "Yes" votes by the time polls end, it can be moved to the Loved category!\n\nHowever, we kindly request that you apply the following metadata changes before then:\n\n[quote="${beatmap.metadataMessageAuthor}"]${beatmap.metadataEdits}[/quote]\n\nAlso, if for any reason you [i]do not[/i] want your map to be put up for voting, please let me know ASAP.\n\nThanks!`
      : `Hello,\n\nYour beatmap, [url=https://osu.ppy.sh/beatmapsets/${beatmap.id}]${apiBeatmap.artist} - ${apiBeatmap.title}[/url], is going to be up for vote in next week's round of [url=https://osu.ppy.sh/community/forums/120]Project Loved[/url]. If your map receives over ${config.threshold[beatmap.mode.shortName]} "Yes" votes by the time polls end, it can be moved to the Loved category!\n\nIf for any reason you [i]do not[/i] want your map to be put up for voting, please let me know ASAP.\n\nThanks!`;

    Forum.sendPm(
      hasMetadataChanges
        ? 'Project Loved: Changes required on your beatmap'
        : 'Project Loved: Your map will be up for voting soon!',
      hasMetadataChanges ? 'alert' : 'heart',
      message,
      [OsuApi.getUser(apiBeatmap.creator_id).username]
    );
  });
}

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
        } else {
          topicId = threadIds[beatmap.id];
        }

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
        GOOGLE_FORM: mode.integer === 3 ? config.googleForm.mania : config.googleForm.main,
        GOOGLE_SHEET: mode.integer === 3 ? config.googleSheet.mania : config.googleSheet.main,
        RESULTS_POST: config.resultsPost[mode.shortName],
        THRESHOLD: config.threshold[mode.shortName],
        CAPTAINS: joinList(config.captains[mode.shortName].map((name) => `[url=${getUserLink(name)}]${name}[/url]`)),
        BEATMAPS: mainPostBeatmaps.reverse().join('\n\n')
      });

      const mainTopicId = await Forum.storeTopic(mainPostTitle, mainPostContent);
      Forum.pinTopic(mainTopicId);

      for (let beatmap of modeBeatmaps) {
        Forum.updatePost(
          posts[beatmap.id].id,
          posts[beatmap.id].content.replace('MAIN_TOPIC_ID', mainTopicId)
        );
      }

      if (config.discord[mode.shortName])
        new Discord(config.discord[mode.shortName]).post(
          `Project Loved: ${mode.longName}`,
          `@everyone Check out the ${discordBeatmaps.length} beatmaps nominated in the latest round!\n\n${discordBeatmaps.reverse().join('\n\n')}`
        );
    }

    fs.writeFileSync(path.join(__dirname, '../storage/thread-ids.json'), JSON.stringify(threadIds, null, 4));
  }

  console.log('Generating news post');

  const beatmapsSections = {};
  const captainMarkdown = {};
  const consistentCaptains = {};

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

    beatmapsSections[mode.shortName] = postBeatmaps.join('\n\n');
    captainMarkdown[mode.shortName] = joinList(config.captains[mode.shortName].map((name) => `[${convertToMarkdown(name)}](${getUserLink(name)})`));
    consistentCaptains[mode.shortName] = LovedDocument.singleCaptain(mode);
  });

  fs.writeFileSync(path.join(outPath, `news/${newsFolder}.md`), textFromTemplate(newsPostTemplate, {
    TITLE: config.title,
    DATE: config.date,
    TIME: config.time,
    HEADER: newsPostHeader,
    INTRO: newsPostIntro,
    VIDEO: config.videos,
    INCLUDE_VIDEO: Object.keys(config.videos).length > 0,
    BEATMAPS: beatmapsSections,
    CONSISTENT_CAPTAINS: consistentCaptains,
    ALL_CAPTAINS: captainMarkdown,
    HELPERS: joinList(config.helpers.map((name) => `[${convertToMarkdown(name)}](${getUserLink(name)})`))
  }) + '\n');
})();