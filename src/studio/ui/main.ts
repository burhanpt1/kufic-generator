// Kufic Studio (COMPOSITION_ENGINE.md §8): gallery and breeding, a guided editor and layers panel over one composition
// tree, the chronogram helper and the letter editor. The current composition lives in the URL.
import { EvalPool } from '../../evolve/pool';
import type { Taste } from '../../evolve/taste';
import { loadSealWasm } from '../../kernels/seal';
import { resolve } from '../../compose';
import type { Composition } from '../../model/schema';
import { PRESETS } from '../../model/presets';
import { renderPlaced } from '../../render/composition';
import { saveSVG, savePNG } from '../../ui/export';
import type { Placed } from '../../compose/placed';
import { laserSVG, plotterSVG, reliefSVG } from '../../fabricate';
import { compositionFromHash, hashFor } from '../state';
import { loadTaste, saveTaste } from '../storage';
import { wireChrono } from './chrono';
import { wireEditor } from './editor';
import { wireGallery } from './gallery';
import { wireLetters } from './letters';

export type Tab = 'gallery' | 'editor' | 'chrono' | 'letters';
export interface App {
  readonly comp: Composition;
  /** Replace the current composition (pushes undo unless replace is set). */
  set(c: Composition, o?: { replace?: boolean }): void;
  taste: Taste;
  saveTaste(): void;
  pool: EvalPool;
  showTab(t: Tab): void;
  /** Called after every change of the composition. */
  onChange(f: () => void): void;
  /** Glyphs changed: re-render everything that shows letters. */
  glyphsChanged(): void;
  readonly svg: string;
}
export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v as string;
    else if (k === 'style') e.setAttribute('style', v as string);
    else if (k.startsWith('data-') || k.startsWith('aria-')) e.setAttribute(k, String(v));
    else (e as unknown as Record<string, unknown>)[k] = v;
  }
  e.append(...kids);
  return e;
}

await loadSealWasm();

let comp: Composition = structuredClone(PRESETS[0].comp),
  svg = '',
  placed: Placed | null = null;
const undo: Composition[] = [],
  redo: Composition[] = [],
  listeners: (() => void)[] = [];

const app: App = {
  get comp() {
    return comp;
  },
  get svg() {
    return svg;
  },
  set(c, o = {}) {
    if (!o.replace) {
      undo.push(comp);
      if (undo.length > 100) undo.shift();
      redo.length = 0;
    }
    comp = c;
    changed();
  },
  taste: loadTaste(),
  saveTaste: () => saveTaste(app.taste),
  pool: new EvalPool(),
  showTab,
  onChange: f => listeners.push(f),
  glyphsChanged: () => changed(),
};

// ---- preview, URL ----
let renderTimer = 0,
  urlTimer = 0;
function changed() {
  listeners.forEach(f => f());
  clearTimeout(renderTimer);
  renderTimer = window.setTimeout(renderPreview, 60);
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(async () => history.replaceState(null, '', await hashFor(comp)), 300);
  $<HTMLButtonElement>('undo').disabled = !undo.length;
  $<HTMLButtonElement>('redo').disabled = !redo.length;
}
function renderPreview() {
  const t0 = performance.now();
  try {
    placed = resolve(comp);
    svg = renderPlaced(placed, { idPrefix: 'pv' });
    $('preview').innerHTML = svg;
    const m = placed.meta,
      rings = m.borders.flatMap(b => b.rings),
      parts = [
        `${rings.length} ring${rings.length === 1 ? '' : 's'}`,
        rings.length ? `letter scale ${rings.map(r => r.scale.toFixed(2)).join(', ')}` : '',
        m.fill ? `fill: ${m.fill.type}${m.fill.ok ? '' : ` (${m.fill.note ?? 'failed'})`}` : '',
        `size ${m.size.toFixed(0)}`,
        `${(performance.now() - t0).toFixed(0)} ms`,
      ];
    $('info').textContent =
      parts.filter(Boolean).join(' · ') + (m.warnings.length ? ' — ' + m.warnings.join('; ') : '');
  } catch (e) {
    $('info').textContent = 'Could not lay this out: ' + String((e as Error)?.message ?? e);
  }
}

// ---- tabs ----
function showTab(t: Tab) {
  document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach(b => {
    const on = b.dataset.tab === t;
    b.setAttribute('aria-selected', String(on));
    $(b.dataset.tab!).classList.toggle('hidden', !on);
  });
}
document
  .querySelectorAll<HTMLButtonElement>('.tabs button')
  .forEach(b => (b.onclick = () => showTab(b.dataset.tab as Tab)));

// ---- actions ----
$('undo').onclick = () => {
  const c = undo.pop();
  if (!c) return;
  redo.push(comp);
  comp = c;
  changed();
};
$('redo').onclick = () => {
  const c = redo.pop();
  if (!c) return;
  undo.push(comp);
  comp = c;
  changed();
};
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
  const t = e.target as HTMLElement;
  if (t.matches('input, textarea')) return;
  e.preventDefault();
  $(e.shiftKey ? 'redo' : 'undo').click();
});
$('share').onclick = async () => {
  const url = location.origin + location.pathname + (await hashFor(comp));
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    $('share').textContent = 'Copied';
  } catch {
    $('share').textContent = 'Link in address bar';
  }
  setTimeout(() => ($('share').textContent = 'Copy link'), 1500);
};
$('saveSvg').onclick = () => svg && saveSVG(document, 'kufic', svg);
$('savePng').onclick = () => svg && savePNG(document, 'kufic', svg);
$('fab').onchange = () => {
  const sel = $<HTMLSelectElement>('fab'),
    v = sel.value;
  sel.value = '';
  if (!placed || !v) return;
  if (v === 'plot') saveSVG(document, 'kufic-plotter', plotterSVG(placed));
  else if (v === 'laser') saveSVG(document, 'kufic-laser', laserSVG(placed));
  else savePNG(document, 'kufic-relief', reliefSVG(placed));
};

// ---- start ----
wireGallery(app);
wireEditor(app);
wireChrono(app);
wireLetters(app);

async function fromHash() {
  const c = await compositionFromHash(location.hash);
  if (c) {
    comp = c;
    showTab('editor');
  }
  changed();
}
window.addEventListener('hashchange', fromHash);
await fromHash();
