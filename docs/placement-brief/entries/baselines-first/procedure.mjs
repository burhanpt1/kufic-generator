#!/usr/bin/env node
// Baselines first: an entry for ../../BRIEF.md.   node procedure.mjs   writes placements.json beside this file.
//
// The idea: writing lives on lines. A reader finds the order of words by following a line and then taking the next
// one, so the words are set on a few level lines, read from the top line down and each line from right to left, and
// nothing else. What is left to decide is how many lines, which words on which, and how long each word is drawn; all
// three are chosen to make the writing as large as the circle allows. A circle is widest across its middle, so the
// lines that fit best are short at the top and bottom and long in the middle, and that is what comes out.
//
// Steps (every number is in nibs, the pen's width, unless it says otherwise):
//  1. On a line, each word is set after the one before it so that their inks are WORD_SPACE apart at their nearest
//     point (the ink is measured, not the boxes, so a word runs in over a tail or under a tall stroke). Each line
//     is centred on the circle's upright axis.
//  2. The lines stand at one even pitch, like ruled paper: the smallest pitch at which the inks of every pair of
//     neighbouring lines stay LINE_SPACE apart. An even pitch is what makes a stack of lines read as lines.
//  3. Every way of cutting the words into 1 to MAX_LINES lines in order is tried, and each is given a cost: the
//     radius of the smallest circle round its ink, raised by how far its lines fall short of the circle's width
//     where they sit (RAGGED times the mean squared shortfall). A cut whose lines follow the circle, short at the
//     top and bottom and long in the middle, costs least. The best few are carried to step 4.
//  4. In each of those, words that have a longer drawing are drawn out, shortest line first, wherever that lowers
//     the cost: a short line grows to meet its chord. The cheapest arrangement is kept.
//  5. The circle is the smallest one round all the ink, plus MARGIN.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARGIN, NIB, arrange, here, kit, lineOf } from './lines.mjs';

const MAX_LINES = 7,
  KEEP = 6; // cuts carried from step 3 to step 4

function layout(text) {
  const n = text.words.length,
    plain = text.words.map(w => w.variants[0]),
    lineCache = new Map(),
    span = (a, b) => lineCache.get(a * 100 + b) ?? (lineCache.set(a * 100 + b, lineOf(plain.slice(a, b))), lineCache.get(a * 100 + b)); // prettier-ignore
  // step 3: every cut into lines
  const cuts = [];
  const walk = (start, cut) => {
    if (start === n) return void cuts.push({ cut: cut.slice(), cost: arrange(cut.map(([a, b]) => span(a, b))).cost });
    if (cut.length === MAX_LINES) return;
    for (let end = start + 1; end <= n; end++) {
      cut.push([start, end]);
      walk(end, cut);
      cut.pop();
    }
  };
  walk(0, []);
  cuts.sort((p, q) => p.cost - q.cost || p.cut.length - q.cut.length);
  // step 4: draw words out, on the best few cuts
  let best = null;
  for (const { cut } of cuts.slice(0, KEEP)) {
    const pick = text.words.map(() => 0),
      build = () => cut.map(([a, b]) => lineOf(text.words.slice(a, b).map((w, k) => w.variants[pick[a + k]]))); // prettier-ignore
    let lines = build(),
      cur = arrange(lines);
    for (let round = 0; round < 3; round++) {
      // the shortest line first: it has the most room to grow
      const order = cut.map((_, i) => i).sort((p, q) => lines[p].c1 - lines[p].c0 - (lines[q].c1 - lines[q].c0));
      for (const i of order)
        for (let w = cut[i][0]; w < cut[i][1]; w++)
          while (pick[w] + 1 < text.words[w].variants.length) {
            pick[w]++;
            const L2 = build(),
              a2 = arrange(L2);
            if (a2.cost < cur.cost - 1e-9) {
              lines = L2;
              cur = a2;
            } else {
              pick[w]--;
              break;
            }
          }
    }
    if (!best || cur.cost < best.cost - 1e-9) best = { ...cur, pick: pick.slice(), lines: cut.length };
  }
  const R = best.r + MARGIN * NIB,
    r2 = x => Math.round(x * 100) / 100;
  return {
    radius: r2(R),
    lines: best.lines,
    words: best.words.map((w, i) => ({ variant: best.pick[i], x: r2(w.x - best.cx), y: r2(w.y - best.cy), rotate: 0, scale: 1 })), // prettier-ignore
  };
}

const layouts = {};
for (const t of kit.texts) {
  const { lines, ...l } = layout(t);
  layouts[t.id] = l;
  console.log(
    `${t.id}: ${lines} line${lines > 1 ? 's' : ''}, radius ${l.radius} (${(l.radius / NIB).toFixed(1)} nibs)`,
  );
}
writeFileSync(
  join(here, 'placements.json'),
  JSON.stringify(
    {
      entry: 'baselines-first',
      principle:
        'Writing lives on lines. The words are set on a few level lines and nowhere else; how many lines, which words on which, and how long each word is drawn are all chosen to make the writing as large as the circle allows. Words on a line, and lines under one another, are spaced by their ink, not their boxes.',
      reading: 'Start at the top line and read each line from right to left.',
      layouts,
    },
    null,
    1,
  ) + '\n',
);
