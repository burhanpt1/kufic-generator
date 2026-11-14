// Kufic Studio (COMPOSITION_ENGINE.md §8): gallery and breeding, a guided editor and layers panel over one composition
// tree, the chronogram helper and the letter editor. The current composition lives in the URL.
import { EvalPool } from '../../evolve/pool';
import type { Taste } from '../../evolve/taste';
import { train } from '../../evolve/trainer';
import type { Rating, TasteModel } from '../../evolve/trainer';
import { loadKernels } from '../../kernels';
import { resolve } from '../../compose';
import { collectRoundels, prepareRoundel } from '../../compose/roundel';
import { RoundelWorkers } from '../../script/thuluth/roundel/parallel';
import type { Composition } from '../../model/schema';
import { PRESETS } from '../../model/presets';
import { renderPlaced } from '../../render/composition';
import { downloadName, saveSVG, savePNG } from '../../app/export';
import type { Placed } from '../../compose/placed';
import { laserSVG, plotterSVG, reliefSVG } from '../../fabricate';
import { compositionFromHash, hashFor } from '../state';
import { loadRatings, loadTaste, saveTaste } from '../storage';
import { wireChrono } from './chrono';
import { wireCritic } from './critic';
import { wireEditor } from './editor';
import { mainSlot, wireGallery } from './gallery';
import { wireLetters } from './letters';
import { wirePrint3d } from './print3d';
import { wireTrainer } from './trainer';

export type Tab = 'gallery' | 'trainer' | 'editor' | 'chrono' | 'letters';
export interface App {
  readonly comp: Composition;
  /** Replace the current composition (pushes undo unless replace is set). */
  set(c: Composition, o?: { replace?: boolean }): void;
  /** Make the composition as it is now an undo step (before an edit that is applied with replace as it is typed). */
  checkpoint(): void;
  taste: Taste;
  saveTaste(): void;
  /** Trainer ratings and the models trained on them (null below six ratings). */
  ratings: Rating[];
  model: TasteModel | null;
  pool: EvalPool;
  showTab(t: Tab): void;
  /** Called after every change of the composition. */
  onChange(f: () => void): void;
  /** Glyphs changed: re-render everything that shows letters. */
  glyphsChanged(): void;
  /** A line the user can dismiss, shown under the header. */
  notice(message: string): void;
  readonly svg: string;
  /** A name for files saved from the current composition (no extension). */
  readonly fileName: string;
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
/** Rebuild a box's controls and put the keyboard focus back where it was: on the control with the same data-k (with
 *  its caret, in a text field), or else on `fallback` (a selector inside the box). */
export function keepFocus(box: HTMLElement, rebuild: () => void, fallback?: string) {
  const a = document.activeElement as HTMLElement | null,
    inside = !!a && a !== box && box.contains(a),
    k = inside ? a!.dataset.k : undefined,
    text = a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement ? a : null,
    caret = inside && text ? [text.selectionStart, text.selectionEnd] : null;
  rebuild();
  if (!inside) return;
  const e =
    (k ? [...box.querySelectorAll<HTMLElement>('[data-k]')].find(x => x.dataset.k === k) : null) ??
    (fallback ? box.querySelector<HTMLElement>(fallback) : null);
  if (!e) return;
  e.focus({ preventScroll: true });
  if (caret && caret[0] != null && (e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement))
    try {
      e.setSelectionRange(caret[0], caret[1]);
    } catch {
      /* not a field with a caret (a number, a file) */
    }
}

await loadKernels();

// made when a composition first has a roundel to draw
let workers: RoundelWorkers | null = null;
const roundelWorkers = () => (workers ??= new RoundelWorkers());
let comp: Composition = structuredClone(PRESETS[0].comp),
  svg = '',
  placed: Placed | null = null;
const undo: Composition[] = [],
  redo: Composition[] = [],
  listeners: (() => void)[] = [];

function notice(message: string) {
  const box = $('notices');
  if ([...box.children].some(n => n.firstChild?.textContent === message)) return;
  const n = h('div', { class: 'notice' }, h('span', {}, message));
  n.append(h('button', { textContent: '×', title: 'Dismiss', 'aria-label': 'Dismiss', onclick: () => n.remove() }));
  box.append(n);
}
const mainText = () => {
  const slot = mainSlot(comp);
  return (slot && comp.texts[slot]?.text) || '';
};

const app: App = {
  get comp() {
    return comp;
  },
  get svg() {
    return svg;
  },
  get fileName() {
    const s = JSON.stringify(comp);
    return downloadName(mainText(), PRESETS.find(p => JSON.stringify(p.comp) === s)?.name);
  },
  set(c, o = {}) {
    if (!o.replace) pushUndo(comp);
    comp = c;
    urlHeld = false;
    changed();
  },
  checkpoint() {
    pushUndo(comp);
    undoButtons();
  },
  taste: loadTaste(),
  saveTaste: () => saveTaste(app.taste),
  ratings: loadRatings(),
  model: null,
  pool: new EvalPool(),
  showTab,
  onChange: f => listeners.push(f),
  glyphsChanged: () => changed(),
  notice,
};

app.model = train(app.ratings);

function pushUndo(c: Composition) {
  undo.push(c);
  if (undo.length > 100) undo.shift();
  redo.length = 0;
}
function undoButtons() {
  $<HTMLButtonElement>('undo').disabled = !undo.length;
  $<HTMLButtonElement>('redo').disabled = !redo.length;
}

// ---- preview, URL ----
let renderTimer = 0,
  urlTimer = 0,
  // a link that could not be read stays in the address bar until the user changes something
  urlHeld = false;
function changed() {
  for (const f of listeners)
    try {
      f();
    } catch (e) {
      console.error('Kufic Studio: a panel could not follow the change', e);
    }
  clearTimeout(renderTimer);
  $('preview').classList.add('busy');
  renderTimer = window.setTimeout(renderPreview, 60);
  clearTimeout(urlTimer);
  if (!urlHeld) urlTimer = window.setTimeout(async () => history.replaceState(null, '', await hashFor(comp)), 300);
  undoButtons();
}
/** resolve, with the composition's roundels drawn first on workers (as resolveAsync does), which are only started
 *  when there is a roundel to draw. A wait for the same roundels is shared; a wait for others is cancelled. */
let roundelWait: { key: string; done: Promise<unknown> } | null = null;
async function resolveWithRoundels(c: Composition): Promise<Placed> {
  let p: Placed | undefined;
  const asked = collectRoundels(() => (p = resolve(c))),
    key = asked.length ? JSON.stringify(asked) : '';
  if (roundelWait?.key !== key) {
    workers?.cancel();
    roundelWait = asked.length ? { key, done: Promise.all(asked.map(q => prepareRoundel(q, roundelWorkers()))) } : null;
  }
  // nothing left to draw: the look through was the whole resolve
  if (!asked.length) return p ?? resolve(c);
  const wait = roundelWait!;
  try {
    await wait.done;
  } finally {
    if (roundelWait === wait) roundelWait = null;
  }
  return resolve(c);
}
// a newer change supersedes the wait
let previewRun = 0;
async function renderPreview() {
  const run = ++previewRun,
    t0 = performance.now(),
    c = comp;
  try {
    const slow = window.setTimeout(() => run === previewRun && ($('info').textContent = 'Composing…'), 150),
      p = await resolveWithRoundels(c).finally(() => clearTimeout(slow));
    if (run !== previewRun) return;
    placed = p;
    const text = mainText().split('\n')[0];
    svg = renderPlaced(placed, {
      idPrefix: 'pv',
      label: (c.style.script === 'thuluth' ? 'Thuluth' : 'Kufic') + ' composition' + (text ? ': ' + text : ''),
    });
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
    if (run === previewRun) $('info').textContent = 'Could not lay this out: ' + String((e as Error)?.message ?? e);
  }
  if (run === previewRun) $('preview').classList.remove('busy');
}

// ---- tabs ----
const tabs = [...document.querySelectorAll<HTMLButtonElement>('.tabs button')];
function showTab(t: Tab) {
  tabs.forEach(b => {
    const on = b.dataset.tab === t;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    $(b.dataset.tab!).classList.toggle('hidden', !on);
  });
}
tabs.forEach((b, i) => {
  const panel = $(b.dataset.tab!);
  b.id = 'tab-' + b.dataset.tab;
  b.setAttribute('aria-controls', panel.id);
  b.tabIndex = b.getAttribute('aria-selected') === 'true' ? 0 : -1;
  panel.setAttribute('aria-labelledby', b.id);
  b.onclick = () => showTab(b.dataset.tab as Tab);
  // arrow keys move along the tabs, as in any tab list
  b.onkeydown = e => {
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    const next = tabs[(to + tabs.length) % tabs.length];
    next.focus();
    next.click();
  };
});

// ---- actions ----
$('undo').onclick = () => {
  const c = undo.pop();
  if (!c) return;
  redo.push(comp);
  comp = c;
  urlHeld = false;
  changed();
};
$('redo').onclick = () => {
  const c = redo.pop();
  if (!c) return;
  undo.push(comp);
  comp = c;
  urlHeld = false;
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
$('saveSvg').onclick = () => svg && saveSVG(document, app.fileName, svg);
$('savePng').onclick = () => svg && savePNG(document, app.fileName, svg, notice);
$('fab').onchange = () => {
  const sel = $<HTMLSelectElement>('fab'),
    v = sel.value;
  sel.value = '';
  if (v === 'stl') return print3d ? print3d.open() : notice('The 3D print dialog could not start.');
  if (!placed || !v) return;
  if (v === 'plot') saveSVG(document, app.fileName + '-plotter', plotterSVG(placed));
  else if (v === 'laser') saveSVG(document, app.fileName + '-laser', laserSVG(placed));
  else savePNG(document, app.fileName + '-relief', reliefSVG(placed), notice);
};

// ---- start ----
// each part on its own: one that fails to start must not take the others, the preview and the link with it
const broken: string[] = [];
function wire<T>(name: string, f: (app: App) => T): T | null {
  try {
    return f(app);
  } catch (e) {
    console.error(`Kufic Studio: the ${name} could not start`, e);
    broken.push(name);
    return null;
  }
}
const print3d = wire('3D print dialog', wirePrint3d);
wire('gallery', wireGallery);
wire('trainer', wireTrainer);
wire('editor', wireEditor);
wire('chronogram helper', wireChrono);
wire('letter editor', wireLetters);
wire('critic', wireCritic);
if (broken.length)
  notice(
    `The ${broken.join(' and the ')} could not start. The rest still works; clearing this site’s saved data may fix it.`,
  );

let first = true;
async function fromHash() {
  const c = await compositionFromHash(location.hash);
  if (c) {
    comp = c;
    urlHeld = false;
    showTab('editor');
  } else if (location.hash.startsWith('#c=')) {
    urlHeld = true;
    notice(
      first
        ? 'This link couldn’t be read; showing the default.'
        : 'This link couldn’t be read; keeping the composition you had.',
    );
  }
  first = false;
  changed();
}
window.addEventListener('hashchange', fromHash);
await fromHash();
