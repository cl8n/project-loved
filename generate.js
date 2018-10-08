const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const request = require('sync-request');

const MODES = ['osu', 'taiko', 'catch', 'mania'];

const config = require('./config/config.json');
const newsPostTemplate = fs.readFileSync('./news-post-template.md').toString();
const newsPostTemplateBeatmap = fs.readFileSync('./news-post-template-beatmap.md').toString();
const newsPostHeader = textFromTemplate(fs.readFileSync('./config/news-post-header.md').toString());
const newsPostIntro = textFromTemplate(fs.readFileSync('./config/news-post-intro.md').toString());

const LovedSpreadsheet = require('./loved-spreadsheet.js');

function osuApiRequestSync(endpoint, params) {
  let url = `https://osu.ppy.sh/api/${endpoint}?k=${config.osuApiKey}`;

  Object.keys(params).forEach(function (key) {
    url += `&${key}=${params[key]}`;
  });

  const response = request('GET', url);

  if (response.statusCode === 401) {
    throw 'Invalid osu!api key';
  }

  return JSON.parse(response.getBody());
}

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
    page.$eval('#creator', function (el, creators) {
      let line = `mapped by <b>${creators[0]}</b>`;

      for (let i = 1; i < creators.length; i++) {
        if (i === creators.length - 1) {
          if (creators[i] === 'et al.') {
            line += ' et al.';
          } else {
            line += ` and <b>${creators[i]}</b>`;
          }
        } else {
          line += `, <b>${creators[i]}</b>`;
        }
      }

      el.innerHTML = line;
    }, creators)
  ]);

  await page.screenshot({
    path: outputImage,
    quality: 100
  });

  await page.close();
}

let userLinks;
if (fs.existsSync('./storage/user-links.json')) {
  userLinks = require('./storage/user-links.json');
} else {
  userLinks = {};
}

function getUserLink(name) {
  if (userLinks[name]) {
    return userLinks[name];
  }

  console.log(`Fetching user ID of ${name}`);

  const user = osuApiRequestSync('get_user', {
    u: name,
    type: 'string'
  });

  if (!user.length) {
    throw `User not found: ${name}`;
  }

  return userLinks[name] = `https://osu.ppy.sh/users/${user[0].user_id}`;
}

let beatmapSetLinks;
if (fs.existsSync('./storage/beatmapset-links.json')) {
  beatmapSetLinks = require('./storage/beatmapset-links.json');
} else {
  beatmapSetLinks = {};
}

function getBeatmapSetLink(beatmapId) {
  if (beatmapSetLinks[beatmapId]) {
    return beatmapSetLinks[beatmapId];
  }

  console.log(`Fetching beatmap set ID of #${beatmapId}`);

  const beatmap = osuApiRequestSync('get_beatmaps', { b: beatmapId });

  if (!beatmap.length) {
    throw `Beatmap not found: ${beatmapId}`;
  }

  return beatmapSetLinks[beatmapId] = `https://osu.ppy.sh/beatmapsets/${beatmap[0].beatmapset_id}`;
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
    .replace(/https\:\/\/osu.ppy.sh\/b\/([0-9]+)/g, (match, p1) => getBeatmapSetLink(p1))
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

function escapeDoubleQuotes(text) {
  return text.toString().replace(/"/g, '\\"');
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
      if (array[i] === 'et al.') {
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
    if (error.errno === -4058) {
      mkdirTreeSync(path.dirname(dir));
      mkdirTreeSync(dir);
    } else {
      throw error;
    }
  }
}

mkdirTreeSync('./output/news');

const newsFolder = `${config.date}-${config.title.toLowerCase().replace(/\W+/g, '-')}`;

MODES.forEach(function (mode) {
  mkdirTreeSync(`./temp/${newsFolder}/${mode}`);
  mkdirTreeSync(`./output/wiki/shared/news/${newsFolder}/${mode}`);
});

const beatmaps = LovedSpreadsheet.readSheets();

const images = fs.readdirSync('./config')
  .filter(x => fs.statSync(path.join('./config', x)).isFile()
            && (path.extname(x) === '.png' || path.extname(x) === '.jpg'));

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

console.log('Generating news post');

const beatmapsSections = {};

MODES.forEach(function (mode) {
  const postBeatmaps = [];

  const modeBeatmaps = Object.values(beatmaps)
    .filter(bm => bm.mode === mode)
    .sort((a, b) => a.position - b.position);

  for (let beatmap of modeBeatmaps) {
    let creatorsMd = `[${convertToMarkdown(beatmap.creators[0])}](https://osu.ppy.sh/users/${beatmap.creatorId})`;

    for (let i = 1; i < beatmap.creators.length; i++) {
      if (i == beatmap.creators.length - 1) {
        if (beatmap.creators[i] == 'et al.') {
          creatorsMd += ' et al.';
        } else {
          creatorsMd += ` and [${convertToMarkdown(beatmap.creators[i])}](${getUserLink(beatmap.creators[i])})`;
        }
      } else {
        creatorsMd += `, [${convertToMarkdown(beatmap.creators[i])}](${getUserLink(beatmap.creators[i])})`;
      }
    }

    postBeatmaps.push(textFromTemplate(newsPostTemplateBeatmap, {
      'DATE': config.date,
      'FOLDER': newsFolder,
      'MODE': mode,
      'LINK_MODE': mode.replace('catch', 'fruits'),
      'IMAGE': beatmap.filename,
      // 'TOPIC_ID': '',
      'BEATMAP': convertToMarkdown(`${beatmap.artist} - ${beatmap.title}`),
      'BEATMAP_ID': beatmap.id,
      'CREATORS_MD': creatorsMd,
      'CAPTAIN': convertToMarkdown(beatmap.captain),
      'CAPTAIN_LINK': getUserLink(beatmap.captain),
      'CONSISTENT_CAPTAIN': LovedSpreadsheet.singleCaptain(mode),
      'DESCRIPTION': fixCommonMistakes(osuModernLinks(convertToMarkdown(beatmap.description)))
    }));
  }

  beatmapsSections[mode] = postBeatmaps.join('\n\n');

  config.captains[mode] = joinList(config.captains[mode].map((name) => `[${convertToMarkdown(name)}](${getUserLink(name)})`));
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
      captains[mode] = LovedSpreadsheet.singleCaptain(mode);
    }

    return captains;
  })(),
  'ALL_CAPTAINS': config.captains
}) + '\n');

fs.writeFileSync('./storage/user-links.json', JSON.stringify(userLinks, null, 4));
fs.writeFileSync('./storage/beatmapset-links.json', JSON.stringify(beatmapSetLinks, null, 4));
