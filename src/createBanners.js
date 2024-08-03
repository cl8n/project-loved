import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { formatPercent } from './helpers.js';

registerFont('resources/Torus-Regular.otf', { family: 'Torus' });

let bannerCache;
async function loadBannerCache() {
	bannerCache ??= await readFile('config/banner-cache', 'utf8')
		.then((contents) => new Set(contents.split('\n')))
		.catch(() => new Set());
}

function writeBannerCache() {
	return writeFile('config/banner-cache', [...bannerCache.values()].join('\n'));
}

const overlayImages = {};
async function loadOverlayImage(scale) {
	if (overlayImages[scale] == null) {
		const filename = `voting-overlay${scale > 1 ? `@${scale}x` : ''}.png`;
		overlayImages[scale] = await loadImage(join('resources', filename));
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

	const backgroundBuffer = await readFile(backgroundPath);
	const cacheKey = createHash('md5')
		.update('3') // version identifier for image creation algorithm
		.update(backgroundBuffer)
		.update(title)
		.digest('hex');

	await loadBannerCache();
	if (
		bannerCache.has(cacheKey) &&
		existsSync(`${outputPath}.jpg`) &&
		existsSync(`${outputPath}@2x.jpg`)
	) {
		return false;
	}

	const backgroundImage = await loadImage(backgroundBuffer);
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

		// Draw title text
		context.fillStyle = '#fff';
		context.font = `${21 * scale}px Torus`;
		context.shadowBlur = 3 * scale;
		context.shadowColor = 'rgba(0, 0, 0, 0.4)';
		context.shadowOffsetY = 3 * scale;
		context.textAlign = 'right';
		context.textBaseline = 'bottom';
		context.fillText(title, width - 16 * scale, height - 31 * scale);

		// Check for overflowing title text
		const titleMaxWidth = width - 2 * 16 * scale;
		const titleOverflow = context.measureText(title).width / titleMaxWidth - 1;

		if (titleOverflow > 0) {
			throw `Title is ${formatPercent(titleOverflow)} wider than the available space`;
		}

		// Render to JPEG
		const jpegStream = canvas.createJPEGStream({ chromaSubsampling: false, quality: 1 });

		await new Promise((resolve, reject) => {
			const jpegRecompress = execFile(
				'config/jpeg-recompress',
				['--accurate', '--strip', '-', outputPath + (scale > 1 ? `@${scale}x` : '') + '.jpg'],
				(error, _, stderr) => {
					if (error) reject(`jpeg-recompress exited with code ${error.code}:\n${stderr}`);
					else resolve();
				},
			);

			jpegStream.pipe(jpegRecompress.stdin);
			jpegRecompress.stdin.on('error', () => {});
		});
	}

	bannerCache.add(cacheKey);
	await writeBannerCache();
	return true;
}
