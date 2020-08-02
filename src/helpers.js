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

function getUserLink(name) {
    const user = OsuApi.getUser(name, true);

    return `https://osu.ppy.sh/users/${user.user_id}`;
}

function joinList(array) {
    if (array.length === 0)
        throw new Error('List must not be empty');

    let line = array[0];

    for (let i = 1; i < array.length; i++)
        if (i === array.length - 1)
            if (array[i].includes('et al.'))
                line += ' et al.';
            else
                line += ` and ${array[i]}`;
        else
            line += `, ${array[i]}`;

    return line;
}

function mkdirTreeSync(dir) {
    if (fs.existsSync(dir))
        return;

    try {
        fs.mkdirSync(dir);
    } catch (error) {
        if (error.code === 'ENOENT') {
            mkdirTreeSync(path.dirname(dir));
            mkdirTreeSync(dir);
        } else
            throw error;
    }
}

function textFromTemplate(template, vars) {
    return template
        .replace(/<\?(.+?)\?>/gs, (_, script) => {
            let result = eval(script);

            return result === undefined || result === null ? '' : result;
        })
        .replace(/{{(.+?)}}/g, (match, key) => vars[key] === undefined ? match : vars[key])
        .trim();
}

module.exports = {
    convertToMarkdown,
    escapeHtml,
    getUserLink,
    joinList,
    mkdirTreeSync,
    textFromTemplate
};
