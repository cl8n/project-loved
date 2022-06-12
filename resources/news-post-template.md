---
layout: post
title: "{{TITLE}}"
date: {{DATE}} {{TIME}} +0000
---

{{HEADER}}

![](/wiki/shared/news/banners/project-loved-2.jpg)<?
if (vars.INTRO) {
`

${vars.INTRO}`
} ?><?
if (vars.VIDEO) {
`

<iframe width="100%" height="400" src="https://www.youtube.com/embed/${vars.VIDEO}?rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
} ?>

### Navigation

<? vars.GAME_MODES.map((m) => `- [${m.longName}](#${m.longName})`).join('\n') ?>

{{NOMINATIONS}}

---

{{OUTRO}}

—{{AUTHOR}}
