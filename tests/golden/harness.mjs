// Loads the prototype page in jsdom, drives its real controls, and captures what the page computed:
// the KUFI.compose() / KUFI.alphabet() call (input and output) and the render call (function, options, SVG).
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

// Segmented button groups: case key -> element id (the id is also the state key, except rotation).
const SEGS = ['layout', 'center', 'corners', 'bandStyle', 'ground', 'tiling', 'terminal', 'reach', 'letterStyle', 'colourMode', 'ra', 'ayn', 'la', 'marks', 'vowels', 'rot'];
const INPUTS = ['text', 'asc', 'gap', 'weight', 'soft', 'rings', 'taper', 'centreSize', 'geoAngle', 'geoScale'];
const CHECKS = ['grid', 'contrast', 'repeat', 'rhythm'];

// Instrumentation evaluated inside the page after its script has run. Function declarations and KUFI's methods
// are looked up at call time, so wrapping them records every call without changing behaviour.
const HOOK = `(() => {
  const rec = window.__rec = { reset() { this.engine = null; this.render = null; } };
  rec.reset();
  for (const fn of ['compose', 'alphabet']) {
    const orig = KUFI[fn];
    KUFI[fn] = (...args) => { const output = orig(...args); rec.engine = { fn, args: JSON.parse(JSON.stringify(args)), output }; return output; };
  }
  for (const fn of ['renderSquare', 'renderCircle', 'renderGrid']) {
    const orig = window[fn];
    window[fn] = (...args) => { rec.render = { fn, opt: JSON.parse(JSON.stringify(args[1])), margin: args[2] }; return orig(...args); };
  }
})()`;

export function loadPage(htmlPath) {
  const html = readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  dom.window.eval(HOOK);
  return dom;
}

function click(el) {
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
}

// Apply a case's UI settings in the order a user would: preset, then segmented choices, sliders, checkboxes, palette.
export function applyUI(dom, ui) {
  const doc = dom.window.document, $ = id => doc.getElementById(id);
  if (ui.preset === 'fatimid') click($('fatimid'));
  for (const k of SEGS) {
    if (ui[k] == null) continue;
    const b = [...$(k).children].find(c => c.dataset.v === String(ui[k]) && c.style.visibility !== 'hidden');
    if (!b) throw new Error(`no ${k} button for ${ui[k]}`);
    click(b);
  }
  for (const k of INPUTS) {
    if (ui[k] == null) continue;
    $(k).value = String(ui[k]);
    $(k).dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  }
  for (const k of CHECKS) {
    if (ui[k] == null) continue;
    $(k).checked = !!ui[k];
    $(k).dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  }
  if (ui.palette != null) click($('swatches').children[ui.palette]);
}

// Run one case on a fresh page and return everything needed for the snapshot files.
export function runCase(htmlPath, c) {
  const dom = loadPage(htmlPath);
  try {
    applyUI(dom, c.ui);
    const w = dom.window;
    w.__rec.reset();
    w.eval('render()');
    const rec = w.__rec;
    return {
      svg: w.eval('lastSVG'),
      engine: rec.engine && { fn: rec.engine.fn, args: rec.engine.args, output: serialize(rec.engine.output) },
      render: rec.render,
      meta: w.document.getElementById('meta').textContent,
      warn: w.document.getElementById('warn').textContent,
    };
  } finally {
    dom.window.close();
  }
}

// JSON form of engine output. Typed arrays (grid cells, tags, ring ids) become {"$u8": "..."} with one base-36
// digit per cell, so a 100×100 grid is one readable 10 kB string instead of 10,000 array entries.
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
export function serialize(value) {
  return JSON.parse(JSON.stringify(value, (k, v) => {
    if (v && typeof v === 'object' && ArrayBuffer.isView(v)) {
      const name = v.constructor.name;
      if (name !== 'Uint8Array') throw new Error(`unexpected ${name} in engine output`);
      if (v.some(n => n >= DIGITS.length)) return { $u8: Array.from(v) };
      return { $u8: Array.from(v, n => DIGITS[n]).join('') };
    }
    if (typeof v === 'number' && !Number.isFinite(v)) return { $num: String(v) };
    return v;
  }));
}
