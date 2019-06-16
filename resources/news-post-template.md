---
layout: post
title: "{{TITLE}}"
date: {{DATE}} {{TIME}} +0000
---

{{HEADER}}

![](/wiki/shared/news/banners/project-loved.jpg)

{{INTRO}}<?
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

osu! Loved candidates were chosen by {{ALL_CAPTAINS.osu}}!<?
if (vars.CONSISTENT_CAPTAINS.osu) {
` This week, all osu! beatmap descriptions were written by [${vars.CONSISTENT_CAPTAINS.osu}](${getUserLink(vars.CONSISTENT_CAPTAINS.osu)}).`
} ?>

---

{{BEATMAPS.osu}}

## <a name="osutaiko" id="osutaiko"></a>osu!taiko<?
if (vars.VIDEO.taiko) {
`

<iframe width="100%" height="400" src="https://www.youtube.com/embed/${vars.VIDEO.taiko}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
} ?>

osu!taiko Loved candidates were chosen by {{ALL_CAPTAINS.taiko}}!<?
if (vars.CONSISTENT_CAPTAINS.taiko) {
` This week, all osu!taiko beatmap descriptions were written by [${vars.CONSISTENT_CAPTAINS.taiko}](${getUserLink(vars.CONSISTENT_CAPTAINS.taiko)}).`
} ?>

---

{{BEATMAPS.taiko}}

## <a name="osucatch" id="osucatch"></a>osu!catch<?
if (vars.VIDEO.catch) {
`

<iframe width="100%" height="400" src="https://www.youtube.com/embed/${vars.VIDEO.catch}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
} ?>

osu!catch Loved candidates were chosen by {{ALL_CAPTAINS.catch}}!<?
if (vars.CONSISTENT_CAPTAINS.catch) {
` This week, all osu!catch beatmap descriptions were written by [${vars.CONSISTENT_CAPTAINS.catch}](${getUserLink(vars.CONSISTENT_CAPTAINS.catch)}).`
} ?>

---

{{BEATMAPS.catch}}

## <a name="osumania" id="osumania"></a>osu!mania<?
if (vars.VIDEO.mania) {
`

<iframe width="100%" height="400" src="https://www.youtube.com/embed/${vars.VIDEO.mania}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
} ?>

osu!mania Loved candidates were chosen by {{ALL_CAPTAINS.mania}}!<?
if (vars.CONSISTENT_CAPTAINS.mania && vars.CONSISTENT_CAPTAINS.mania !== 'Captain') {
` This week, all osu!mania beatmap descriptions were written by [${vars.CONSISTENT_CAPTAINS.mania}](${getUserLink(vars.CONSISTENT_CAPTAINS.mania)}).`
} ?>

---

{{BEATMAPS.mania}}

---

{{OUTRO}}

—the Project Loved team
