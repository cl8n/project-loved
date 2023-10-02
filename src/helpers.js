const { default: chalk } = require('chalk');
const { existsSync, mkdirSync, readFileSync } = require('fs');
const { dirname, join } = require('path');
const { inspect } = require('util');

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
        .replace(/([^\n]|^)\n([^\n]|$)/g, '$1\\\n$2')

        .replace(/(\s|^|\[)_/g, '$1\\_')
        .replace(/_(\s|$|\])/g, '\\_$1')
        .replace(/(?<!\\)\[(.*?[^\\])\](?!\()/g, '\\[$1\\]');
}

function escapeMarkdown(text) {
    return text.toString()
        .replace(/\\/g, '\\\\')
        .replace(/\*/g, '\\*')
        .replace(/\[(.+?)\]\(/g, '\\[$1\\](')
        .replace(/~/g, '\\~')
        .replace(/(\s|^|\[)_/g, '$1\\_')
        .replace(/_(\s|$|\])/g, '\\_$1')
        .replace(/(?<!\\)\[(.*?[^\\])\](?!\()/g, '\\[$1\\]');
}

function expandBbcodeRootLinks(text) {
    return text.toString()
        .replace(/\[url=\/([^\]]+)\]/g, '[url=https://osu.ppy.sh/$1]');
}

function formatPercent(number) {
    return (number * 100).toFixed(2) + '%';
}

function joinList(array) {
    return array.length < 3
        ? array.join(' and ')
        : array.slice(0, -1).join(', ') + ', and ' + array.at(-1);
}

function loadTextResource(basename) {
    return readFileSync(join(__dirname, '../resources', basename), 'utf8');
}

function logAndExit(error) {
    let errorMessage = 'Error occurred';

    if (typeof error === 'string') {
        errorMessage = error;
    } else if (error instanceof Error) {
        errorMessage = error.message ? inspect(error) : null;
    }

    if (errorMessage != null) {
        console.error(chalk.red(errorMessage));
    }

    process.exit(1);
}

function maxOf(array, key) {
    const reducer = (prev, curr) => prev[key] > curr[key] ? prev : curr;

    return array.reduce(reducer)[key];
}

function minOf(array, key) {
    const reducer = (prev, curr) => prev[key] < curr[key] ? prev : curr;

    return array.reduce(reducer)[key];
}

function mkdirTreeSync(dir) {
    if (existsSync(dir))
        return;

    try {
        mkdirSync(dir);
    } catch (error) {
        if (error.code === 'ENOENT') {
            mkdirTreeSync(dirname(dir));
            mkdirTreeSync(dir);
        } else
            throw error;
    }
}

function pushUnique(array, values, sameFn) {
    for (const value of values)
        if (array.find((value2) => sameFn(value, value2)) == null)
            array.push(value);
}

function textFromTemplate(template, vars) {
    return template
        .replace(/<\?(.+?)\?>/gs, (_, script) => {
            let result = eval(script);

            return result == null ? '' : result;
        })
        .replace(/{{(.+?)}}/g, (match, key) => vars[key] == null ? match : vars[key])
        .trim();
}

function videoHtml(videoIdOrLink) {
    if (typeof videoIdOrLink !== 'string') {
        return null;
    }

    // MP4 video link
    if (videoIdOrLink.startsWith('http')) {
        return [
            '<div align="center">',
            '  <video width="95%" controls>',
            `    <source src="${videoIdOrLink}" type="video/mp4" preload="none">`,
            '  </video>',
            '</div>',
        ].join('\n');
    }

    // YouTube video ID
    return `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoIdOrLink}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
}

module.exports = {
    convertToMarkdown,
    escapeMarkdown,
    expandBbcodeRootLinks,
    formatPercent,
    joinList,
    loadTextResource,
    logAndExit,
    maxOf,
    minOf,
    mkdirTreeSync,
    pushUnique,
    textFromTemplate,
    videoHtml,
};
