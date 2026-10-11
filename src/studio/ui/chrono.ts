// Chronogram helper (COMPOSITION_ENGINE.md §8): read a phrase's abjad value, complete it to a year, or find phrases
// from a word bank. The counting conventions are visible settings and follow the composition's style.
import type { Composition } from '../../model/schema';
import {
  abjadTable,
  ahFromCE,
  ahStartCE,
  breakdown,
  CATEGORIES,
  complete,
  DEFAULT_CATEGORIES,
  find,
  valueOf,
  wordBank,
} from '../chronogram';
import type { Suggestion } from '../chronogram';
import { loadCategories, saveCategories } from '../storage';
import { mainSlot } from './gallery';
import { linePreview } from './letters';
import type { App } from './main';
import { $, h } from './main';

type Mode = 'complete' | 'read' | 'find';
const HELP: Record<Mode, string> = {
  complete:
    'Write what you want to say, set the year, and the tool suggests words to add, or words to swap, so the letters add up exactly. This is how chronograms are usually composed.',
  read: 'Type any phrase to see each letter’s value and the total, and the year that total would mark.',
  find: 'Search the word bank for combinations that add up to the target, optionally around a word you must use. Most results are nonsense; look for the one that reads well.',
};

export function wireChrono(app: App) {
  let mode: Mode = 'complete';
  const cats = new Set(loadCategories(DEFAULT_CATEGORIES)),
    phrase = $<HTMLInputElement>('chPhrase');
  const opts = (): Composition['style']['abjad'] => ({
    system: (document.querySelector('input[name=chSys]:checked') as HTMLInputElement).value as 'mashriqi',
    taMarbuta: +(document.querySelector('input[name=chTm]:checked') as HTMLInputElement).value as 5,
  });
  const table = () => abjadTable(opts());
  const bank = () => wordBank(cats, $<HTMLTextAreaElement>('chBank').value, table());
  const bankCount = () => ($('chBankCount').textContent = `${bank().length} words in the bank`);

  function target() {
    const y = +$<HTMLInputElement>('chYear').value,
      cal = $<HTMLSelectElement>('chCal').value;
    if (cal === 'g') {
      const hy = ahFromCE(y);
      $('chTargetNote').textContent =
        `${y} CE: the Hijri year ${hy} begins during it (${hy - 1} AH covers its first months). Aiming for ${hy}.`;
      return hy;
    }
    $('chTargetNote').textContent = cal === 'h' ? `${y} AH begins around ${Math.round(ahStartCE(y))} CE.` : '';
    return y;
  }
  function refresh() {
    $('chHelp').textContent = HELP[mode];
    $('chTargetRow').classList.toggle('hidden', mode === 'read');
    $('chTargetNote').classList.toggle('hidden', mode === 'read');
    $('chFindOpts').classList.toggle('hidden', mode !== 'find');
    $('chGo').classList.toggle('hidden', mode === 'read');
    $('chGo').textContent = mode === 'complete' ? 'Suggest words' : 'Search';
    $('chPhraseLab').textContent = mode === 'find' ? 'Phrase (fills when you pick a result)' : 'Your phrase';
    const T = table(),
      s = phrase.value;
    $('chBreak').innerHTML = '';
    for (const x of breakdown(s, T))
      $('chBreak').append(x ? h('span', {}, h('b', {}, x.c), h('small', {}, String(x.v))) : h('i'));
    const v = valueOf(s, T);
    $('chTotal').textContent = v.toLocaleString('en-GB');
    $('chPreview').innerHTML = s.trim() ? linePreview(s, app.comp.style) : '';
    $('chYears').textContent = v ? `As a Hijri year, ${v} AH begins around ${Math.round(ahStartCE(v))} CE.` : '';
    if (mode !== 'read' && s.trim()) {
      const t = target(),
        d = t - v;
      $('chDiff').textContent = d === 0 ? 'Exactly right' : d > 0 ? `${d} short of ${t}` : `${-d} over ${t}`;
    } else $('chDiff').textContent = '';
  }

  function usePhrase(p: string) {
    const n = structuredClone(app.comp),
      slot = mainSlot(n);
    if (!slot) return;
    n.texts[slot].text = p;
    n.style.abjad = opts();
    app.set(n);
    app.showTab('editor');
  }
  function result(s: Suggestion) {
    const note =
      s.kind === 'swap'
        ? `swaps ${s.replaced} for ${s.words[0].w}`
        : (s.kind === 'add' ? 'adds ' : '') + s.words.map(w => `${w.w} ${w.v}`).join(' · ');
    return h(
      'div',
      { class: 'res' },
      h('div', {}, h('div', { class: 'p' }, s.phrase), h('div', { class: 'v' }, note)),
      h(
        'div',
        { class: 'bar' },
        h('button', {
          textContent: 'Use',
          title: 'Put this phrase in the box above',
          onclick: () => {
            phrase.value = s.phrase;
            refresh();
          },
        }),
        h('button', {
          textContent: 'Compose',
          title: 'Use this phrase as the composition’s main text',
          onclick: () => usePhrase(s.phrase),
        }),
      ),
    );
  }
  $('chGo').onclick = () => {
    const T = table(),
      t = target(),
      box = $('chResults'),
      status = (m: string) => ($('chStatus').textContent = m);
    box.innerHTML = '';
    if (mode === 'complete') {
      const s = phrase.value.trim(),
        d = t - valueOf(s, T);
      if (!s) return status('Write a phrase first.');
      if (d === 0) return status('Your phrase already adds up to the target.');
      const res = complete(s, t, bank(), T);
      res.forEach(r => box.append(result(r)));
      status(
        res.length
          ? `${d > 0 ? `${d} short` : `${-d} over`}. ${res.length} way${res.length > 1 ? 's' : ''} to make it exact.`
          : `Nothing in the word bank closes the gap of ${Math.abs(d)}. Switch on more categories, add your own words, or rephrase.`,
      );
      return;
    }
    const must = $<HTMLInputElement>('chMust').value.trim(),
      res = find(t, bank(), T, +$<HTMLSelectElement>('chMax').value, must);
    res.forEach(r => box.append(result(r)));
    status(
      res.length
        ? `${res.length >= 150 ? '150+' : res.length} phrase${res.length === 1 ? '' : 's'} worth ${t}, fewest words first.`
        : must && valueOf(must, T) > t
          ? `“${must}” alone is worth ${valueOf(must, T)}, more than ${t}.`
          : `No combination adds up to ${t}. Switch on more categories or allow more words.`,
    );
  };
  $('chUse').onclick = () => phrase.value.trim() && usePhrase(phrase.value.trim());

  document.querySelectorAll<HTMLButtonElement>('#chMode button').forEach(
    b =>
      (b.onclick = () => {
        mode = b.dataset.m as Mode;
        document.querySelectorAll('#chMode button').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
        $('chResults').innerHTML = '';
        $('chStatus').textContent = '';
        refresh();
      }),
  );
  for (const c of Object.keys(CATEGORIES)) {
    const b = h('button', { textContent: c, 'aria-pressed': cats.has(c) });
    b.onclick = () => {
      if (cats.has(c)) cats.delete(c);
      else cats.add(c);
      b.setAttribute('aria-pressed', String(cats.has(c)));
      saveCategories([...cats]);
      bankCount();
    };
    $('chCats').append(b);
  }
  phrase.addEventListener('input', refresh);
  $('chYear').addEventListener('input', refresh);
  $('chCal').addEventListener('change', refresh);
  $('chBank').addEventListener('input', bankCount);
  document.querySelectorAll('input[name=chSys], input[name=chTm]').forEach(r =>
    r.addEventListener('change', () => {
      refresh();
      bankCount();
    }),
  );
  // counting follows the composition's style
  app.onChange(() => {
    const a = app.comp.style.abjad;
    (document.querySelector(`input[name=chSys][value=${a.system}]`) as HTMLInputElement).checked = true;
    (document.querySelector(`input[name=chTm][value="${a.taMarbuta}"]`) as HTMLInputElement).checked = true;
    refresh();
  });
  refresh();
  bankCount();
}
