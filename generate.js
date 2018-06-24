const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const request = require('sync-request');

const MODES = ['osu', 'taiko', 'catch', 'mania'];

console.log('Loading configuration files...');

const config = require('./config/config.json');
const newsPostTemplate = fs.readFileSync('./news-post-template.md').toString();
const newsPostTemplateBeatmap = fs.readFileSync('./news-post-template-beatmap.md').toString();
const newsPostHeader = textFromTemplate(fs.readFileSync('./config/news-post-header.md').toString());
const newsPostIntro = textFromTemplate(fs.readFileSync('./config/news-post-intro.md').toString());
const spreadsheets = {};
MODES.forEach(mode => spreadsheets[mode] = fs.readFileSync(`./config/spreadsheet-${mode}.tsv`).toString());

console.log('Launching puppeteer')

const browserPromise = puppeteer.launch();

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
    page.$eval('#title', (el, title) => el.innerHTML = title, title),
    page.$eval('#artist', (el, artist) => el.innerHTML = artist, artist),
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

const userLinks = {};
function getUserLink(name) {
  if (userLinks[name]) {
    return userLinks[name];
  }

  console.log(`Fetching user ID of /u/${name}...`);

  const result = request('GET', `https://osu.ppy.sh/users/${name}`, {'followRedirects': false});

  if (result.statusCode == 302) {
    const link = result.headers['location'];

    userLinks[name] = link;
    return link;
  }

  throw `User not found: ${name}`;
}

const beatmapSetLinks = {};
function getBeatmapSetLink(beatmapId) {
  if (beatmapSetLinks[beatmapId]) {
    return beatmapSetLinks[beatmapId];
  }

  console.log(`Fetching beatmap set ID of /b/${beatmapId}...`);

  const result = request('GET', `https://osu.ppy.sh/beatmaps/${beatmapId}`, {'followRedirects': false});

  if (result.statusCode == 302) {
    const link = result.headers['location'].split('#')[0];

    beatmapSetLinks[beatmapId] = link;
    return link;
  }

  throw `Beatmap not found: ${beatmapId}`;
}

function textFromTemplate(template, vars = {}) {
  template = template.replace(/%#IF (\w+)%\n(.+?)\n%#ENDIF%\n/gs,
    (match, key, content) => vars[key] ? content + '\n' : '');

  Object.keys(vars).forEach(function (key) {
    template = template.replace(new RegExp(`%${key}(?:-(\\w+))?%`, 'gmi'),
	  (match, p1) => p1 ? vars[key][p1] : vars[key]);
  });

  return template.trim();
}

function useAsciiMarks(text) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...');
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
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')

    // general bbcode
    .replace(/\[b\](.+?)\[\/b\]/gs, '**$1**')
    .replace(/\[\i\](.+?)\[\/\i\]/gs, '*$1*')
    .replace(/\[\u\](.+?)\[\/\u\]/gs, '$1')
    .replace(/\[s\](.+?)\[\/s\]/gs, '~~$1~~')
    .replace(/\[color\=.+?\](.+?)\[\/color\]/gs, '$1')
    .replace(/\[url=(.+?)\](.+?)\[\/url\]/gs, '[$2]($1)')

    // osu!-specific bbcode
    .replace(/\[profile\](.+?)\[\/profile\]/g, (match, p1) => '[' + p1 + '](' + getUserLink(p1) + ')');
}

function escapeDoubleQuotes(text) {
  return text.toString().replace(/"/g, '\\"');
}

console.log('Generating images...');

const imageMap = {};

MODES.forEach(function (mode) {
  const spreadsheetLines = spreadsheets[mode].split('\n');

  spreadsheetLines.forEach(function (line, index) {
    if (!line.replace(/\s/g, '').length) {
      return;
    }

    const values = line.split('\t');
    const mapSplit = values[1].split(' - ', 2);

    imageMap[values[0]] = {
      artist: mapSplit[0],
      title: mapSplit[1],
      filename: `${mapSplit[1].toLowerCase().replace(/[^a-z0-9]+/g, '-')}.jpg`,
      mode: mode,
      creators: values[3].split(',')
    };
  });
});

const images = fs.readdirSync('./config')
  .filter(x => fs.statSync(path.join('./config', x)).isFile()
            && (path.extname(x) === '.png' || path.extname(x) === '.jpg'));

browserPromise
  .then(function (browser) {
    images.forEach(function (image) {
      const id = image.split('.')[0];

      let beatmap = imageMap[id];

      if (beatmap === undefined) {
        console.log(`Could not find beatmapset with ID ${id}; skipping`);
        return;
      }

      generateImage(
        browser,
        `file://${__dirname.replace(/\\/g, '/')}/config/${image}`,
        beatmap.title,
        beatmap.artist,
        beatmap.creators,
        `./temp/${beatmap.mode}/${beatmap.filename}`
      )
        .then(() => console.log(`Generated ${beatmap.filename} successfully`))
        .catch(() => console.log(`Failed to generate ${beatmap.filename}`));
    })
  });

console.log('Generating news post...');

const titleLowercase = config.title.toLowerCase().replace(/\W+/g, '-');
const beatmapsSections = {};

MODES.forEach(function (mode) {
  const spreadsheetLines = spreadsheets[mode].split('\n');
  const postBeatmaps = [];

  spreadsheetLines.forEach(function (line, index) {
    if (!line.replace(/\s/g, '').length) {
      return;
    }

    const values = line.split('\t');

    // TODO: this logic is duplicated in generate-image.sh

    const creators = values[3].split(',');
    let creatorsMd = `[${convertToMarkdown(creators[0])}](https://osu.ppy.sh/users/${values[2]})`;

    for (let i = 1; i < creators.length; i++) {
      if (i == creators.length - 1) {
        if (creators[i] == 'et al.') {
          creatorsMd += ' et al.';
        } else {
          creatorsMd += ` and [${convertToMarkdown(creators[i])}](${getUserLink(creators[i])})`;
        }
      } else {
        creatorsMd += `, [${convertToMarkdown(creators[i])}](${getUserLink(creators[i])})`;
      }
    }

    postBeatmaps.push(textFromTemplate(newsPostTemplateBeatmap, {
      'DATE': config.date,
      'TITLE_LOWER': titleLowercase,
      'MODE': mode,
      'IMAGE': imageMap[values[0]].filename,
      // 'TOPIC_ID': '',
      'BEATMAP': convertToMarkdown(values[1]),
      'BEATMAP_ID': values[0],
      'CREATORS_MD': creatorsMd,
      'CAPTAIN': convertToMarkdown(values[4]),
      'CAPTAIN_LINK': getUserLink(values[4]),
      'DESCRIPTION': useAsciiMarks(osuModernLinks(convertToMarkdown(values[5])))
    }));
  });

  beatmapsSections[mode] = postBeatmaps.join('\n\n');
});

fs.writeFileSync(`./output/${config.date}-${titleLowercase}.md`, textFromTemplate(newsPostTemplate, {
  'TITLE': config.title,
  'DATE': config.date,
  'TIME': config.time,
  'HEADER': newsPostHeader,
  'INTRO': newsPostIntro,
  'VIDEO': config.videos,
  'INCLUDE_VIDEO': Object.keys(config.videos).length > 0,
  'BEATMAPS': beatmapsSections
}) + '\n');
