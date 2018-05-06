const fs = require('fs');
const request = require('sync-request');
const path = require('path');
const { spawn } = require('child_process');

const MODES = ['osu', 'taiko', 'catch', 'mania'];

console.log('Loading configuration files...');

var config = require('./config/config.json');
var newsPostTemplate = fs.readFileSync('./news-post-template.md').toString();
var newsPostTemplateBeatmap = fs.readFileSync('./news-post-template-beatmap.md').toString();
var newsPostHeader = fs.readFileSync('./config/news-post-header.md').toString();
var newsPostIntro = fs.readFileSync('./config/news-post-intro.md').toString();
var newsPostOutro = fs.readFileSync('./config/news-post-outro.md').toString();
var spreadsheets = {};
MODES.forEach(mode => spreadsheets[mode] = fs.readFileSync(`./config/spreadsheet-${mode}.tsv`).toString());

var userLinks = {};
function getUserLink(name) {
  if (userLinks[name]) {
    return userLinks[name];
  }

  console.log(`Fetching user ID of /u/${name}...`);

  var result = request('GET', `https://osu.ppy.sh/users/${name}`, {'followRedirects': false});

  if (result.statusCode == 302) {
    var link = result.headers['location'];

    userLinks[name] = link;
    return link;
  }

  throw `User not found: ${name}`;
}

var beatmapSetLinks = {};
function getBeatmapSetLink(beatmapId) {
  if (beatmapSetLinks[beatmapId]) {
    return beatmapSetLinks[beatmapId];
  }

  console.log(`Fetching beatmap set ID of /b/${beatmapId}...`);

  var result = request('GET', `https://osu.ppy.sh/beatmaps/${beatmapId}`, {'followRedirects': false});

  if (result.statusCode == 302) {
    var link = result.headers['location'].split('#')[0];

    beatmapSetLinks[beatmapId] = link;
    return link;
  }

  throw `Beatmap not found: ${beatmapId}`;
}

function textFromTemplate(template, vars) {
  Object.keys(vars).forEach(function (key) {
    template = template.replace(new RegExp(`%${key}(?:\-(\\w+))?%`, 'gmi'), (match, p1) =>
      p1 ? vars[key][p1] : vars[key]);
  });

  return template;
}

function useAsciiMarks(text) {
  return text
    .replace('‘', "'")
    .replace('’', "'")
    .replace('“', '"')
    .replace('”', '"')
    .replace('…', '...');
}

function osuModernLinks(text) {
  return text.toString()
    .replace(/https\:\/\/osu.ppy.sh\/s\//gmi, 'https://osu.ppy.sh/beatmapsets/')
    .replace(/https\:\/\/osu.ppy.sh\/u\/([0-9]+)/gmi, 'https://osu.ppy.sh/users/$1')
    .replace(/https\:\/\/osu.ppy.sh\/u\/([0-9A-Za-z-_%\[\]]+)/gmi, (match, p1) => getUserLink(p1))
    .replace(/https\:\/\/osu.ppy.sh\/b\/([0-9]+)/gmi, (match, p1) => getBeatmapSetLink(p1));
}

function convertToMarkdown(bbcode) {
  return bbcode.toString()
    .replace(/\[b\]((?:.|\n)+?)\[\/b\]/gmi, '**$1**')
    .replace(/\[\i\]((?:.|\n)+?)\[\/\i\]/gmi, '*$1*')
    .replace(/\[\u\]((?:.|\n)+?)\[\/\u\]/gmi, '$1')
    .replace(/\[s\]((?:.|\n)+?)\[\/s\]/gmi, '~~ $1~~')
    .replace(/\[color\=.+?\]((?:.|\n)+?)\[\/color\]/gmi, '$1')
    .replace(/\[url=(.+?)\]((?:.|\n)+?)\[\/url\]/gmi,'[$2]($1)')

    // osu!-specific
    .replace(/\[profile\]((?:.|\n)+?)\[\/profile\]/gmi, (match, p1) => '[' + p1 + '](' + getUserLink(p1) + ')');
}

function escapeDoubleQuotes(text) {
  return text.toString().replace(/"/g, '\\"');
}

console.log('Generating images...');

var images = fs.readdirSync('./config').filter(x => fs.statSync(path.join('./config', x)).isFile() && path.extname(x) === '.png');

var imageMap = {};

MODES.forEach(function (mode) {
  var spreadsheetLines = spreadsheets[mode].split('\n');

  spreadsheetLines.forEach(function (line, index) {
    var values = line.split('\t');

    var mapSplit = values[1].split(' - ', 2);

    imageMap[values[0]] = [
      mapSplit[0],
      mapSplit[1],
      mapSplit[1].toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      mode,
      values[3]
    ];
  });
});

images.forEach(function (image) {
  var id = image.split('.')[0];

  const process = spawn('sh', [
    './generate-image.sh',
    `./config/${image}`,
    `"${escapeDoubleQuotes(imageMap[id][1])}"`,
    `"${escapeDoubleQuotes(imageMap[id][0])}"`,
    `./output/images/${imageMap[id][3]}/${imageMap[id][2]}.jpg`
  ].concat(imageMap[id][4].split(',').map(x => `"${x}"`)), {shell: true});

  process.on('close', function (code) {
    console.log((code === 0 ? "Generated " : "Failed to generate ") + `${imageMap[id][2]}.jpg`);
  });
});

console.log('Generating news post...');

var titleLowercase = config.title.toLowerCase().replace(/\W+/g, '-');
var beatmapsSections = {};

MODES.forEach(function (mode) {
  var spreadsheetLines = spreadsheets[mode].split('\n');
  var postBeatmaps = [];

  spreadsheetLines.forEach(function (line, index) {
    var values = line.split('\t');

    postBeatmaps.push(textFromTemplate(newsPostTemplateBeatmap, {
      'DATE': config.date,
      'TITLE_LOWER': titleLowercase,
      'MODE': mode,
      'IMAGE': '', //images[mode][index],
      // 'TOPIC_ID': '',
      'BEATMAP': values[1],
      'BEATMAP_ID': values[0],
      'CREATOR': values[3],
      'CREATOR_ID': values[2],
      'CAPTAIN': values[4],
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
  'BEATMAPS': beatmapsSections,
  'OUTRO': newsPostOutro,
}));
