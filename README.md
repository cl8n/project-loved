This project contains the tools required to generate announcements, forum threads and related content for osu!'s Project Loved.

## Dependencies

- [Node.js](https://nodejs.org/en/download/)
- [jpeg-recompress](https://github.com/danielgtaylor/jpeg-archive/releases) - Download the jpeg-archive binaries and place jpeg-recompress(.exe) in `bin`.

## Usage

A typical week in Project Loved involves:

- Messaging mappers of nominated mapsets: `npm run messages`
- Creating images for a news post: `npm run images`
- Creating a news post: `npm run news`
- Opening forum polls and updating the news post: `npm run news:forum`
- Posting results when forum polls have concluded: `npm run results`

### Setup

`npm run setup` will create the needed config files and runtime folders.

### Config

There are four files you can configure:

- `config.json` contains various options listed below
- `document` should have a content-only copy of the Project Loved Google document

| Option | Description |
| :-- | :-- |
| `cloudflare.id` | https://osu.ppy.sh's `__cfduid` cookie |
| `cloudflare.clearance` | https://osu.ppy.sh's `cf_clearance` cookie |
| `csrf` | https://osu.ppy.sh's `XSRF-TOKEN` cookie |
| `csrfOld` | https://old.ppy.sh's `localUserCheck` value (found in a script element) |
| `date` | Publishing date of the news post |
| `discord.<mode>` | Discord webhooks for announcing new maps and results |
| `osuApiKey` | API key from https://old.ppy.sh/p/api |
| `resultsPost.<mode>` | Previous round's results forum posts |
| `session` | https://osu.ppy.sh's `osu_session` cookie |
| `sessionOld` | https://old.ppy.sh's `phpbb3_2cjk5_sid` cookie |
| `time` | Publishing time of the news post |
| `title` | Title of the news post |
| `userAgent` | `User-Agent` header of the browser used to obtain Cloudflare cookies |
| `videos.intro` | YouTube video ID for video to be shown after the news post's intro |
| `videos.<mode>` | YouTube video ID for video to be shown under \<mode\>'s header in the news post |

In addition to the four config files, you need to provide beatmap backgrounds for each of the sets listed in `document`. Their filenames (not including the extension) must match the beatmapset ID. To speed up the process of collecting backgrounds, you can put all of the OSZ files in the `config` folder and run `npm run images:unpack`. This will extract backgrounds from beatmapsets where there is only one image.
