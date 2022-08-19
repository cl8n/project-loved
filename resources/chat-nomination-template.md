Hi! Your map of [{{ARTIST}} - {{TITLE}}](https://osu.ppy.sh/beatmapsets/{{BEATMAPSET_ID}}) is going to be up for voting in the {{ROUND_NAME}} round of Project Loved. <? vars.GAME_MODES != null ? 'Polls' : 'A poll' ?> will be opened {{POLL_START}} to see if the community wants your map Loved.

<?

if (vars.GAME_MODES != null)
    `Your map is being nominated for **{{GAME_MODES}}**. If its polls receive enough "Yes" votes (listed below), it can be moved to the Loved category! Note that even if some modes don't pass the voting, the passing ones can be moved to Loved, and you don't need to delete any difficulties.\n\n{{THRESHOLDS}}`
else
    'Your map is being nominated for **{{GAME_MODE}}**. If its poll receives **{{THRESHOLD}}** or more "Yes" votes, it can be moved to the Loved category!'

?>

<?

if (vars.EXCLUDED_DIFFS != null)
    '{{EXCLUDED_DIFFS}} will be left unranked regardless of the voting.\n\n'

?>Please let me know if your mapset has any guest or collab mappers, so I can message them and credit them properly too.<?

if (vars.GUESTS != null)
    ' I already have **{{GUESTS}}** written down for this map.'

?>

If you **do not** want your map to be put up for Loved voting, let me know and I'll remove it from our list.

Thanks!

About Project Loved: <https://osu.ppy.sh/wiki/Community/Project_Loved>
