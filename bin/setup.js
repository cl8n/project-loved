#!/usr/bin/env node

import '../src/force-color.js';
import { constants, copyFile, mkdir } from 'node:fs/promises';
import chalk from 'chalk';

await mkdir('config', { recursive: true });

await copyFile('resources/config.example.json', 'config/config.json', constants.COPYFILE_EXCL)
	.then(() => console.error(chalk.green('Created config from default config')))
	.catch(() => console.error(chalk.yellow('Config already exists')));

console.error(chalk.green('Setup complete'));
