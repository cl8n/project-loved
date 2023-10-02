#!/usr/bin/env node

import '../src/force-color.js';
import { constants, copyFile, mkdir, writeFile } from 'node:fs/promises';
import chalk from 'chalk';

await mkdir('config', { recursive: true });

await writeFile('config/banner-cache.json', '{}\n', { flag: 'wx' })
	.then(() => console.error(chalk.green('Created banner cache')))
	.catch(() => console.error(chalk.yellow('Banner cache already exists')));

await copyFile('resources/config.example.json', 'config/config.json', constants.COPYFILE_EXCL)
	.then(() => console.error(chalk.green('Created config from default config')))
	.catch(() => console.error(chalk.yellow('Config already exists')));

console.error(chalk.green('Setup complete'));
