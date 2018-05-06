## Usage

### Installing dependencies

Binaries:
- [ImageMagick](https://www.imagemagick.org/script/download.php)  
Download and install the program. Both the Q8 and Q16 versions will work for this project.
- [jpeg-recompress](https://github.com/danielgtaylor/jpeg-archive/releases)  
Download the jpeg-archive binaries and place jpeg-recompress(.exe) in this folder.

Fonts:
- [Exo 2](https://fonts.google.com/specimen/Exo+2?selection.family=Exo+2:400,600,600i)  
Download and install the font family. Only Regular, Semi-Bold and Semi-Bold Italic are needed.

`npm install` will handle the rest.

### Generating posts

Before generating a post for the first time, run `setup.sh` to create the config files.

To generate a post, you'll need to:
- [Create / crop background images for each of the maps](#creating-background-images)
- [Modify the config files](#config-files)
- Run `generate.sh`

#### Creating background images

Typically, the images in each Project Loved news post are backed by the beatmap's background shown on-site. For now, those images have to be obtained and cropped manually.

The size of each background should be 1000x400. They can be formatted as PNG or JPG. When saving the images, place them in the `config` folder with the beatmapset ID as their name.

#### Config files

Aside from the images, there are eight config files.

`config.json` contains basic information about each news post. The example provided should make this self-explanatory.

The three markdown files can be edited to change the content of the post in each region. The header is the first paragraph before the Project Loved banner (this will be shown as the preview on-site), the intro is the part after the banner, and the outro is the closing statement. A template outro is provided because it's basically the same every time.

The four spreadsheet files are meant to include values from the Project Loved planning spreadsheet (any of the captains can give you access to this). For each mode, copy cells A2:F11 (or less rows, depending on the mode) and paste the content into the file.
