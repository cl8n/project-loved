This project contains the tools required to generate announcements, forum threads and related content for osu!'s [Project Loved](https://osu.ppy.sh/wiki/Project_Loved). See [cl8n/project-loved-web](https://github.com/cl8n/project-loved-web) for the website.

## Dependencies

- [Node.js](https://nodejs.org/en/download/) 12+
- [jpeg-recompress](https://github.com/danielgtaylor/jpeg-archive/releases)
  - Download the jpeg-archive binaries and place jpeg-recompress(.exe) in `bin`.
- `unzip` and `zipinfo`

## Usage

A typical round of Project Loved involves:

- Messaging mappers of nominated mapsets: `npm run messages`
- Messaging mappers for any update requests: `npm run messages:metadata`
- Creating a news post: `npm run news -- <osu-wiki folder>`
- Opening forum polls and updating the news post: `npm run news:forum -- <osu-wiki folder>`
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
| `videos.intro` | YouTube video ID for video to be shown after the news post's intro |
| `videos.<mode>` | YouTube video ID for video to be shown under \<mode\>'s header in the news post |

When creating the API client for chat announcements, set the "Application Callback URL" field to `http://localhost:18888`.

In addition to `config.json`, you need to provide beatmap backgrounds for each of the mapsets included in the current round. Their filenames (not including the extension) must match the beatmapset ID. Run `npm run maps:download` to download most of them automatically. For the remaining, you can put all of the OSZ files in the `config` folder and run `npm run maps:unpack`. This will extract backgrounds from beatmapsets where there is only one image.
