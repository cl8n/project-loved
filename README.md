## Usage

### Installing dependencies

Binaries:
- [Node.js](https://nodejs.org/en/download/)  
Download and install the LTS version of Node.js. Make sure to include npm if you use an installer (it will be checked by default).
- [jpeg-recompress](https://github.com/danielgtaylor/jpeg-archive/releases)  
Download the jpeg-archive binaries and place jpeg-recompress(.exe) in this folder.

### Generating posts

Before generating a post for the first time, run `setup.sh` to install the npm packages and create the config files.

To generate a post, you'll need to:
- [Get images for each of the maps](#getting-background-images)
- [Modify the config files](#config-files)
- Run `generate.sh`

#### Getting background images

Typically, the images in each Project Loved news post are backed by the beatmap's background shown on-site. For now, those images have to be obtained manually.

The images can be formatted as PNG or JPG. When saving the images, place them in the `config` folder with the beatmapset ID as their name.

#### Config files

Aside from the images, there are seven config files.

`config.json` contains basic information about each news post. The example provided should make this self-explanatory.

The two markdown files can be edited to change the content of the beginning of the post. The header is the first paragraph before the Project Loved banner (this will be shown as the preview on-site), and the intro is the part after the banner.

The four spreadsheet files are meant to include values from the Project Loved planning spreadsheet. For each mode, copy cells A2:F and paste the content into the file.
