import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { formatPercent } from './helpers.js';

registerFont(
  join(__dirname, '../resources/Torus-Regular.otf'),
  { family: 'Torus' },
);
registerFont(
  join(__dirname, '../resources/FontAwesome5-FreeSolid.otf'),
  { family: 'Font Awesome 5 Free' },
);

let jpegRecompressFilename;
const overlayImages = {};

async function getJpegRecompressFilename() {
  if (jpegRecompressFilename == null) {
    const binDir = join(__dirname, '../bin');
    const dirEnts = await readdir(binDir, { withFileTypes: true });
    const exeDirEnt = dirEnts.find(
      (dirEnt) => dirEnt.isFile() && dirEnt.name.includes('jpeg-recompress'),
    );

    if (exeDirEnt != null) {
      jpegRecompressFilename = join(binDir, exeDirEnt.name);
    } else {
      throw 'jpeg-recompress must be in bin/ to generate images';
    }
  }

  return jpegRecompressFilename;
}

async function loadOverlayImage(scale) {
  if (overlayImages[scale] == null) {
    const filename = `voting-overlay${scale > 1 ? `@${scale}x` : ''}.png`;
    overlayImages[scale] = await loadImage(join(__dirname, '../resources', filename));
  }

  return overlayImages[scale];
}

export default async function createBanners(backgroundPath, outputPath, title) {
  if (!backgroundPath) {
    throw 'Background path not set';
  }

  if (!outputPath) {
    throw 'Output path not set';
  }

  const backgroundImage = await loadImage(backgroundPath);
  const unscaledWidth = 670;
  const unscaledHeight = 200;

  // Position background to cover canvas
  const backgroundImageRatio = backgroundImage.width / backgroundImage.height;
  const canvasRatio = unscaledWidth / unscaledHeight;
  let unscaledBackgroundImageWidth = unscaledWidth;
  let unscaledBackgroundImageHeight = unscaledHeight;

  if (backgroundImageRatio < canvasRatio) {
    unscaledBackgroundImageHeight = unscaledWidth / backgroundImageRatio;
  } else {
    unscaledBackgroundImageWidth = unscaledHeight * backgroundImageRatio;
  }

  const unscaledBackgroundImageX = (unscaledWidth - unscaledBackgroundImageWidth) / 2;
  const unscaledBackgroundImageY = (unscaledHeight - unscaledBackgroundImageHeight) / 2;

  for (let scale of [1, 2]) {
    const width = unscaledWidth * scale;
    const height = unscaledHeight * scale;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: false });
    context.quality = 'best';

    // Draw background and overlay
    context.drawImage(
      backgroundImage,
      unscaledBackgroundImageX * scale,
      unscaledBackgroundImageY * scale,
      unscaledBackgroundImageWidth * scale,
      unscaledBackgroundImageHeight * scale,
    );
    context.drawImage(await loadOverlayImage(scale), 0, 0);

    // Common text options
    context.fillStyle = '#fff';
    context.shadowBlur = 3 * scale;
    context.shadowColor = 'rgba(0, 0, 0, 0.4)';
    context.shadowOffsetY = 3 * scale;
    context.textAlign = 'right';
    context.textBaseline = 'bottom';

    // Draw title text
    context.font = `${21 * scale}px Torus`;
    context.fillText(title, width - 16 * scale, height - 31 * scale);

    // Check for overflowing title text
    const titleMaxWidth = width - 2 * 16 * scale;
    const titleOverflow = context.measureText(title).width / titleMaxWidth - 1;

    if (titleOverflow > 0) {
      throw `Title is ${formatPercent(titleOverflow)} wider than the available space`;
    }

    // Draw link text
    const fontSize = `${12.5 * scale}px `;
    context.font = fontSize + '"Font Awesome 5 Free Solid"';
    context.fillText('', width - 125 * scale, height - 13 * scale);
    context.font = fontSize + 'Torus';
    context.fillText('Click here to vote!', width - 16 * scale, height - 13 * scale);

    // Render to JPEG
    const jpegStream = canvas.createJPEGStream({ chromaSubsampling: false, quality: 1 });
    const jpegRecompressFilename = await getJpegRecompressFilename();

    await new Promise((resolve, reject) => {
      const jpegRecompress = execFile(jpegRecompressFilename, [
        '--accurate',
        '--strip',
        '-',
        outputPath + (scale > 1 ? `@${scale}x` : '') + '.jpg',
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
