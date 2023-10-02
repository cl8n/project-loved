#!/usr/bin/env node

import '../src/force-color.js';
import chalk from 'chalk';
import { revokeChatAccessToken, sendChatAnnouncement, setChatAccessToken } from '../src/chat.js';
import config from '../src/config.js';
import Discord from '../src/Discord.js';
import Forum from '../src/forum.js';
import Ruleset from '../src/Ruleset.js';
import { escapeMarkdown, formatPercent, joinList, logAndExit } from '../src/helpers.js';
import LovedWeb from '../src/LovedWeb.js';

const lovedWeb = new LovedWeb(config.lovedApiKey);
let roundInfo = await lovedWeb.getRoundInfo(config.lovedRoundId);

const now = new Date();
for (const nomination of roundInfo.allNominations) {
  if (nomination.poll == null || new Date(nomination.poll.ended_at) > now) {
    logAndExit('Polls are not yet complete');
  }

  if (nomination.poll.result_no != null || nomination.poll.result_yes != null) {
    logAndExit('Poll results have already been stored');
  }
}

let error = false;
const gameModesPresent = [];
const mainTopicIds = await Forum.getModeTopics(120);

for (const gameMode of Ruleset.all()) {
  const gameModeHasNominations = roundInfo.allNominations.some(
    (nomination) => nomination.game_mode.id === gameMode.id,
  );

  if ((mainTopicIds[gameMode.id] != null) !== gameModeHasNominations) {
    console.error(chalk.red(`Nominations and main topics do not agree about ${gameMode.longName}'s presence`));
    error = true;
  }

  if (gameModeHasNominations) {
    gameModesPresent.push(gameMode);
  }
}

if (error) {
  process.exit(1);
}

console.log('Locking and unpinning topics');

const lockAndUnpinPromises = [];

for (const nomination of roundInfo.allNominations) {
  lockAndUnpinPromises.push(Forum.lockTopic(nomination.poll.topic_id));
}

for (const gameMode of gameModesPresent) {
  lockAndUnpinPromises.push(Forum.lockTopic(mainTopicIds[gameMode.id]));
  lockAndUnpinPromises.push(Forum.pinTopic(mainTopicIds[gameMode.id], false));
}

await Promise.all(lockAndUnpinPromises);

console.log('Saving poll results');

await lovedWeb.postResults(config.lovedRoundId, mainTopicIds);

console.log('Posting announcements to Discord');

const passedVotingCreatorIds = new Set();
roundInfo = await lovedWeb.getRoundInfo(config.lovedRoundId);

for (const gameMode of gameModesPresent) {
  const nominations = roundInfo.allNominations
    .filter((nomination) => nomination.game_mode.id === gameMode.id);
  const threshold = roundInfo.extraGameModeInfo[gameMode.id].threshold;

  for (const nomination of nominations) {
    nomination.poll.yesRatio = nomination.poll.result_yes
      / (nomination.poll.result_no + nomination.poll.result_yes);
    nomination.poll.passed = nomination.poll.yesRatio >= threshold;

    if (nomination.poll.passed) {
      for (const creator of nomination.beatmapset_creators) {
        if (!creator.banned) {
          passedVotingCreatorIds.add(creator.id);
        }
      }
    }
  }

  const discordWebhook = roundInfo.discordWebhooks[gameMode.id];

  if (discordWebhook == null) {
    continue;
  }

  await new Discord(discordWebhook).post(
    `Project Loved: ${gameMode.longName}`,
    config.messages.discordResults,
    nominations
      .sort((a, b) => +b.poll.passed - +a.poll.passed)
      .map((nomination) => {
        const artistAndTitle = escapeMarkdown(
          `${nomination.beatmapset.artist} - ${nomination.beatmapset.title}`,
        );
        const creators = joinList(
          nomination.beatmapset_creators.map((creator) => escapeMarkdown(creator.name)),
        );

        return {
          color: nomination.poll.passed ? 0x22dd22 : 0xdd2222,
          description: `${formatPercent(nomination.poll.yesRatio)} - ${nomination.poll.result_yes}:${nomination.poll.result_no}`,
          title: `**${artistAndTitle}** by ${creators}`,
          url: `https://osu.ppy.sh/beatmapsets/${nomination.beatmapset.id}#${nomination.game_mode.linkName}`,
        };
      }),
  );
}

console.log('Sending chat announcement to mappers of passed votings');

await setChatAccessToken();
await sendChatAnnouncement(
  [...passedVotingCreatorIds],
  'Project Loved result',
  'Your map passed Loved voting!',
  'Congratulations, your map passed voting in the last round of Project Loved! It will be moved to the Loved category soon.',
);
await revokeChatAccessToken();

console.log('Removing watches from topics');

const watchPromises = [];

for (const nomination of roundInfo.allNominations) {
  watchPromises.push(Forum.watchTopic(nomination.poll.topic_id, false));
}

for (const gameMode of gameModesPresent) {
  watchPromises.push(Forum.watchTopic(mainTopicIds[gameMode.id], false));
}

await Promise.all(watchPromises);
