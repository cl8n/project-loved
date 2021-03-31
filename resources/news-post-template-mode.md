## <a id="{{MODE_SHORT}}"></a>{{MODE_LONG}}<?
if (vars.VIDEO) {
`

<iframe width="100%" height="400" src="https://www.youtube.com/embed/${vars.VIDEO}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
} ?>

{{MODE_LONG}} Loved candidates were chosen by {{ALL_CAPTAINS}}!<?
if (vars.CONSISTENT_CAPTAIN != null) {
` This round, all ${vars.MODE_LONG} beatmap descriptions were written by [${vars.CONSISTENT_CAPTAIN}](https://osu.ppy.sh/users/${vars.CONSISTENT_CAPTAIN_ID}).`
} ?>

---

{{NOMINATIONS}}
