// Render page 1 of a PDF to a high-resolution PNG.
import fs from 'fs';
import { pdf } from 'pdf-to-img';

const input = process.argv[2];
const out = process.argv[3] || 'page1.png';
const scale = Number(process.argv[4] || 6);

const data = fs.readFileSync(input);
const doc = await pdf(data, { scale });
let i = 1;
for await (const page of doc) {
  const p = out.replace(/\.png$/, `-p${i}.png`);
  fs.writeFileSync(p, page);
  console.log(`page ${i} -> ${p} (${page.length} bytes)`);
  i++;
}
