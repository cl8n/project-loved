const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const MODES = ['osu', 'taiko', 'catch', 'mania'];

const config = require('./config/config.json');
const mainThreadTemplate = fs.readFileSync('./main-thread-template.bbcode').toString();
const mainThreadTemplateBeatmap = fs.readFileSync('./main-thread-template-beatmap.bbcode').toString();
const newsPostTemplate = fs.readFileSync('./news-post-template.md').toString();
const newsPostTemplateBeatmap = fs.readFileSync('./news-post-template-beatmap.md').toString();
const votingThreadTemplate = fs.readFileSync('./voting-thread-template.bbcode').toString();
const newsPostHeader = textFromTemplate(fs.readFileSync('./config/news-post-header.md').toString());
const newsPostIntro = textFromTemplate(fs.readFileSync('./config/news-post-intro.md').toString());

const LovedDocument = require('./loved-document.js');
const Forum = require('./forum.js');
const OsuApi = require('./osu-api.js');

const generateImages = process.argv.includes('--images', 2);
const generateMessages = process.argv.includes('--messages', 2);
const generateThreads = process.argv.includes('--threads', 2);

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
    width: 1000,
    height: 400
  });
  await page.goto(`file://${__dirname.replace(/\\/g, '/')}/image-template/index.html`);

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

function fullModeName(mode) {
  switch (mode) {
    case 'osu':
      return 'osu!standard';
    case 'taiko':
      return 'osu!taiko';
    case 'catch':
      return 'osu!catch';
    case 'mania':
      return 'osu!mania';
  }
}

function modeInt(mode) {
  switch (mode) {
    case 'osu':
      return 0;
    case 'taiko':
      return 1;
    case 'catch':
      return 2;
    case 'mania':
      return 3;
  }
}

function getExtraBeatmapsetInfo(beatmapset, mode) {
  mode = modeInt(mode);

  let minBpm;
  let maxBpm;
  let maxLength;
  let diffs = [];
  let minDiff;
  let maxDiff;
  let keyModes = [];

  beatmapset.forEach(beatmap => {
    beatmap.mode = parseInt(beatmap.mode);

    if (beatmap.mode !== mode)
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

  let lengthMinutes = Math.floor(maxLength / 60);
  let lengthSeconds = (maxLength % 60).toString().padStart(2, '0');

  let info = '';

  if (minBpm === maxBpm)
    info += minBpm;
  else
    info += `${minBpm} – ${maxBpm}`;

  info += ` BPM, ${lengthMinutes}:${lengthSeconds} | `;

  if (diffs.length > 5) {
    if (mode === 3)
      info += keyModes.sort((a, b) => a > b).map(k => `${k}K`).join(' ') + ', ';

    info += `${minDiff.toFixed(2)}★ – ${maxDiff.toFixed(2)}★`
  } else {
    diffs = diffs.sort((a, b) => a[1] > b[1]);
    if (mode === 3)
      diffs = diffs.sort((a, b) => a[0] > b[0]);

    info += diffs.map(d => (mode === 3 ? `${d[0]}K ` : '') + `${d[1].toFixed(2)}★`).join(', ');
  }

  return info;
}

function getUserLink(name) {
  const user = OsuApi.getUser(name, true);

  return `https://osu.ppy.sh/users/${user.user_id}`;
}

let threadIds;
if (fs.existsSync('./storage/thread-ids.json')) {
  threadIds = require('./storage/thread-ids.json');
} else {
  threadIds = {};
}

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

    // escapes
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')

    // general bbcode
    .replace(/\[b\](.+?)\[\/b\]/gs, '**$1**')
    .replace(/\[\i\](.+?)\[\/\i\]/gs, '*$1*')
    .replace(/\[\u\](.+?)\[\/\u\]/gs, '$1')
    .replace(/\[s\](.+?)\[\/s\]/gs, '~~$1~~')
    .replace(/\[color\=.+?\](.+?)\[\/color\]/gs, '$1')
    .replace(/\[url=(.+?)\](.+?)\[\/url\]/gs, '[$2]($1)')
    .replace(/\[quote(?:=".+?")?\](.+?)\[\/quote\]/gs, '> $1')

    // osu!-specific bbcode
    .replace(/\[profile\](.+?)\[\/profile\]/g, (match, p1) => '[' + p1 + '](' + getUserLink(p1) + ')');
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

mkdirTreeSync('./output/news');

const newsFolder = `${config.date}-${config.title.toLowerCase().replace(/\W+/g, '-')}`;
const beatmaps = LovedDocument.readDocuments();

const images = fs.readdirSync('./config')
  .filter(x => fs.statSync(path.join('./config', x)).isFile()
          && (path.extname(x).match(/\.?(png|jpg|jpeg)/) !== null));

if (generateImages) {
  console.log('Generating images');

  MODES.forEach(function (mode) {
    mkdirTreeSync(`./temp/${newsFolder}/${mode}`);
    mkdirTreeSync(`./output/wiki/shared/news/${newsFolder}/${mode}`);
  });

  (async function () {
    const browser = await puppeteer.launch();
    const imagePromises = [];

    images.forEach(function (image) {
      const id = image.split('.')[0];
      const beatmap = beatmaps[id];

      if (beatmap === undefined) {
        console.log(`Could not find beatmapset with ID ${id}; skipping`);
        return;
      }

      const promise = generateImage(
        browser,
        `file://${__dirname.replace(/\\/g, '/')}/config/${image}`,
        beatmap.title,
        beatmap.artist,
        beatmap.creators,
        `./temp/${newsFolder}/${beatmap.mode}/${beatmap.filename}`
      );

      promise.then(() => console.log(`Generated ${beatmap.filename}`),
                  () => console.log(`Failed to generate ${beatmap.filename}`));

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
  mkdirTreeSync('./output/messages');

  Object.values(beatmaps).forEach(beatmap => {
    let message = `${beatmap.creators[0]}\nProject Loved: Changes required on your beatmap\n---\nHello,\n\nYour beatmap ([url]https://osu.ppy.sh/beatmapsets/${beatmap.id}[/url]) is going to be up for vote in this week's round of [url=https://osu.ppy.sh/community/forums/120]Project Loved[/url]. If your map receives over ${config.threshold[beatmap.mode]} "Yes" votes by the end of this week, it can be moved to the Loved category!\n\nHowever, we kindly request that you apply the following metadata changes before it can be moved into Loved:\n\n[quote="Noffy"][/quote]\n\nThanks!`;

    fs.writeFileSync(`./output/messages/${beatmap.mode}-${beatmap.position}.txt`, message);
  });
}

(async function () {
  if (generateThreads) {
    console.log('Posting threads');

    for (let mode of MODES.reverse()) {
      const modeBeatmaps = Object.values(beatmaps)
        .filter(bm => bm.mode === mode)
        .sort((a, b) => a.position - b.position)
        .reverse();
      const posts = {};
      const mainPostTitle = `[${fullModeName(mode)}] ${config.title}`;
      const mainPostBeatmaps = [];

      for (let beatmap of modeBeatmaps) {
        let postTitle = `[${fullModeName(mode)}] ${beatmap.artist} - ${beatmap.title} by ${beatmap.creators[0]}`;

        if (postTitle.length > 100) {
          const longerMeta = beatmap.title.length > beatmap.artist.length ? beatmap.title : beatmap.artist;

          postTitle = postTitle.replace(longerMeta, longerMeta.slice(0, longerMeta.length - postTitle.length + 100 - 4) + ' ...');
        }

        const postContent = textFromTemplate(votingThreadTemplate, {
          MAIN_THREAD_TITLE: mainPostTitle,
          BEATMAPSET_ID: beatmap.id,
          BEATMAPSET: `${beatmap.artist} - ${beatmap.title}`,
          CREATORS: joinList(beatmap.creators.map((name) => name === 'et al.' ? name : `[url=${getUserLink(name)}]${name}[/url]`)),
          CAPTAIN_LINK: `[url=${getUserLink(beatmap.captain)}]${beatmap.captain}[/url]`,
          DESCRIPTION: fixCommonMistakes(osuModernLinks(beatmap.description)),
          LINK_MODE: mode
        });

        const pollTitle = `Should ${beatmap.artist} - ${beatmap.title} by ${beatmap.creators[0]} be Loved?`;

        let coverFile = images.find(x => x.split('.')[0] === beatmap.id.toString());
        coverFile = `${__dirname.replace(/\\/g, '/')}/config/${coverFile}`;

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
          LINK_MODE: mode,
          THREAD_ID: topicId
        }));

        const postId = await Forum.findFirstPostId(topicId);

        posts[beatmap.id] = {
          id: postId,
          content: postContent
        };
      }

      const mainPostContent = textFromTemplate(mainThreadTemplate, {
        GOOGLE_FORM: mode === 'mania' ? config.googleForm.mania : config.googleForm.main,
        GOOGLE_SHEET: mode === 'mania' ? config.googleSheet.mania : config.googleSheet.main,
        RESULTS_POST: config.resultsPost[mode],
        THRESHOLD: config.threshold[mode],
        CAPTAINS: joinList(config.captains[mode].map((name) => `[url=${getUserLink(name)}]${name}[/url]`)),
        BEATMAPS: mainPostBeatmaps.reverse().join('\n\n')
      });

      const mainTopicId = await Forum.storeTopic(mainPostTitle, mainPostContent);

      for (let beatmap of modeBeatmaps) {
        Forum.updatePost(
          posts[beatmap.id].id,
          posts[beatmap.id].content.replace('MAIN_TOPIC_ID', mainTopicId)
        );
      }
    }

    fs.writeFileSync('./storage/thread-ids.json', JSON.stringify(threadIds, null, 4));
  }

  console.log('Generating news post');

  const beatmapsSections = {};
  const captainMarkdown = {};

  MODES.forEach(function (mode) {
    const postBeatmaps = [];

    const modeBeatmaps = Object.values(beatmaps)
      .filter(bm => bm.mode === mode)
      .sort((a, b) => a.position - b.position);

    for (let beatmap of modeBeatmaps) {
      postBeatmaps.push(textFromTemplate(newsPostTemplateBeatmap, {
        'DATE': config.date,
        'FOLDER': newsFolder,
        'MODE': mode,
        'LINK_MODE': mode.replace('catch', 'fruits'),
        'IMAGE': beatmap.filename,
        'TOPIC_ID': threadIds[beatmap.id],
        'BEATMAP': convertToMarkdown(`${beatmap.artist} - ${beatmap.title}`),
        'BEATMAP_EXTRAS': getExtraBeatmapsetInfo(OsuApi.getBeatmapset(beatmap.id), mode),
        'BEATMAP_ID': beatmap.id,
        'CREATORS_MD': joinList(beatmap.creators.map((name) => name === 'et al.' ? name : `[${convertToMarkdown(name)}](${getUserLink(name)})`)),
        'CAPTAIN': convertToMarkdown(beatmap.captain),
        'CAPTAIN_LINK': getUserLink(beatmap.captain),
        'CONSISTENT_CAPTAIN': LovedDocument.singleCaptain(mode),
        'DESCRIPTION': fixCommonMistakes(osuModernLinks(convertToMarkdown(beatmap.description)))
      }));
    }

    beatmapsSections[mode] = postBeatmaps.join('\n\n');

    captainMarkdown[mode] = joinList(config.captains[mode].map((name) => `[${convertToMarkdown(name)}](${getUserLink(name)})`));
  });

  fs.writeFileSync(`./output/news/${newsFolder}.md`, textFromTemplate(newsPostTemplate, {
    'TITLE': config.title,
    'DATE': config.date,
    'TIME': config.time,
    'HEADER': newsPostHeader,
    'INTRO': newsPostIntro,
    'VIDEO': config.videos,
    'INCLUDE_VIDEO': Object.keys(config.videos).length > 0,
    'BEATMAPS': beatmapsSections,
    'CONSISTENT_CAPTAINS': (function () {
      const captains = {};

      for (let mode of MODES) {
        captains[mode] = LovedDocument.singleCaptain(mode);
      }

      return captains;
    })(),
    'ALL_CAPTAINS': captainMarkdown,
    'HELPERS': joinList(config.helpers.map((name) => `[${convertToMarkdown(name)}](${getUserLink(name)})`))
  }) + '\n');
})();
