// The basmala tuning page (demos/tune.html): pin one roundel by hand until it reads and looks right. Each word can be
// moved, each piece moved on its own, lifted onto the piece before, or given another of its shapes; the marks are
// redrawn round whatever is pinned. A layout is saved with a note to the page's store (collection "layouts"), where
// Claude reads it back; a draft is kept in this browser.
import type { Layout } from '../script/thuluth/roundel';
import starts from './starts.json';
import type { TuneDraw, TuneInit, TunePiece, TuneRequest, TuneState } from './types';

interface Saved {
  id: string;
  state: TuneState;
  note: string;
  t: number;
}
interface Db {
  collection(path: string): {
    add(d: object): Promise<{ id: string }>;
    onSnapshot(ok: (s: { docs: { id: string; data(): unknown }[] }) => void, err?: (e: unknown) => void): () => void;
  };
}
interface Claude {
  use(name: string): Promise<unknown>;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const DRAFT = 'tune-basmala';
const FRAME = { ornaments: false, density: 0.35, vowels: false, clearance: 0 };
const fresh = (k: number): TuneState => ({ layout: structuredClone(starts[k].layout) as Layout, frame: { ...FRAME } });

// the engine, in its worker
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
let nextId = 0;
const waiting = new Map<number, (m: { init?: TuneInit; draw?: TuneDraw; error?: string }) => void>();
worker.onmessage = e => waiting.get(e.data.id)?.(e.data);
type Req = TuneRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;
const ask = (m: Req) =>
  new Promise<{ init?: TuneInit; draw?: TuneDraw; error?: string }>(ok => {
    const id = nextId++;
    waiting.set(id, r => (waiting.delete(id), ok(r)));
    worker.postMessage({ ...m, id });
  });

let pieces: TunePiece[] = [];
let state: TuneState = fresh(0);
const past: string[] = [],
  future: string[] = [];
let sel = -1,
  movePiece = false,
  boxes: TuneDraw['boxes'] = [],
  drawing = false,
  again = false,
  db: Db | null = null,
  saved: Saved[] = [];

function load(): TuneState | null {
  try {
    const s = localStorage.getItem(DRAFT);
    return s ? (JSON.parse(s) as TuneState) : null;
  } catch {
    return null;
  }
}
function keep() {
  try {
    localStorage.setItem(DRAFT, JSON.stringify(state));
  } catch {
    /* the draft is a convenience */
  }
}

/** Change the state (one undo step) and redraw. */
function change(f: (s: TuneState) => void) {
  past.push(JSON.stringify(state));
  if (past.length > 200) past.shift();
  future.length = 0;
  f(state);
  keep();
  redraw();
}
function setState(s: TuneState, undoable = true) {
  if (undoable) past.push(JSON.stringify(state));
  future.length = 0;
  state = structuredClone(s);
  keep();
  redraw();
}

async function redraw() {
  syncControls();
  if (drawing) {
    again = true;
    return;
  }
  drawing = true;
  $('view').classList.add('busy');
  $('status').textContent = 'Drawing…';
  const r = await ask({ kind: 'draw', layout: state.layout, frame: state.frame });
  drawing = false;
  if (again) {
    again = false;
    return redraw();
  }
  $('view').classList.remove('busy');
  if (r.error || !r.draw) {
    $('status').textContent = `That layout could not be drawn (${r.error}). Undo the last change.`;
    return;
  }
  boxes = r.draw.boxes;
  $('view').innerHTML = r.draw.svg;
  outline();
  $('status').textContent = `Drawn in ${(r.draw.ms / 1000).toFixed(1)} s`;
}

/** Mark the selected piece on the drawing. */
function outline() {
  const svg = $('view').querySelector('svg');
  svg?.querySelector('#pick')?.remove();
  if (!svg || sel < 0 || !boxes[sel]) return;
  const b = boxes[sel],
    r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  r.id = 'pick';
  for (const [k, v] of Object.entries({ x: b.x0 - 4, y: b.y0 - 4, width: b.x1 - b.x0 + 8, height: b.y1 - b.y0 + 8, rx: 6 })) r.setAttribute(k, String(v)); // prettier-ignore
  r.setAttribute('fill', 'none');
  r.setAttribute('stroke', getComputedStyle(document.documentElement).getPropertyValue('--pick').trim() || '#c2410c');
  r.setAttribute('stroke-width', '3');
  r.setAttribute('stroke-dasharray', '8 5');
  svg.append(r);
}

function select(i: number) {
  sel = i;
  outline();
  syncControls();
}

function syncControls() {
  $<HTMLButtonElement>('undo').disabled = !past.length;
  $<HTMLButtonElement>('redo').disabled = !future.length;
  $('mWord').classList.toggle('on', !movePiece);
  $('mPiece').classList.toggle('on', movePiece);
  $<HTMLInputElement>('vowels').checked = state.frame.vowels;
  $<HTMLInputElement>('orn').checked = state.frame.ornaments;
  $<HTMLInputElement>('density').value = String(state.frame.density);
  $<HTMLInputElement>('density').disabled = !state.frame.ornaments;
  $<HTMLInputElement>('clear').value = String(state.frame.clearance);
  document.querySelectorAll<HTMLButtonElement>('#pieces button').forEach(b => b.classList.toggle('on', +b.dataset.i! === sel)); // prettier-ignore
  const p = pieces[sel],
    lift = $<HTMLInputElement>('lift');
  for (const id of ['up', 'down', 'left', 'right', 'reset']) $<HTMLButtonElement>(id).disabled = !p;
  $<HTMLButtonElement>('reset').disabled = !p || !nudgeOf(sel);
  lift.disabled = !p || p.first;
  lift.checked = !!p && (state.layout.up || []).includes(sel);
  if (!p) {
    $('sel').textContent = 'Nothing selected.';
    $('variants').innerHTML = '';
    return;
  }
  const word = pieces.filter(q => q.word === p.word),
    k = word.indexOf(p) + 1,
    n = nudgeOf(sel);
  $('sel').textContent =
    `Word ${p.word + 1} of ${new Set(pieces.map(q => q.word)).size}, piece ${k} of ${word.length}: ${p.s}` +
    (n ? ` · moved ${n.x >= 0 ? '+' : ''}${n.x}, ${n.y >= 0 ? '+' : ''}${n.y}` : '');
  const cur = state.layout.lv[sel];
  $('variants').innerHTML = p.variants
    .map(
      (v, j) =>
        `<button type="button" data-v="${j}" class="${j === cur ? 'on' : ''}" aria-label="Shape ${j + 1}: ${v.label}"><svg viewBox="-4 -4 ${(v.w + 8).toFixed(0)} ${(v.h + 8).toFixed(0)}"><path d="${v.d}"/></svg><span>${j + 1} · ${v.label}</span></button>`,
    )
    .join('');
  $('variants').querySelector<HTMLElement>('.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

const nudgeOf = (i: number) => (state.layout.nudge || []).find(q => q.i === i);
const round = (x: number) => Math.round(x * 100) / 100;

function move(dx: number, dy: number) {
  if (sel < 0) return;
  const step = +$<HTMLSelectElement>('step').value;
  change(s => {
    if (movePiece) {
      const ns = (s.layout.nudge ??= []);
      let q = ns.find(m => m.i === sel);
      if (!q) ns.push((q = { i: sel, x: 0, y: 0 }));
      q.x = round(q.x + dx * step);
      q.y = round(q.y + dy * step);
      s.layout.nudge = ns.filter(m => m.x || m.y);
    } else {
      const w = s.layout.wp[pieces[sel].word];
      w.x = round(w.x + dx * step);
      w.y = round(w.y + dy * step);
    }
  });
}

function buildPieces() {
  const words = [...new Set(pieces.map(p => p.word))];
  $('pieces').innerHTML = words
    .map(
      w =>
        `<div class="word">${pieces.map((p, i) => (p.word === w ? `<button type="button" lang="ar" data-i="${i}">${p.s}</button>` : '')).join('')}</div>`,
    ) // prettier-ignore
    .join('');
}

function renderSaved() {
  if (!saved.length) return;
  $('saved').innerHTML = '';
  for (const s of saved) {
    const b = document.createElement('button');
    b.type = 'button';
    const when = new Date(s.t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    b.innerHTML = '<small></small><span></span>';
    b.querySelector('small')!.textContent = when;
    b.querySelector('span')!.textContent = s.note || 'No note';
    b.addEventListener('click', () => {
      setState(s.state);
      $<HTMLTextAreaElement>('note').value = s.note;
    });
    $('saved').append(b);
  }
}

async function save() {
  const note = $<HTMLTextAreaElement>('note').value.trim();
  if (!db) {
    $('saveMsg').textContent = 'Saving needs the page open on claude.ai, signed in. The draft is kept in this browser.';
    return;
  }
  $<HTMLButtonElement>('save').disabled = true;
  try {
    await db.collection('layouts').add({ state: JSON.parse(JSON.stringify(state)), note, t: Date.now() });
    $('saveMsg').textContent = 'Saved.';
  } catch (e) {
    $('saveMsg').textContent = `Not saved (${(e as { code?: string })?.code || 'error'}). Try again.`;
  } finally {
    $<HTMLButtonElement>('save').disabled = false;
  }
}

async function start() {
  $<HTMLSelectElement>('start').innerHTML =
    starts.map((s, k) => `<option value="${k}">${s.name}</option>`).join('') +
    '<option value="draft">My draft</option>';
  const draft = load();
  if (draft) {
    state = draft;
    $<HTMLSelectElement>('start').value = 'draft';
  }
  const r = await ask({ kind: 'init' });
  if (!r.init) {
    $('status').textContent = `The engine did not start (${r.error}).`;
    return;
  }
  pieces = r.init.pieces;
  buildPieces();
  redraw();

  $('start').addEventListener('change', e => {
    const v = (e.target as HTMLSelectElement).value;
    if (v !== 'draft') setState(fresh(+v));
  });
  $('undo').addEventListener('click', () => {
    if (!past.length) return;
    future.push(JSON.stringify(state));
    state = JSON.parse(past.pop()!);
    keep();
    redraw();
  });
  $('redo').addEventListener('click', () => {
    if (!future.length) return;
    past.push(JSON.stringify(state));
    state = JSON.parse(future.pop()!);
    keep();
    redraw();
  });
  $('view').addEventListener('click', e => {
    const svg = $('view').querySelector('svg');
    if (!svg) return;
    const vb = svg.viewBox.baseVal,
      rc = svg.getBoundingClientRect(),
      x = ((e.clientX - rc.left) / rc.width) * vb.width,
      y = ((e.clientY - rc.top) / rc.height) * vb.height;
    // the smallest box under the tap: a small piece inside a big one's box can still be picked
    let best = -1,
      area = Infinity;
    boxes.forEach((b, i) => {
      const a = (b.x1 - b.x0) * (b.y1 - b.y0);
      if (x >= b.x0 - 6 && x <= b.x1 + 6 && y >= b.y0 - 6 && y <= b.y1 + 6 && a < area) [best, area] = [i, a];
    });
    select(best);
  });
  $('pieces').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-i]');
    if (b) select(+b.dataset.i!);
  });
  $('mWord').addEventListener('click', () => ((movePiece = false), syncControls()));
  $('mPiece').addEventListener('click', () => ((movePiece = true), syncControls()));
  $('up').addEventListener('click', () => move(0, 1));
  $('down').addEventListener('click', () => move(0, -1));
  $('left').addEventListener('click', () => move(-1, 0));
  $('right').addEventListener('click', () => move(1, 0));
  $('reset').addEventListener('click', () =>
    change(s => (s.layout.nudge = (s.layout.nudge || []).filter(q => q.i !== sel))),
  );
  $('lift').addEventListener('change', e => {
    const on = (e.target as HTMLInputElement).checked;
    change(s => {
      const up = new Set(s.layout.up || []);
      if (on) up.add(sel);
      else up.delete(sel);
      s.layout.up = [...up].sort((a, b) => a - b);
    });
  });
  $('variants').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-v]');
    if (b && sel >= 0) change(s => (s.layout.lv[sel] = +b.dataset.v!));
  });
  $('vowels').addEventListener('change', e => change(s => (s.frame.vowels = (e.target as HTMLInputElement).checked))); // prettier-ignore
  $('orn').addEventListener('change', e => change(s => (s.frame.ornaments = (e.target as HTMLInputElement).checked))); // prettier-ignore
  $('density').addEventListener('change', e => change(s => (s.frame.density = +(e.target as HTMLInputElement).value))); // prettier-ignore
  $('clear').addEventListener('change', e => change(s => (s.frame.clearance = +(e.target as HTMLInputElement).value))); // prettier-ignore
  $('save').addEventListener('click', save);
  document.addEventListener('keydown', e => {
    if ((e.target as HTMLElement).closest('textarea, select, input')) return;
    const d = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (d) {
      e.preventDefault();
      move(d[0], d[1]);
    }
  });

  // the page's store, when it runs on claude.ai
  const claude = (window as unknown as { claude?: Claude }).claude;
  db = claude ? ((await claude.use('db')) as Db | null) : null;
  db?.collection('layouts').onSnapshot(
    s => {
      saved = s.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<Saved, 'id'>) }))
        .filter(d => d.state?.layout)
        .sort((a, b) => b.t - a.t);
      renderSaved();
    },
    () => (db = null),
  );
}
start();
