import { readFile } from 'node:fs/promises';
import chalk from 'chalk';

const config = JSON.parse(await readFile('config/config.json', 'utf8'));
const defaultConfig = JSON.parse(await readFile('resources/info.json', 'utf8'));

let errors = '';
const expected = [
	'apiClient',
	'bannerTitleOverrides',
	'cloudflare',
	'csrf',
	'lovedApiKey',
	'lovedBaseUrl',
	'lovedRoundId',
	'osuBaseUrl',
	'pollStartGuess',
	'session',
	'userAgent',
];
const moved = { lovedShInterOpKey: 'lovedApiKey' };
const unused = [
	'captains',
	'csrfOld',
	'date',
	'discord',
	'month',
	'osuApiKey',
	'resultsPost',
	'sessionOld',
	'time',
	'title',
	'username',
	'videos',
];

function addError(message) {
	errors += `  ${message}\n`;
}

for (const configKey of Object.keys(config)) {
	if (unused.includes(configKey)) {
		addError(chalk.yellow(`"${configKey}" is no longer used`));
	} else if (moved[configKey] != null) {
		addError(chalk.yellow(`"${configKey}" has been renamed to "${moved[configKey]}"`));
	} else if (!expected.includes(configKey)) {
		addError(chalk.red(`Unrecognized option "${configKey}"`));
	}
}

for (const expectedKey of expected) {
	if (config[expectedKey] == null) {
		addError(chalk.red(`"${expectedKey}" is missing`));
	}
}

if (
	config.bannerTitleOverrides == null ||
	typeof config.bannerTitleOverrides !== 'object' ||
	Object.values(config.bannerTitleOverrides).some((title) => typeof title !== 'string')
) {
	addError(chalk.red('Invalid format for bannerTitleOverrides (map of beatmapset IDs to titles)'));
}

if (errors.length > 0) {
	process.stderr.write('Errors in config:\n' + errors);
	process.exit(1);
}

config.lovedBaseUrl = config.lovedBaseUrl.replace(/\/+$/, '');
config.osuBaseUrl = config.osuBaseUrl.replace(/\/+$/, '');

export default { ...defaultConfig, ...config };
