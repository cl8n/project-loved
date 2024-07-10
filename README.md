This project contains the tools required to generate announcements, forum threads and related content for osu!'s [Project Loved](https://osu.ppy.sh/wiki/Project_Loved). See [cl8n/project-loved-web](https://github.com/cl8n/project-loved-web) for the website.

## Dependencies

- [Node.js](https://nodejs.org/en/download/) 18
- [git](https://git-scm.com/) (optional, for auto-updating the repository when running commands)

## Usage

A typical round of Project Loved involves:

- Messaging mappers of nominated mapsets: `npm run messages`
- Creating a news post: `npm run news -- <osu-wiki folder>`
- Opening forum polls and optionally updating the news post: `npm run news:forum [-- <osu-wiki folder>]`
- Posting results when forum polls have concluded: `npm run results`

### Setup

`npm run setup` will create the needed config files and runtime folders.

### Config

`config/config.json` contains these options:

| Option | Description |
| :-- | :-- |
| `apiClient.id` | API client ID for chat announcements |
| `apiClient.secret` | API client secret for chat announcements |
| `cloudflare.id` | https://osu.ppy.sh's `__cfduid` cookie |
| `cloudflare.clearance` | https://osu.ppy.sh's `cf_clearance` cookie |
| `csrf` | https://osu.ppy.sh's `XSRF-TOKEN` cookie |
| `lovedApiKey` | API key for https://loved.sh |
| `lovedBaseUrl` | Base URL for https://loved.sh |
| `lovedRoundId` | ID of the round on https://loved.sh |
| `osuBaseUrl` | Base URL for https://osu.ppy.sh |
| `pollStartGuess` | Guess for when the polls will be published. Used in PMs |
| `session` | https://osu.ppy.sh's `osu_session` cookie |
| `userAgent` | `User-Agent` header of the browser used to obtain Cloudflare cookies |

When creating the API client for chat announcements, set the "Application Callback URL" field to `http://localhost:18888`.

In addition to `config.json`, you need to provide beatmap backgrounds for each of the mapsets included in the current round. Their filenames (not including the extension) must match the beatmapset ID. Run `npm run maps:download` to download most of them automatically.
