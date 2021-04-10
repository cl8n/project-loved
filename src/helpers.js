const { existsSync, mkdirSync, readFileSync } = require('fs');
const { dirname, join } = require('path');

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

function escapeHtml(text) {
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

function getExcludedDiffNames(beatmapset, nomination) {
    const excludedDiffNames = [];

    beatmapset.forEach((beatmap) => {
        if (nomination.excludedBeatmaps.includes(parseInt(beatmap.beatmap_id)))
            excludedDiffNames.push(`[${beatmap.version}]`);
    });

    return excludedDiffNames;
}

function joinList(array) {
    if (array.length === 0)
        throw new Error('List must not be empty');

    let line = array[0];

    for (let i = 1; i < array.length; i++)
        line += i === array.length - 1
          ? ` and ${array[i]}`
          : `, ${array[i]}`;

    return line;
}

function loadTextResource(basename) {
    return readFileSync(join(__dirname, '../resources', basename), 'utf8');
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

module.exports = {
    convertToMarkdown,
    escapeHtml,
    escapeMarkdown,
    getExcludedDiffNames,
    joinList,
    loadTextResource,
    maxOf,
    minOf,
    mkdirTreeSync,
    pushUnique,
    textFromTemplate,
};
