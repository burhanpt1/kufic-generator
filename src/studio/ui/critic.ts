// The optional visual critic panel: off until the user gives a key and presses Ask.
import { svgToPngBase64 } from '../../critic/raster';
import { applySuggestions, askCritic, CRITIC_MODELS } from '../../critic/visual';
import type { Critique } from '../../critic/visual';
import { TRAITS } from '../../evolve/genes';
import { valueLabel } from './labels';
import type { App } from './main';
import { $, h } from './main';

const KEY = 'kufi-critic-key';
const store = (remember: boolean) => {
  try {
    return remember ? localStorage : sessionStorage;
  } catch {
    return null;
  }
};

export function wireCritic(app: App) {
  const key = $<HTMLInputElement>('criticKey'),
    remember = $<HTMLInputElement>('criticRemember'),
    model = $<HTMLSelectElement>('criticModel');
  CRITIC_MODELS.forEach(m => model.append(h('option', { value: m, textContent: m })));
  try {
    const saved = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    if (saved) {
      key.value = saved;
      remember.checked = !!localStorage.getItem(KEY);
    }
  } catch {
    /* storage unavailable */
  }
  const status = (s: string) => ($('criticStatus').textContent = s);
  function show(c: Critique) {
    const out = $('criticOut');
    out.innerHTML = '';
    out.append(h('p', {}, c.critique || '(no critique)'));
    if (!c.suggestions.length) return;
    const list = h('div', { class: 'results' });
    for (const s of c.suggestions)
      list.append(
        h(
          'div',
          { class: 'res' },
          h(
            'div',
            {},
            h('div', {}, `${TRAITS[s.trait].label}: ${valueLabel(s.trait, s.value)}`),
            h('div', { class: 'v' }, s.reason),
          ),
          h('button', { textContent: 'Apply', onclick: () => app.set(applySuggestions(app.comp, [s])) }),
        ),
      );
    out.append(
      list,
      h('button', { textContent: 'Apply all', onclick: () => app.set(applySuggestions(app.comp, c.suggestions)) }),
    );
  }
  let busy: AbortController | null = null;
  $('criticAsk').onclick = async () => {
    const k = key.value.trim();
    if (!k) return status('Enter your API key first.');
    if (!app.svg) return status('Nothing to show yet.');
    try {
      store(!remember.checked)?.removeItem(KEY);
      store(remember.checked)?.setItem(KEY, k);
    } catch {
      /* storage unavailable */
    }
    busy?.abort();
    busy = new AbortController();
    status('Asking…');
    try {
      const png = await svgToPngBase64(app.svg);
      show(await askCritic(app.comp, png, { apiKey: k, model: model.value, signal: busy.signal }));
      status('');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') status('The critic could not answer: ' + (e as Error).message);
    }
  };
}
