/**
 * Inlines assets/logo.png into app/utils/PrintLogo.js as a base64 data URI.
 *
 * expo-print cannot resolve Metro asset URLs on a native device, so the print
 * document needs the logo as a data URI. Re-run this whenever the logo changes.
 *
 * Usage:
 *   node tools/generate-print-logo.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'assets', 'logo.png');
const TARGET = path.join(ROOT, 'app', 'utils', 'PrintLogo.js');
const CHUNK_SIZE = 200;

const base64 = fs.readFileSync(SOURCE).toString('base64');
const chunks = [];
for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
    chunks.push(base64.slice(i, i + CHUNK_SIZE));
}

const body = chunks.map((chunk) => `    '${chunk}',`).join('\n');

const output = `// AUTO-GENERATED from assets/logo.png by tools/generate-print-logo.js.
// Do not edit by hand - re-run the generator if the logo changes.
// Inlined as a data URI so it renders inside print documents on web AND
// native (expo-print cannot resolve Metro asset URLs on device).
const BASE64_CHUNKS = [
${body}
];

export const LOGO_DATA_URL = 'data:image/png;base64,' + BASE64_CHUNKS.join('');
`;

fs.writeFileSync(TARGET, output);
console.log(`wrote ${path.relative(ROOT, TARGET)} (${chunks.length} chunks, ${base64.length} base64 chars)`);
