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

${vars.VIDEO}`
} ?>

### Navigation

<? vars.GAME_MODES.map((m) => `- [${m.longName}](#${m.longName})`).join('\n') ?>

{{NOMINATIONS}}

---

{{OUTRO}}

—{{AUTHOR}}
