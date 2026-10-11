// Letter editor: pick a letter and form, click cells to draw. Edits are glyph overrides kept in localStorage.
import { GROUPS, getRows, setOverrides } from '../engine';
import type { Form } from '../engine';
import type { Lookup, State } from './controls';
import { seg } from './controls';
import { LETTER_CHARS } from './presets';

export const STORAGE_KEY = 'kufi-glyphs';

export function loadOverrides(state: State) {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) state.ovr = JSON.parse(s) || {};
  } catch {
    /* storage unavailable */
  }
  setOverrides(state.ovr);
}

export function wireEditor($: Lookup, doc: Document, state: State, render: () => void) {
  const letterOpts = () => ({ ra: state.ra, ayn: state.ayn, la: state.la }) as Parameters<typeof getRows>[2];
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
    if (rows.join('|') !== orig.join('|')) state.ovr[k] = rows;
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

  seg($, state, 'edLetters', 'edKey', null, render, () => drawEditor());
  seg($, state, 'edForm', 'edForm', null, render, () => drawEditor());
  GROUPS.forEach(k => {
    const b = doc.createElement('button');
    b.dataset.v = k;
    b.textContent = LETTER_CHARS[k];
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
    try {
      const o = JSON.parse(t.value);
      if (o && typeof o === 'object') {
        state.ovr = o;
        saveOvr();
        drawEditor();
        render();
        t.classList.add('hidden');
      }
    } catch {
      t.setCustomValidity('That isn’t a letter set. Copy one with “Copy set” first.');
      t.reportValidity();
      setTimeout(() => t.setCustomValidity(''), 2500);
    }
  };
  return { drawEditor };
}
