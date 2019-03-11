[![](/wiki/shared/news/<? vars.FOLDER ?>/<? vars.MODE ?>/<? vars.IMAGE ?>)](https://osu.ppy.sh/community/forums/topics/<? vars.TOPIC_ID || 'FORUM_TOPIC_ID' ?>)

[<? vars.BEATMAP ?>](https://osu.ppy.sh/beatmapsets/<? vars.BEATMAP_ID ?>#<? vars.LINK_MODE ?>) by <? vars.CREATORS_MD ?>  
<? vars.BEATMAP_EXTRAS ?><?
if (!vars.CONSISTENT_CAPTAIN) {
`  
*written by [${vars.CAPTAIN}](${vars.CAPTAIN_LINK})*`
} ?>

<? vars.DESCRIPTION ?>
