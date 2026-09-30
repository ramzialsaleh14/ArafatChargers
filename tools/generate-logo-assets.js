/**
 * Generates every logo/icon asset from a single source render.
 *
 * The source is a high-resolution render of the first page of the brand PDF
 * (see tools/pdfrender/render.mjs). This script trims the white background,
 * then re-composites the artwork onto the app icon, favicon, PWA icons and the
 * in-app logo, keeping the original aspect ratio.
 *
 * Usage:
 *   node tools/generate-logo-assets.js tools/pdfrender/page1-p1.png
 */
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('./pdfrender/node_modules/canvas');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(__dirname, 'pdfrender', 'page1-p1.png');

// Background colour used for the opaque icons (white keeps the mark legible).
const ICON_BG = '#FFFFFF';

/** Bounding box of the non-white artwork in the source image. */
function contentBounds(image) {
    const c = createCanvas(image.width, image.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);

    let minX = image.width;
    let minY = image.height;
    let maxX = -1;
    let maxY = -1;
    const threshold = 244; // treat near-white as background

    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            const i = (y * image.width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            const isBackground = a < 8 || (r > threshold && g > threshold && b > threshold);
            if (!isBackground) {
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < 0) throw new Error('No content found in the source image.');
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Draw the trimmed artwork centred on a square canvas. */
function renderSquare(image, box, size, { background = null, fill = 0.86 } = {}) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, size, size);
    }

    const targetW = size * fill;
    const scale = targetW / box.width;
    const drawW = box.width * scale;
    const drawH = box.height * scale;
    const dx = (size - drawW) / 2;
    const dy = (size - drawH) / 2;

    ctx.drawImage(image, box.x, box.y, box.width, box.height, dx, dy, drawW, drawH);
    return canvas.toBuffer('image/png');
}

function write(relPath, buffer) {
    const out = path.join(ROOT, relPath);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buffer);
    console.log(`  wrote ${relPath} (${buffer.length} bytes)`);
}

(async () => {
    const srcBuf = fs.readFileSync(SRC);
    const image = await loadImage(srcBuf);
    const box = contentBounds(image);
    console.log(`source ${path.relative(ROOT, SRC)} ${image.width}x${image.height}`);
    console.log(`trimmed content ${box.width}x${box.height} at (${box.x},${box.y})`);

    console.log('In-app logo:');
    // Transparent square artwork - used in the app's circular containers and as
    // the Android adaptive-icon foreground.
    write('assets/logo.png', renderSquare(image, box, 1024, { fill: 0.88 }));

    console.log('App / web icons:');
    write('assets/icon.png', renderSquare(image, box, 1024, { background: ICON_BG, fill: 0.76 }));
    write('assets/favicon.png', renderSquare(image, box, 96, { background: ICON_BG, fill: 0.86 }));
    write('public/icon-512.png', renderSquare(image, box, 512, { background: ICON_BG, fill: 0.76 }));
    write('public/icon-192.png', renderSquare(image, box, 192, { background: ICON_BG, fill: 0.78 }));
    write('public/icon-180.png', renderSquare(image, box, 180, { background: ICON_BG, fill: 0.78 }));
    write('public/icon-32.png', renderSquare(image, box, 32, { background: ICON_BG, fill: 0.84 }));
    write('public/icon-16.png', renderSquare(image, box, 16, { background: ICON_BG, fill: 0.88 }));

    console.log('Done.');
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
