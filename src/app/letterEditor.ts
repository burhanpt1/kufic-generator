// Letter editor: pick a letter and form, click cells to draw. Edits are glyph overrides kept in localStorage.
import { GROUPS, getRows, overrideFor, setOverrides } from '../engine';
import type { Form, GlyphOverride } from '../engine';

/** What the editor reads and writes: the letter and form being edited, the letter variants, and the overrides. */
export interface EditorState {
  edKey: string;
  edForm: string;
  ra: string;
  ayn: string;
  la: string;
  meem?: string;
  sad?: string;
  ovr: Record<string, GlyphOverride | undefined>;
}
type State = EditorState;
export type Lookup = <T extends HTMLElement = HTMLInputElement>(id: string) => T;
export const lookup =
  (doc: Document): Lookup =>
  <T extends HTMLElement>(id: string) =>
    doc.getElementById(id) as T;

/** Wire a segmented group: clicking a button stores its data-v in state[key], then runs after() and render(). */
function seg(
  $: Lookup,
  state: State,
  id: 'edLetters' | 'edForm',
  key: 'edKey' | 'edForm',
  render: () => void,
  after: () => void,
) {
  $(id).addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || b.style.visibility === 'hidden') return;
    state[key] = b.dataset.v!;
    [...$(id).children].forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    after();
    render();
  });
}

export const LETTER_CHARS: Record<string, string> = {
  ALEF: 'ا', BEH: 'ب', HAH: 'ح', DAL: 'د', REH: 'ر', SEEN: 'س', SAD: 'ص', TAH: 'ط', AIN: 'ع', FEH: 'ف',
  QAF: 'ق', KAF: 'ك', LAM: 'ل', MEEM: 'م', NOON: 'ن', HEH: 'ه', WAW: 'و', YEH: 'ي', LAMALEF: 'لا', HAMZA: 'ء',
}; // prettier-ignore

export const STORAGE_KEY = 'kufi-glyphs';

const FORMS = ['ini', 'med', 'fin', 'iso'],
  MAX_SIDE = 64;
const validRows = (v: unknown): v is string[] =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.length <= MAX_SIDE &&
  v.every(r => typeof r === 'string' && r.length > 0 && r.length <= MAX_SIDE && r.length === v[0].length) &&
  v.every(r => /^[#.]+$/.test(r));

/** A stored or pasted letter set, checked: only entries named 'GROUP.form' whose rows are a non-empty rectangle of
 *  '#' and '.' are kept, as rows alone (older sets) or as `{ rows, base }` (rows with their baseline). `dropped`
 *  counts the rest. */
export function sanitizeOverrides(raw: unknown): { ovr: Record<string, GlyphOverride>; dropped: number } {
  const ovr: Record<string, GlyphOverride> = {};
  let dropped = 0;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ovr, dropped: raw == null ? 0 : 1 };
  for (const [k, v] of Object.entries(raw)) {
    const [group, form, ...more] = k.split('.'),
      known = (GROUPS as readonly string[]).includes(group) && FORMS.includes(form) && !more.length,
      o = v as { rows?: unknown; base?: unknown } | null,
      boxed = !!o && typeof o === 'object' && !Array.isArray(o),
      rows = boxed ? o.rows : v,
      baseOk = !boxed || o.base === undefined || (Number.isInteger(o.base) && (o.base as number) >= 0);
    if (known && baseOk && validRows(rows))
      ovr[k] = boxed && typeof o.base === 'number' ? { rows: rows.slice(), base: o.base } : rows.slice();
    else dropped++;
  }
  return { ovr, dropped };
}
const droppedNote = (n: number) =>
  `Left out ${n} ${n === 1 ? 'entry that wasn’t a letter shape' : 'entries that weren’t letter shapes'}.`;

/** Read the stored letter set into state.ovr. Returns how many stored entries were unusable and dropped. */
export function loadOverrides(state: State): number {
  let dropped = 0;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const r = sanitizeOverrides(JSON.parse(s));
      state.ovr = r.ovr;
      dropped = r.dropped;
      // put the cleaned set back, so the bad entries are gone for good
      if (dropped) localStorage.setItem(STORAGE_KEY, JSON.stringify(r.ovr));
    }
  } catch {
    dropped = 1; // not JSON at all
  }
  setOverrides(state.ovr);
  return dropped;
}

export function wireEditor($: Lookup, doc: Document, state: State, render: () => void, loadDropped = 0) {
  /** A line under the editor (pages without one get the message on the paste box instead). */
  const say = (msg: string) => {
    const n = doc.getElementById('edNote');
    if (n) n.textContent = msg;
    return !!n;
  };
  const letterOpts = () =>
    ({ ra: state.ra, ayn: state.ayn, la: state.la, meem: state.meem, sad: state.sad }) as Parameters<typeof getRows>[2];
  const saveOvr = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.ovr));
    } catch {
      /* storage unavailable */
    }
    setOverrides(state.ovr);
  };
  const curRows = () => getRows(state.edKey, state.edForm as Form, letterOpts());
  function setRows(rows: string[]) {
    const k = state.edKey + '.' + state.edForm;
    setOverrides({ ...state.ovr, [k]: undefined });
    delete state.ovr[k];
    const orig = getRows(state.edKey, state.edForm as Form, letterOpts());
    // stored with the baseline of the glyph it replaces, so the edit sits the same under every letter variant
    if (rows.join('|') !== orig.join('|'))
      state.ovr[k] = overrideFor(state.edKey, state.edForm as Form, rows, letterOpts());
    saveOvr();
    drawEditor();
    render();
  }
  function drawEditor() {
    const rows = curRows(),
      h = rows.length,
      w = rows[0].length,
      g = $('edGrid');
    g.style.gridTemplateColumns = `repeat(${w}, 22px)`;
    g.innerHTML = '';
    const baseRow = state.edKey === 'REH' && state.ra === 'desc' ? h - 3 : h - 1;
    rows.forEach((r, ri) =>
      [...r].forEach((ch, x) => {
        const b = doc.createElement('button');
        b.className = (ch === '#' ? 'on' : '') + (ri === baseRow ? ' base' : '');
        b.setAttribute('aria-label', `row ${h - ri}, column ${x + 1}, ${ch === '#' ? 'filled' : 'empty'}`);
        b.onclick = () => {
          const nr = rows.slice();
          nr[ri] = r.slice(0, x) + (ch === '#' ? '.' : '#') + r.slice(x + 1);
          setRows(nr);
        };
        g.append(b);
      }),
    );
    [...$('edLetters').children].forEach(b =>
      b.classList.toggle(
        'edited',
        Object.keys(state.ovr).some(k => k.startsWith((b as HTMLElement).dataset.v + '.')),
      ),
    );
  }

  seg($, state, 'edLetters', 'edKey', render, () => drawEditor());
  seg($, state, 'edForm', 'edForm', render, () => drawEditor());
  GROUPS.forEach(k => {
    const b = doc.createElement('button');
    b.dataset.v = k;
    b.textContent = LETTER_CHARS[k];
    b.lang = 'ar';
    b.setAttribute('aria-pressed', String(k === state.edKey));
    b.title = k.toLowerCase();
    $('edLetters').append(b);
  });
  $('edAddL').onclick = () => setRows(curRows().map(r => '.' + r));
  $('edAddR').onclick = () => setRows(curRows().map(r => r + '.'));
  $('edDelL').onclick = () => {
    const r = curRows();
    if (r[0].length > 1) setRows(r.map(x => x.slice(1)));
  };
  $('edDelR').onclick = () => {
    const r = curRows();
    if (r[0].length > 1) setRows(r.map(x => x.slice(0, -1)));
  };
  $('edReset').onclick = () => {
    delete state.ovr[state.edKey + '.' + state.edForm];
    saveOvr();
    drawEditor();
    render();
  };
  $('edResetAll').onclick = () => {
    state.ovr = {};
    saveOvr();
    drawEditor();
    render();
  };
  const json = () => $<HTMLTextAreaElement>('edJson');
  $('edExport').onclick = async () => {
    const s = JSON.stringify(state.ovr);
    json().classList.remove('hidden');
    json().value = s;
    try {
      await navigator.clipboard.writeText(s);
      $('edExport').textContent = 'Copied';
      setTimeout(() => ($('edExport').textContent = 'Copy set'), 1500);
    } catch {
      json().select();
    }
  };
  $('edImport').onclick = () => {
    const t = json();
    if (t.classList.contains('hidden') || !t.value.trim()) {
      t.classList.remove('hidden');
      t.value = '';
      t.focus();
      return;
    }
    const refuse = () => {
      t.setCustomValidity('That isn’t a letter set. Copy one with “Copy set” first.');
      t.reportValidity();
      setTimeout(() => t.setCustomValidity(''), 2500);
    };
    let o: unknown;
    try {
      o = JSON.parse(t.value);
    } catch {
      return refuse();
    }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return refuse();
    const { ovr, dropped } = sanitizeOverrides(o),
      kept = Object.keys(ovr).length;
    // nothing usable in a set that had entries: keep the letters as they are
    if (!kept && dropped) {
      if (!say('Nothing pasted: there are no letter shapes in that set.')) refuse();
      return;
    }
    state.ovr = ovr;
    saveOvr();
    drawEditor();
    render();
    t.classList.add('hidden');
    say(`Pasted ${kept} letter shape${kept === 1 ? '' : 's'}.` + (dropped ? ' ' + droppedNote(dropped) : ''));
  };
  if (loadDropped) say(`Your saved letter set was damaged. ${droppedNote(loadDropped)}`);
  return { drawEditor };
}
