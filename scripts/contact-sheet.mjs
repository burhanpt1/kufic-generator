// Tile PNGs into a labelled grid (one PNG), for looking at many roundels at once:
//   node scripts/contact-sheet.mjs out.png "Title" cols cell_px "row label|col label|file.png" ...
// Cells are given row by row; a missing file leaves its cell blank. Rasterised with resvg, as the goldens are.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const [, , out, title, colsArg, cellArg, ...cells] = process.argv;
const cols = +colsArg,
  CW = +cellArg,
  PAD = 12,
  CAP = 26,
  TOP = 54;
const rows = Math.ceil(cells.length / cols),
  width = PAD + cols * (CW + PAD),
  height = TOP + rows * (CW + CAP + PAD);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
let body = `<rect width="100%" height="100%" fill="#f4efe3"/><text x="${width / 2}" y="34" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#1d2440">${esc(title)}</text>`;
cells.forEach((c, i) => {
  const [row, col, file] = c.split('|'),
    x = PAD + (i % cols) * (CW + PAD),
    y = TOP + Math.floor(i / cols) * (CW + CAP + PAD);
  body += `<text x="${x}" y="${y + 17}" font-family="sans-serif" font-size="13" fill="#1d2440">${esc(row)} · ${esc(col)}</text>`;
  if (file && existsSync(file))
    body += `<image href="data:image/png;base64,${readFileSync(file).toString('base64')}" x="${x}" y="${y + CAP}" width="${CW}" height="${CW}"/>`;
  else body += `<rect x="${x}" y="${y + CAP}" width="${CW}" height="${CW}" fill="#e6dfcf"/>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
writeFileSync(out, new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng());
console.log('wrote', out, width, height);
