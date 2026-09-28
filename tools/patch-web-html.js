/**
 * Post-build step for the Expo web export.
 *
 * Expo's web template only writes the theme-color and favicon tags, so the
 * manifest link and the iOS standalone tags have to be injected into
 * dist/index.html ourselves - without them the browser never offers to
 * install the app.
 *
 * Run automatically by `npm run build:web`.
 */
const fs = require('fs');
const path = require('path');

const INDEX_FILE = path.join(__dirname, '..', 'dist', 'index.html');

// Expo always emits this placeholder-titled tag for the favicon it generates
// from `web.favicon`; we keep it as the large-size fallback but let the real
// logo PNGs declared below win for the 16/32px tab sizes.
const EXPO_FAVICON_TAG = '<link rel="icon" href="/favicon.ico" />';
const LOGO_FAVICON_TAG = '<link rel="icon" href="/favicon.ico" sizes="48x48" />';

const PWA_TAGS = `    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/icon-180.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/icon-16.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Arafat Chargers" />
    <meta name="description" content="Arafat Chargers - charger payment verification app" />`;

if (!fs.existsSync(INDEX_FILE)) {
    console.error(`[patch-web-html] ${INDEX_FILE} not found. Run "expo export --platform web" first.`);
    process.exit(1);
}

let html = fs.readFileSync(INDEX_FILE, 'utf8');

if (html.includes('rel="manifest"')) {
    console.log('[patch-web-html] PWA tags already present, nothing to do.');
} else if (!html.includes('</head>')) {
    console.error('[patch-web-html] Could not find </head> in dist/index.html.');
    process.exit(1);
} else {
    html = html.replace(EXPO_FAVICON_TAG, LOGO_FAVICON_TAG);
    html = html.replace('</head>', `\n  ${PWA_TAGS.split('\n').join('\n  ')}\n  </head>`);
    fs.writeFileSync(INDEX_FILE, html);
    console.log('[patch-web-html] Injected PWA head tags into dist/index.html.');
}
