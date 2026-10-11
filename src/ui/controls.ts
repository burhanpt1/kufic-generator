// UI state and the generic controls: segmented button groups, sliders, checkboxes, sample texts, palettes.
import { PALETTES, PRESETS } from './presets';

export interface State {
  layout: string;
  rotation: number;
  center: string;
  palette: number;
  marks: string;
  vowels: string;
  ra: string;
  ayn: string;
  la: string;
  terminal: string;
  reach: string;
  colourMode: string;
  ground: string;
  corners: string;
  bandStyle: string;
  tiling: string;
  letterStyle: string;
  edKey: string;
  edForm: string;
  ovr: Record<string, string[] | undefined>;
}
type StrKey = { [K in keyof State]: State[K] extends string ? K : never }[keyof State];

export const initialState = (): State => ({
  layout: 'rings', rotation: 0, center: 'abjad', palette: 0, marks: 'dots', vowels: 'modern', ra: 'desc', ayn: 'open',
  la: 'knot', terminal: 'none', reach: 'tails', colourMode: 'solid', ground: 'plain', corners: 'none',
  bandStyle: 'lines', tiling: '488', letterStyle: 'solid', edKey: 'BEH', edForm: 'iso', ovr: {},
}); // prettier-ignore

/** Segmented groups whose element id is also the state key. */
export const SEGS: StrKey[] = [
  'layout', 'center', 'corners', 'bandStyle', 'ground', 'tiling', 'terminal', 'reach', 'letterStyle', 'colourMode',
  'ra', 'ayn', 'la', 'marks', 'vowels',
]; // prettier-ignore
/** Sliders, checkboxes and the text box: any input re-renders. */
export const INPUTS = [
  'text', 'asc', 'gap', 'weight', 'soft', 'grid', 'rings', 'contrast', 'repeat', 'rhythm', 'taper', 'centreSize',
  'geoAngle', 'geoScale',
]; // prettier-ignore

export type Lookup = <T extends HTMLElement = HTMLInputElement>(id: string) => T;
export const lookup =
  (doc: Document): Lookup =>
  <T extends HTMLElement>(id: string) =>
    doc.getElementById(id) as T;

/** Wire a segmented group: clicking a button stores its data-v in state[key], then runs after() and render(). */
export function seg<K extends keyof State>(
  $: Lookup,
  state: State,
  id: string,
  key: K,
  cast: ((v: string) => State[K]) | null,
  render: () => void,
  after?: () => void,
) {
  $(id).addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || b.style.visibility === 'hidden') return;
    state[key] = (cast ? cast(b.dataset.v!) : b.dataset.v) as State[K];
    [...$(id).children].forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    if (after) after();
    render();
  });
}
/** Set a segmented group's value from code (presets). */
export function setSeg($: Lookup, state: State, id: string, key: StrKey, v: string) {
  state[key] = v;
  [...$(id).children].forEach(c =>
    c.setAttribute(
      'aria-pressed',
      String((c as HTMLElement).dataset.v === String(v) && (c as HTMLElement).style.visibility !== 'hidden'),
    ),
  );
}

export function wireControls($: Lookup, doc: Document, state: State, render: () => void) {
  SEGS.forEach(k => seg($, state, k, k, null, render));
  seg($, state, 'rot', 'rotation', Number, render);
  PRESETS.forEach(([name, txt]) => {
    const b = doc.createElement('button');
    b.textContent = name;
    b.style.fontFamily = 'inherit';
    b.style.fontSize = '13px';
    b.onclick = () => {
      $<HTMLTextAreaElement>('text').value = txt;
      render();
    };
    $('chips').append(b);
  });
  $('chips').style.direction = 'ltr';
  PALETTES.forEach((p, i) => {
    const b = doc.createElement('button');
    b.style.background = p.paper;
    b.title = p.name;
    b.setAttribute('aria-label', p.name);
    b.setAttribute('aria-pressed', String(i === 0));
    const s = doc.createElement('span');
    s.style.background = p.ink;
    b.append(s);
    b.onclick = () => {
      state.palette = i;
      [...$('swatches').children].forEach((c, j) => c.setAttribute('aria-pressed', String(j === i)));
      render();
    };
    $('swatches').append(b);
  });
  INPUTS.forEach(id => $(id).addEventListener('input', render));
}
