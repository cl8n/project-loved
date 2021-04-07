const { createCanvas, loadImage, registerFont } = require('canvas');
const { execFile } = require('child_process');
const { readdir } = require('fs').promises;
const { join } = require('path');

const bannerWidth = 670;
const bannerHeight = 200;
const binDir = join(__dirname, '../bin');
let jpegRecompressFilename;
let overlayImage;

registerFont(join(__dirname, '../resources/Torus-SemiBold.otf'), { family: 'Torus' });

async function getJpegRecompressFilename() {
    if (jpegRecompressFilename == null) {
        const dirEnts = await readdir(binDir, { withFileTypes: true });
        const exeDirEnt = dirEnts.find((dirEnt) => dirEnt.isFile() && dirEnt.name.includes('jpeg-recompress'));

        if (exeDirEnt != null)
            jpegRecompressFilename = join(binDir, exeDirEnt.name);
        else
            throw 'jpeg-recompress must be in bin/ to generate images';
    }

    return jpegRecompressFilename;
}

async function getOverlayImage() {
    if (overlayImage == null)
        overlayImage = await loadImage(join(__dirname, '../resources/banner-overlay.png'));

    return overlayImage;
}

function drawImageCoverParams(image, parentWidth, parentHeight) {
    const ratio = image.width / image.height;
    const parentRatio = parentWidth / parentHeight;
    let newWidth = parentWidth;
    let newHeight = parentHeight;

    if (ratio < parentRatio)
        newHeight = parentWidth / ratio;
    else
        newWidth = parentHeight * ratio;

    return [
        image,
        (parentWidth - newWidth) / 2,
        (parentHeight - newHeight) / 2,
        newWidth,
        newHeight,
    ];
}

module.exports = class BeatmapsetBanner {
    constructor(beatmapset) {
        this.beatmapset = beatmapset;
    }

    async createBanner(outputPath) {
        const canvas = createCanvas(bannerWidth, bannerHeight);
        const context = canvas.getContext('2d', { alpha: false });
        const backgroundImage = await loadImage(this.beatmapset.bgPath);
        const overlayImage = await getOverlayImage();

        context.quality = 'best';
        context.drawImage(...drawImageCoverParams(backgroundImage, bannerWidth, bannerHeight));
        context.drawImage(overlayImage, 0, 0);
        context.fillStyle = '#fff';
        context.font = '21px Torus';
        context.shadowBlur = 2;
        context.shadowColor = '#0007';
        context.shadowOffsetY = 1;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(this.beatmapset.title, bannerWidth / 2, bannerHeight - 26);

        const jpegStream = canvas.createJPEGStream({ chromaSubsampling: false, quality: 1 });
        const jpegRecompressFilename = await getJpegRecompressFilename();

        await new Promise((resolve, reject) => {
            const jpegRecompress = execFile(jpegRecompressFilename, [
                '--accurate',
                '--strip',
                '-',
                outputPath,
            ], (error, _, stderr) => {
                if (error)
                    reject(`jpeg-recompress exited with code ${error.code}:\n${stderr}`);
                else
                    resolve();
            });

            jpegStream.pipe(jpegRecompress.stdin);
            jpegRecompress.stdin.on('error', () => {});
        });
    }
}
