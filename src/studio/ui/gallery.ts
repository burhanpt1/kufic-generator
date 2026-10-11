// Gallery (COMPOSITION_ENGINE.md §8, level 1): presets, Breed (pick one or two, lock traits, vary) and favourites.
import { breedFrom, freshGeneration } from '../../evolve/breed';
import type { Evaluated } from '../../evolve/breed';
import { EvalPool } from '../../evolve/pool';
import { TRAITS, traitsOf } from '../../evolve/genes';
import type { Trait, Traits } from '../../evolve/genes';
import { crossover, mutate, randomComposition } from '../../evolve/operators';
import { Rng } from '../../evolve/rng';
import { learn, newTaste, score } from '../../evolve/taste';
import { blendScore, screenGeneration } from '../../evolve/trainer';
import type { Composition, TextBorder } from '../../model/schema';
import { PRESETS } from '../../model/presets';
import { loadFavourites, saveFavourites } from '../storage';
import type { Favourite } from '../storage';
import type { App } from './main';
import { $, h } from './main';
import { valueLabel } from './labels';

const N = 16;
/** The slot the main text lives in: the first text border's. */
export const mainSlot = (c: Composition) =>
  (c.root.child.borders.find(b => b.type === 'textBorder') as TextBorder | undefined)?.text ?? Object.keys(c.texts)[0];

export function wireGallery(app: App) {
  // thumbnails for presets and favourites share a small pool so breeding keeps its own
  const thumbs = new EvalPool(1),
    thumbCache = new Map<string, string>();
  function thumbnails(items: { comp: Composition; el: HTMLElement }[]) {
    const todo = items.filter(it => {
      const k = JSON.stringify(it.comp),
        s = thumbCache.get(k);
      if (s) it.el.innerHTML = s;
      return !s;
    });
    thumbs.run(
      todo.map(t => t.comp),
      (i, o) => {
        if (!o.ok) return;
        thumbCache.set(JSON.stringify(todo[i].comp), o.result.svg);
        todo[i].el.innerHTML = o.result.svg;
      },
      't',
    );
  }

  // ---- presets & favourites ----
  const favs: Favourite[] = loadFavourites();
  function card(title: string, comp: Composition, tools: [string, string, () => void][] = []) {
    const pic = h('div', { class: 'pic' }),
      c = h(
        'div',
        { class: 'card', tabIndex: 0, title: `Open “${title}” in the editor` },
        pic,
        h('div', { class: 'cap' }, title),
      );
    const open = () => {
      app.set(structuredClone(comp));
      app.showTab('editor');
    };
    c.onclick = open;
    c.onkeydown = e => e.key === 'Enter' && open();
    if (tools.length)
      c.append(
        h(
          'div',
          { class: 'tools' },
          ...tools.map(([label, tip, f]) =>
            h('button', {
              textContent: label,
              title: tip,
              'aria-label': tip,
              onclick: (e: Event) => {
                e.stopPropagation();
                f();
              },
            }),
          ),
        ),
      );
    return { c, pic };
  }
  function drawLibrary() {
    const items: { comp: Composition; el: HTMLElement }[] = [];
    $('presets').innerHTML = '';
    for (const p of PRESETS) {
      const { c, pic } = card(p.name, p.comp);
      $('presets').append(c);
      items.push({ comp: p.comp, el: pic });
    }
    $('favs').innerHTML = favs.length ? '' : '<p class="note">Nothing saved yet.</p>';
    favs.forEach((f, i) => {
      const { c, pic } = card(f.name, f.comp, [
        [
          '×',
          'Remove from favourites',
          () => {
            favs.splice(i, 1);
            saveFavourites(favs);
            drawLibrary();
          },
        ],
      ]);
      $('favs').append(c);
      items.push({ comp: f.comp, el: pic });
    });
    thumbnails(items);
  }
  $('favAdd').onclick = () => {
    const name = prompt('Name for this composition', `Favourite ${favs.length + 1}`);
    if (name == null) return;
    favs.unshift({ name: name || `Favourite ${favs.length + 1}`, comp: structuredClone(app.comp), at: Date.now() });
    saveFavourites(favs);
    drawLibrary();
  };

  // ---- breeding ----
  let gen: Composition[] = [],
    results: (Evaluated | null)[] = [],
    picks = new Set<number>();
  const locks: Traits = {},
    rng = new Rng(Date.now() % 2147483646 || 1);
  const status = (s: string) => ($('breedStatus').textContent = s);
  const tasteNote = () =>
    ($('tasteNote').textContent = app.taste.picks ? `Taste learned from ${app.taste.picks} picks.` : '');
  // with a trained model (six or more trainer ratings): 0.4 × critic + 0.6 × predicted liking
  const rank = (i: number) => {
    const m = results[i]?.metrics ?? null;
    return m ? blendScore(score(m, app.taste), app.model, gen[i], m) : 0;
  };

  function drawLocks() {
    const box = $('locks');
    box.innerHTML = '';
    const one = picks.size === 1 ? traitsOf(gen[[...picks][0]]) : null,
      keys = new Set<Trait>([...(Object.keys(locks) as Trait[]), ...((one ? Object.keys(one) : []) as Trait[])]);
    if (!keys.size) return;
    box.append(h('span', { class: 'note' }, one ? 'Lock: ' : 'Locked: '));
    for (const k of keys) {
      const v = locks[k] ?? one?.[k];
      if (v === undefined) continue;
      const on = locks[k] !== undefined;
      box.append(
        h('button', {
          'aria-pressed': on,
          textContent: `${TRAITS[k].label}: ${valueLabel(k, v)}`,
          title: on ? 'Unlock' : 'Keep this in every child',
          onclick: () => {
            if (on) delete locks[k];
            else locks[k] = v;
            drawLocks();
          },
        }),
      );
    }
  }
  // one card element per candidate, filled when its result arrives and moved (not rebuilt) when the order changes
  let cards: HTMLElement[] = [];
  function fillCard(i: number) {
    const r = results[i],
      c = cards[i];
    c.innerHTML = r ? r.svg : '<p class="note">…</p>';
    if (!r) return;
    c.append(
      h('div', { class: 'cap' }, `${rank(i).toFixed(2)} · ${r.ms.toFixed(0)} ms`),
      h(
        'div',
        { class: 'tools' },
        h('button', {
          textContent: '✎',
          title: 'Open in the editor',
          'aria-label': 'Open in the editor',
          onclick: (e: Event) => {
            e.stopPropagation();
            app.set(structuredClone(gen[i]));
            app.showTab('editor');
          },
        }),
      ),
    );
  }
  function makeCards() {
    cards = gen.map((_, i) => {
      const c = h('div', { class: 'card', tabIndex: 0, 'aria-pressed': false });
      const toggle = () => {
        if (picks.has(i)) picks.delete(i);
        else {
          if (picks.size >= 2) picks.delete([...picks][0]);
          picks.add(i);
        }
        drawCands();
        drawLocks();
      };
      c.onclick = toggle;
      c.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle());
      return c;
    });
    cards.forEach((_, i) => fillCard(i));
  }
  function drawCands() {
    const box = $('cands');
    const order = gen.map((_, i) => i).sort((a, b) => rank(b) - rank(a));
    order.forEach((i, k) => {
      const c = cards[i];
      c.classList.toggle('picked', picks.has(i));
      c.setAttribute('aria-pressed', String(picks.has(i)));
      if (box.children[k] !== c) box.insertBefore(c, box.children[k] ?? null);
    });
  }
  /** Evaluate a generation. With a trained model, candidates after the first `keep` that it expects to be vetoed
   *  are re-made with `make` (up to 25 tries each). */
  async function run(comps: Composition[], keep = 0, make?: () => Composition) {
    let swapped = 0;
    if (app.model && make) {
      const s = screenGeneration(comps.slice(keep), app.model, make);
      comps = [...comps.slice(0, keep), ...s.comps];
      swapped = s.swapped;
    }
    gen = comps;
    results = comps.map(() => null);
    picks = new Set();
    $('cands').innerHTML = '';
    makeCards();
    drawCands();
    drawLocks();
    const t0 = performance.now();
    let n = 0;
    status(`0 / ${N}`);
    await app.pool.run(comps, (i, o) => {
      n++;
      results[i] = o.ok ? o.result : null;
      status(`${n} / ${N}`);
      fillCard(i);
      drawCands();
    });
    if (n === comps.length)
      status(
        `${N} candidates in ${((performance.now() - t0) / 1000).toFixed(1)} s` +
          (swapped ? ` · ${swapped} likely veto${swapped === 1 ? '' : 'es'} swapped out` : ''),
      );
  }
  const texts = (): Composition['texts'] => {
    const t = $<HTMLInputElement>('breedText').value.trim() || 'بسم الله الرحمن الرحيم';
    return { main: { text: t, repeat: 'fill', wordGap: 2 } };
  };
  $('fresh').onclick = () => {
    const o = { rng, taste: app.taste, locks },
      t = texts();
    run(freshGeneration(N, t, o), 0, () => randomComposition(t, o));
  };
  const mutant = (parents: Composition[], rate: number) => {
    const o = { rng, taste: app.taste, locks };
    return () => mutate(parents.length > 1 ? crossover(parents[0], parents[1], o) : parents[0], rate, o);
  };
  $('breed').onclick = () => {
    if (!picks.size) return status('Pick one or two candidates first.');
    const ps = [...picks].map(i => ({ comp: gen[i], m: results[i]?.metrics ?? null }));
    app.taste = learn(
      app.taste,
      ps,
      results.map(r => r?.metrics ?? null),
    );
    app.saveTaste();
    tasteNote();
    const parents = ps.map(p => p.comp);
    run(breedFrom(parents, N, 0.5, { rng, taste: app.taste, locks }), parents.length, mutant(parents, 0.7));
  };
  $('vary').onclick = () =>
    run(breedFrom([app.comp], N, 0.4, { rng, taste: app.taste, locks }), 1, mutant([app.comp], 0.56));
  $('tasteReset').onclick = () => {
    app.taste = newTaste();
    app.saveTaste();
    tasteNote();
    cards.forEach((_, i) => fillCard(i)); // scores changed
    drawCands();
  };
  // the breeding text follows the current composition's main text
  app.onChange(() => {
    const slot = mainSlot(app.comp),
      t = slot ? app.comp.texts[slot]?.text : '';
    if (t && document.activeElement !== $('breedText')) $<HTMLInputElement>('breedText').value = t.replace(/\n/g, ' ');
  });

  drawLibrary();
  tasteNote();
}
