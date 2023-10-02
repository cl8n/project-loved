import '../src/force-color.js';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import chalk from 'chalk';

mkdirSync('config', { recursive: true });

if (!existsSync('config/config.json'))
  copyFileSync('resources/config.example.json', 'config/config.json');

console.log(chalk.green('Setup complete'));
