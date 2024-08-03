import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { platform } from 'node:process';
import chalk from 'chalk';
import superagent from 'superagent';

const jpegRecompressPath = 'config/jpeg-recompress';
const jpegRecompressUrl = `https://loved.sh/local-interop/jpeg-recompress-${platform}`;
const updateCachePath = 'config/update-cache';

function installJpegRecompress() {
	if (existsSync(jpegRecompressPath)) {
		return;
	}

	console.error(chalk.dim(`Downloading jpeg-recompress... (${jpegRecompressUrl})`));

	return new Promise((resolve, reject) => {
		superagent
			.get(jpegRecompressUrl)
			.on('error', reject)
			.on('end', () => {
				console.error(chalk.dim.green(`Installed jpeg-recompress to ${jpegRecompressPath}`));
				resolve();
			})
			.pipe(createWriteStream(jpegRecompressPath, { mode: 0o755 }));
	});
}

export default async function tryUpdate(force = false) {
	await installJpegRecompress();

	// Don't check for updates more than once every 6 hours
	if (!force) {
		const updateCache = await readFile(updateCachePath, 'utf8').catch(() => '0');
		const lastUpdateTime = parseInt(updateCache, 10);

		if (!Number.isNaN(lastUpdateTime) && Date.now() - lastUpdateTime < 1000 * 60 * 60 * 6) {
			return;
		}
	}

	// Check execute permission for git and npm
	if (
		spawnSync('git', ['--version']).error != null ||
		// This and further npm commands go through a shell because Windows cannot
		// properly spawn npm.cmd due to a security patch in node
		// <https://github.com/nodejs/node/issues/3675>
		// <https://github.com/nodejs/node/issues/52554>
		spawnSync('npm', ['--version'], { shell: platform === 'win32' }).error != null
	) {
		console.error(chalk.yellow('Skipping update check: missing git or npm'));
		return;
	}

	// Check repository status
	if (spawnSync('git', ['symbolic-ref', '--short', 'HEAD']).stdout.toString().trim() !== 'master') {
		console.error(chalk.yellow('Skipping update check: branch not set to master'));
		return;
	}

	if (spawnSync('git', ['diff', '--quiet']).status !== 0) {
		console.error(chalk.yellow('Skipping update check: working directory not clean'));
		return;
	}

	// Check for and apply updates
	console.error(chalk.dim('Checking for updates'));

	spawnSync('git', ['fetch', '--quiet']);
	const update = spawnSync('git', ['diff', '--quiet', '..FETCH_HEAD']).status === 1;

	if (update) {
		spawnSync('git', ['merge', '--ff-only', '--quiet', 'FETCH_HEAD']);

		console.error(
			chalk.dim.green(
				`Updated to ${spawnSync('git', ['show', '--format=%h', '--no-patch', 'HEAD']).stdout.toString().trim()}`,
			),
		);

		spawnSync('npm', ['install'], { shell: platform === 'win32', stdio: 'ignore' });

		console.error(chalk.dim.green('Installed/upgraded node packages'));
	} else {
		console.error(chalk.dim('No update found'));
	}

	// Save last update time
	await writeFile(updateCachePath, `${Date.now()}\n`);

	// Restart program
	if (update) {
		console.error(chalk.dim.yellow('Restarting...\n'));

		spawnSync(process.argv[0], process.argv.slice(1), { stdio: 'inherit' });
		process.exit();
	}
}
