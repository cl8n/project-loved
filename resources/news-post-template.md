---
layout: post
title: "{{TITLE}}"
date: {{DATE}} {{TIME}} +0000
series: Project Loved
---

{{HEADER}}

![](/wiki/shared/news/banners/project-loved-2.jpg)<?
if (vars.INTRO) {
`

${vars.INTRO}`
} ?>

### Navigation

<?
vars.GAME_MODES.map(
	(m) => `- **[${m.longName}](#${m.longName})** ([Download pack](${vars.PACK_URLS[m.id]}))`,
).join('\n')
?><?
if (vars.VIDEO) {
`

## Summary

${vars.VIDEO}`
} ?>

{{NOMINATIONS}}

---

{{OUTRO}}

—{{AUTHOR}}
