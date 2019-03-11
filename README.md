This project contains the tools required to generate announcements, forum threads and related content for osu!'s Project Loved.

## Installing dependencies

Binaries:
- [Node.js](https://nodejs.org/en/download/)  
Download and install the LTS version of Node.js. Make sure to include npm if you use an installer (it will be checked by default).
- [jpeg-recompress](https://github.com/danielgtaylor/jpeg-archive/releases)  
Download the jpeg-archive binaries and place jpeg-recompress(.exe) in this folder. This is only needed if you are generating images for the news post.

## Usage

### Generating news posts

Before generating news posts for the first time, run `setup.sh` to install the npm packages and create the config files required by this program.

To generate a post, you'll need to:
- [Get images for each of the maps](#getting-background-images)
- [Modify the config files](#config-files)
- [Run `generate.sh`](#running-the-script)
- [Move the generated files to the osu! wiki](#moving-to-the-osu-wiki)

#### Getting background images

*Note: You may skip this step if you don't need to generate the images*

Typically, the images in each Project Loved news post are backed by the beatmap's background shown on-site. For now, those images have to be obtained manually. The images can be formatted as PNG or JPG. When saving the images, place them in the `config` folder with the beatmapset ID as their name.

Because it can be a tedious process to find every background within every mapset, there is a helper script `get-images.sh` included that will search for any beatmap archives in the `config` folder and extract the background image if it can detect one. This will work for most maps, but not all.

#### Config files

Aside from the images, there are seven config files.

`config.json` contains information about the current round of Project Loved. Most of the options in here should be self-explanatory. If you are only generating the news post, you can leave `csrf`, `resultsPost` and `session` blank.

The two markdown files can be edited to change the content of the beginning of the post. The header is the first paragraph (this will be shown as the preview on-site), and the intro is the part coming immediately after the header.

The four document files are meant to include values from the Project Loved planning document. For each mode, copy everything below the mode's header on the Google document and paste it into the file.

#### Running the script

Run `generate.sh` in any shell to generate the news post. If you also need to make the beatmap images, add the argument `--images`.

#### Moving to the osu! wiki

After the program runs, you'll have a new folder named `output` that contains the news post along with the Project Loved beatmap images. Drag/move the contents of this folder into your local [osu-wiki](https://github.com/ppy/osu-wiki) repository, and all of the files will be in the right place.

### Generating forum threads

This program is also capable of automatically posting to the Project Loved forum. **Make sure to only run this once per round, when all of the information is final and correct.**

In addition to filling in the information need by the news posts in the [config files](#config-files), you'll need to provide a CSRF prevention token, links to the last round's results posts, and an osu! session ID in `config.json`. Contact me if you need help finding this information.

When running `generate.sh`, include the `--threads` option. Make sure that everything worked as intended by checking the Project Loved forum after the program finishes. If something is wrong, delete all of the posts.

### Generating mapper forum messages

You can run `generate.sh` with the `--messages` option to also generate some templates that make messaging the mappers easier. To send the PM, you'll still need to copy in whatever Noffy says needs to change.
