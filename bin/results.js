require('../src/force-color');
const { red } = require('chalk');
const config = require('../src/config');
const Discord = require('../src/discord');
const Forum = require('../src/forum');
const GameMode = require('../src/gamemode');
const { escapeMarkdown, joinList, loadTextResource, textFromTemplate } = require('../src/helpers');
const LovedWeb = require('../src/LovedWeb');

const keepWatches = process.argv.includes('--keep-watches', 2);
const resultsPostTemplate = loadTextResource('results-post-template.bbcode');

function mapResultsToText(nomination) {
  const artistAndTitle = `${nomination.beatmapset.artist} - ${nomination.beatmapset.title}`;
  const color = nomination.passed ? '#22DD22' : '#DD2222';
  const creators = joinList(nomination.beatmapset_creators.map((c) => c.id >= 4294000000 ? c.name : `[url=https://osu.ppy.sh/users/${c.id}]${c.name}[/url]`));

  return `[b][color=${color}]${nomination.pollResult.percent}%[/color][/b] (${nomination.pollResult.yes}:${nomination.pollResult.no})`
    + ` - [b][url=https://osu.ppy.sh/beatmapsets/${nomination.beatmapset.id}#${nomination.game_mode.linkName}]${artistAndTitle}[/url][/b]`
    + ` by ${creators}`;
}

function mapResultsToEmbed(nomination) {
  const artistAndTitle = escapeMarkdown(`${nomination.beatmapset.artist} - ${nomination.beatmapset.title}`);
  const creators = joinList(nomination.beatmapset_creators.map((c) => escapeMarkdown(c.name)));

  return {
    color: nomination.passed ? 2284834 : 14492194,
    description: `${nomination.pollResult.percent}% - ${nomination.pollResult.yes}:${nomination.pollResult.no}`,
    title: `**${artistAndTitle}** by ${creators}`,
    url: `https://osu.ppy.sh/beatmapsets/${nomination.beatmapset.id}#${nomination.game_mode.linkName}`,
  };
}

(async function () {
  console.log('Preparing to post results');

  const lovedWeb = new LovedWeb(config.lovedApiKey);
  const { allNominations, discordWebhooks, extraGameModeInfo } = await lovedWeb.getRoundInfo(config.lovedRoundId);
  const mainTopics = await Forum.getModeTopics(120);
  const gameModes = GameMode.modes().filter((gameMode) => mainTopics[gameMode.integer] != null).reverse();
  let error = false;

  for (const gameMode of GameMode.modes()) {
    if (
      (mainTopics[gameMode.integer] == null) !==
      (allNominations.filter((n) => n.game_mode.integer === gameMode.integer).length === 0)
    ) {
      console.error(red(`Nominations and main topics do not agree about ${gameMode.longName}'s presence`));
      error = true;
    }
  }

  for (const nomination of allNominations) {
    if (nomination.poll == null) {
      console.error(red(`Nomination #${nomination.id} does not have a poll`));
      error = true;
    }
  }

  if (error) {
    process.exit(1);
  }

  console.log(`Locking topics${keepWatches ? '' : ' and removing watches'}`);

  const lockPromises = gameModes.map((gameMode) => Forum.lockTopic(mainTopics[gameMode.integer]));

  for (const nomination of allNominations) {
    lockPromises.push(Forum.lockTopic(nomination.poll.topic_id));
  }

  if (!keepWatches) {
    for (const gameMode of gameModes) {
      lockPromises.push(Forum.watchTopic(mainTopics[gameMode.integer], false));
    }

    for (const nomination of allNominations) {
      lockPromises.push(Forum.watchTopic(nomination.poll.topic_id, false));
    }
  }

  await Promise.all(lockPromises);

  console.log('Unpinning main topics');

  await Promise.all(gameModes.map((gameMode) => Forum.pinTopic(mainTopics[gameMode.integer], false)));

  console.log('Replying to topics');

  const discordPostArguments = {};
  const mainTopicReplies = {};
  const mainTopicReplyIds = {};

  for (const gameMode of gameModes) {
    const extraInfo = extraGameModeInfo[gameMode.integer];
    const nominations = allNominations.filter((n) => n.game_mode.integer === gameMode.integer);

    for (const nomination of nominations.slice().reverse()) {
      const pollResult = await Forum.getPollResult(nomination.poll.topic_id);

      nomination.passed = parseFloat(pollResult.percent) >= extraInfo.threshold * 100;
      nomination.pollResult = pollResult;

      await Forum.reply(
        nomination.poll.topic_id,
        nomination.passed ? config.messages.resultsPassed : config.messages.resultsFailed,
      );
    }

    const failedNominations = nominations.filter((n) => !n.passed);
    const passedNominations = nominations.filter((n) => n.passed);

    discordPostArguments[gameMode.integer] = [
      `Project Loved: ${gameMode.longName}`,
      config.messages.discordResults,
      [
        ...passedNominations.map(mapResultsToEmbed),
        ...failedNominations.map(mapResultsToEmbed),
      ],
    ];
    mainTopicReplies[gameMode.integer] = textFromTemplate(resultsPostTemplate, {
      FAILED_BEATMAPSETS: failedNominations.map(mapResultsToText).join('\n'),
      PASSED_BEATMAPSETS: passedNominations.map(mapResultsToText).join('\n'),
      THRESHOLD: extraInfo.thresholdFormatted,
    });
  }

  for (const gameMode of gameModes) {
    mainTopicReplyIds[gameMode.integer] = await Forum.reply(mainTopics[gameMode.integer], mainTopicReplies[gameMode.integer]);
  }

  console.log('Posting announcements to Discord');

  for (const gameMode of gameModes) {
    if (discordWebhooks[gameMode.integer] != null) {
      await new Discord(discordWebhooks[gameMode.integer]).post(...discordPostArguments[gameMode.integer]);
    }
  }

  console.log('Submitting poll results to loved.sh');

  await lovedWeb.updatePollsWithResults(
    allNominations.map((nomination) => ({
      id: nomination.poll.id,
      no: nomination.pollResult.no,
      yes: nomination.pollResult.yes,
    })),
  );

  console.log('Submitting results posts to loved.sh');

  await lovedWeb.updateResultsPosts(config.lovedRoundId, mainTopicReplyIds);
})();
