// Helpers shared by the golden tests: applying a case's UI settings to the page, and serialising engine output.

// Segmented button groups (element id = case key), sliders and checkboxes, as in index.html.
const SEGS = [
  'layout',
  'center',
  'corners',
  'bandStyle',
  'ground',
  'tiling',
  'terminal',
  'reach',
  'letterStyle',
  'colourMode',
  'ra',
  'ayn',
  'la',
  'marks',
  'vowels',
  'rot',
];
const INPUTS = ['text', 'asc', 'gap', 'weight', 'soft', 'rings', 'taper', 'centreSize', 'geoAngle', 'geoScale'];
const CHECKS = ['grid', 'contrast', 'repeat', 'rhythm'];

function click(el) {
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
}

// Apply a case's UI settings in the order a user would: preset, then segmented choices, sliders, checkboxes, palette.
export function applyUI(dom, ui) {
  const doc = dom.window.document,
    $ = id => doc.getElementById(id);
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

// JSON form of engine output. Typed arrays (grid cells, tags, ring ids) become {"$u8": "..."} with one base-36
// digit per cell, so a 100×100 grid is one readable 10 kB string instead of 10,000 array entries.
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
export function serialize(value) {
  return JSON.parse(
    JSON.stringify(value, (k, v) => {
      if (v && typeof v === 'object' && ArrayBuffer.isView(v)) {
        const name = v.constructor.name;
        if (name !== 'Uint8Array') throw new Error(`unexpected ${name} in engine output`);
        if (v.some(n => n >= DIGITS.length)) return { $u8: Array.from(v) };
        return { $u8: Array.from(v, n => DIGITS[n]).join('') };
      }
      if (typeof v === 'number' && !Number.isFinite(v)) return { $num: String(v) };
      return v;
    }),
  );
}
