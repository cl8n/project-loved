## <a id="{{MODE_SHORT}}"></a>{{MODE_LONG}}<?
if (vars.VIDEO) {
`

<iframe width="100%" height="400" src="https://www.youtube.com/embed/${vars.VIDEO}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
} ?>

{{MODE_LONG}} Loved candidates were chosen by {{ALL_CAPTAINS}}!<?
if (vars.CONSISTENT_CAPTAINS && vars.CONSISTENT_CAPTAINS !== 'Captain') {
` This round, all ${vars.MODE_LONG} beatmap descriptions were written by [${vars.CONSISTENT_CAPTAINS}](${getUserLink(vars.CONSISTENT_CAPTAINS)}).`
} ?>

---

{{BEATMAPS}}
