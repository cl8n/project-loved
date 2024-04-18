import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import chalk from 'chalk';

const updateCachePath = 'config/update-cache';

export default async function tryUpdate(force = false) {
	// Don't check for updates more than once every 6 hours
	if (!force) {
		const updateCache = await readFile(updateCachePath, 'utf8').catch(() => '0');
		const lastUpdateTime = parseInt(updateCache, 10);

		if (
			!Number.isNaN(lastUpdateTime) &&
			Date.now() - lastUpdateTime < 1000 * 60 * 60 * 6
		) {
			return;
		}
	}

	// Check execute permission for git and npm
	if (
		spawnSync('git', ['--version']).error != null ||
		spawnSync('npm', ['--version']).error != null
	) {
		console.error(chalk.yellow('Skipping update check: missing git or npm'));
		return;
	}

	// Check repository status
	if (spawnSync('git', ['branch', '--show-current']).stdout.toString().trim() !== 'master') {
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

		console.error(chalk.dim(`Updated to ${spawnSync('git', ['show', '--format=%h', '--no-patch', 'HEAD']).stdout.toString().trim()}`));

		spawnSync('npm', ['install'], { stdio: 'ignore' });

		console.error(chalk.dim('Installed/upgraded node packages'));
	} else {
		console.error(chalk.dim('No update found'));
	}

	// Save last update time
	await writeFile(updateCachePath, `${Date.now()}\n`);

	// Restart program
	if (update) {
		console.error(chalk.dim.yellow('Restarting...'));

		spawnSync(process.argv[0], process.argv.slice(1), { stdio: 'inherit' });
		process.exit();
	}
}
