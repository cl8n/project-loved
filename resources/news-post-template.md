---
layout: post
title: "<? vars.TITLE ?>"
date: <? vars.DATE ?> <? vars.TIME ?> +0000
---

<? vars.HEADER ?>

![](/wiki/shared/news/banners/project-loved.jpg)

<? vars.INTRO ?><?
if (vars.VIDEO.intro) {
`

<iframe width="100%" height="400" src="https://www.youtube.com/embed/${vars.VIDEO.intro}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
} ?>

### Navigation

- [osu!](#osu)
- [osu!taiko](#osutaiko)
- [osu!catch](#osucatch)
- [osu!mania](#osumania)

## <a name="osu" id="osu"></a>osu!<?
if (vars.VIDEO.osu) {
`

<iframe width="100%" height="400" src="https://www.youtube.com/embed/${vars.VIDEO.osu}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
} ?>

osu! Loved candidates were chosen by <? vars.ALL_CAPTAINS.osu ?>!<?
if (vars.CONSISTENT_CAPTAINS.osu) {
` This week, all osu! beatmap descriptions were written by [${vars.CONSISTENT_CAPTAINS.osu}](${getUserLink(vars.CONSISTENT_CAPTAINS.osu)}).`
} ?>

---

<? vars.BEATMAPS.osu ?>

## <a name="osutaiko" id="osutaiko"></a>osu!taiko<?
if (vars.VIDEO.taiko) {
`

<iframe width="100%" height="400" src="https://www.youtube.com/embed/${vars.VIDEO.taiko}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
} ?>

osu!taiko Loved candidates were chosen by <? vars.ALL_CAPTAINS.taiko ?>!<?
if (vars.CONSISTENT_CAPTAINS.taiko) {
` This week, all osu!taiko beatmap descriptions were written by [${vars.CONSISTENT_CAPTAINS.taiko}](${getUserLink(vars.CONSISTENT_CAPTAINS.taiko)}).`
} ?>

---

<? vars.BEATMAPS.taiko ?>

## <a name="osucatch" id="osucatch"></a>osu!catch<?
if (vars.VIDEO.catch) {
`

<iframe width="100%" height="400" src="https://www.youtube.com/embed/${vars.VIDEO.catch}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
} ?>

osu!catch Loved candidates were chosen by <? vars.ALL_CAPTAINS.catch ?>!<?
if (vars.CONSISTENT_CAPTAINS.catch) {
` This week, all osu!catch beatmap descriptions were written by [${vars.CONSISTENT_CAPTAINS.catch}](${getUserLink(vars.CONSISTENT_CAPTAINS.catch)}).`
} ?>

---

<? vars.BEATMAPS.catch ?>

## <a name="osumania" id="osumania"></a>osu!mania<?
if (vars.VIDEO.mania) {
`

<iframe width="100%" height="400" src="https://www.youtube.com/embed/${vars.VIDEO.mania}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
} ?>

osu!mania Loved candidates were chosen by <? vars.ALL_CAPTAINS.mania ?>!<?
if (vars.CONSISTENT_CAPTAINS.mania && vars.CONSISTENT_CAPTAINS.mania !== 'Captain') {
` This week, all osu!mania beatmap descriptions were written by [${vars.CONSISTENT_CAPTAINS.mania}](${getUserLink(vars.CONSISTENT_CAPTAINS.mania)}).`
} ?>

---

<? vars.BEATMAPS.mania ?>

---

From everyone on the Project Loved team, we hope you enjoyed this week's selection, and are looking forward to the next! The winning beatmaps will hit the [Loved beatmap listing](https://osu.ppy.sh/beatmapsets?s=8) sometime next week and will be announced via [@osugame on Twitter](https://twitter.com/osugame).

In addition to all of the Loved captains that choose the maps and write the descriptions, make sure to thank <? vars.HELPERS ?> for their miscellaneous help in managing Project Loved.

If you have any suggestions for beatmaps to be added to the Loved category, please submit them using the [Google form](https://docs.google.com/forms/d/e/1FAIpQLSdbgHOVqMF8wQQKSdddW1JhC10ff6C7fb4JbEW7PBQTn9gAqg/viewform)! You can view the current submissions on the corresponding [Google sheet](https://docs.google.com/spreadsheets/d/1HgHwtO3kIzT8R4ocEJMZTosADrGJRJOFL-TZI97tZS4/edit#gid=0). For osu!mania, please use [this Google form](https://docs.google.com/forms/d/e/1FAIpQLSeaGfoQNGMqw4qQcqRPItUZILh2fGwJR6ly6cZNY9OWPXkFhw/viewform) and [this Google sheet](https://docs.google.com/spreadsheets/d/1sjkTwUSvQ5Me-6rK61rToTg2bU-yX9X29CXdzttvhtM/edit) instead.

—the Project Loved team
