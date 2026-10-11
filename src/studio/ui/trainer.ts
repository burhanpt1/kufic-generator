// Taste trainer (lab port §3): rate one composition at a time (Veto, Meh, Like, Skip); two logistic models learn
// from the ratings and steer what is shown next and how the gallery breeds. Ratings stay in this browser.
import type { Evaluated } from '../../evolve/breed';
import { METRIC_LABELS } from '../../evolve/critic';
import { TRAITS } from '../../evolve/genes';
import { EvalPool } from '../../evolve/pool';
import { Rng } from '../../evolve/rng';
import { capRatings, learned, leastSure, MIN_RATINGS, parseLabRatings, proposals, train } from '../../evolve/trainer';
import type { Grade } from '../../evolve/trainer';
import type { Composition } from '../../model/schema';
import { saveRatings } from '../storage';
import { mainSlot } from './gallery';
import type { App } from './main';
import { $, h } from './main';
import { valueLabel } from './labels';

type Shown = { comp: Composition; ev: Evaluated };

export function wireTrainer(app: App) {
  let pool: EvalPool | null = null,
    started = false,
    current: Shown | null = null,
    next: Promise<Shown | null> | null = null;
  const rng = new Rng((Date.now() % 2147483646) + 7 || 1);
  const status = (s: string) => ($('trStatus').textContent = s);
  const texts = (): Composition['texts'] => {
    const t = $<HTMLInputElement>('trText').value.trim() || 'بسم الله الرحمن الرحيم';
    return { main: { text: t, repeat: 'fill', wordGap: 2 } };
  };
  const evalAll = (comps: Composition[], each?: (n: number) => void) => {
    pool ??= new EvalPool(2);
    const out: (Evaluated | null)[] = comps.map(() => null);
    let n = 0;
    return pool
      .run(
        comps,
        (i, o) => {
          out[i] = o.ok ? o.result : null;
          n++;
          each?.(n);
        },
        'tr',
      )
      .then(() => (n === comps.length ? out : null)); // null: cancelled by a newer run
  };

  // three screened proposals, rendered in the background; show the one the liking model is least sure about
  async function prepare(): Promise<Shown | null> {
    const comps = proposals(3, texts(), app.ratings, app.model, { rng });
    const evs = await evalAll(comps);
    if (!evs) return null;
    const ok = comps.map((comp, i) => ({ comp, ev: evs[i] })).filter((x): x is Shown => !!x.ev?.metrics);
    if (!ok.length) return prepare();
    return ok[
      leastSure(
        ok.map(x => ({ comp: x.comp, m: x.ev.metrics })),
        app.model,
      )
    ];
  }
  async function showNext() {
    status('Rendering…');
    const s = await (next ?? prepare());
    next = null;
    if (!s) return;
    current = s;
    $('trPic').innerHTML = s.ev.svg;
    note();
    next = prepare(); // the next one renders while this is shown
  }
  function note() {
    const n = app.ratings.length;
    status(
      n < MIN_RATINGS
        ? `${n} rating${n === 1 ? '' : 's'}; the models start after ${MIN_RATINGS}.`
        : `${n} ratings.` +
            (current && app.model
              ? ` Veto chance ${Math.round(app.model.pVeto(current.comp) * 100)}%, liking ${Math.round(app.model.pLike(current.comp, current.ev.metrics) * 100)}%.`
              : ''),
    );
  }
  function retrain() {
    app.ratings = capRatings(app.ratings);
    saveRatings(app.ratings);
    app.model = train(app.ratings);
    drawLearned();
  }
  function rate(r: Grade | null) {
    if (!current) return;
    if (r !== null) {
      app.ratings.push({ comp: current.comp, r, m: current.ev.metrics ?? {}, at: Date.now() });
      retrain();
    }
    current = null;
    showNext();
  }

  // ---- what it has learned ----
  const trait = (f: { trait: keyof typeof TRAITS; value: string | number | boolean }) =>
    `${TRAITS[f.trait].label.toLowerCase()}: ${f.trait === 'palette' ? valueLabel(f.trait, f.value) : valueLabel(f.trait, f.value).toLowerCase()}`;
  function drawLearned() {
    const box = $('trLearned');
    box.innerHTML = '';
    if (!app.model) {
      box.append(h('p', { class: 'note' }, `Nothing yet: rate at least ${MIN_RATINGS} compositions.`));
      return;
    }
    const l = learned(app.model),
      line = (head: string, items: string[]) =>
        items.length && box.append(h('p', {}, h('b', {}, head + ': '), items.join(', ') + '.'));
    line('You like', l.likes.map(trait));
    line('You rate lower', l.lower.map(trait));
    line('You veto', l.vetoes.map(trait));
    line(
      'Measures that matter most',
      l.measures.map(m => (METRIC_LABELS[m.key] ?? m.key).toLowerCase()),
    );
    if (!l.likes.length && !l.lower.length && !l.vetoes.length)
      box.append(h('p', { class: 'note' }, 'No trait stands out yet; keep rating.'));
  }

  // ---- buttons and keys ----
  $('trVeto').onclick = () => rate(0);
  $('trMeh').onclick = () => rate(0.5);
  $('trLike').onclick = () => rate(1);
  $('trSkip').onclick = () => rate(null);
  document.addEventListener('keydown', e => {
    if ($('trainer').classList.contains('hidden') || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement).matches('input, textarea, select')) return;
    const r = ({ '3': 0, ArrowLeft: 0, '2': 0.5, ArrowDown: 0.5, '1': 1, ArrowRight: 1, ' ': null } as const)[
      e.key as '3'
    ];
    if (r === undefined) return;
    e.preventDefault();
    rate(r);
  });
  $('trCopy').onclick = async () => {
    const data = JSON.stringify(app.ratings.map(r => ({ comp: r.comp, r: r.r, at: r.at })));
    try {
      await navigator.clipboard.writeText(data);
      $('trCopy').textContent = 'Copied';
    } catch {
      $('trCopy').textContent = 'Copy failed';
    }
    setTimeout(() => ($('trCopy').textContent = 'Copy ratings'), 1500);
  };
  $('trForget').onclick = () => {
    if (!app.ratings.length || !confirm(`Forget all ${app.ratings.length} ratings?`)) return;
    app.ratings = [];
    retrain();
    note();
  };
  $('trImport').onclick = async () => {
    const out = $('trImportNote'),
      p = parseLabRatings($<HTMLTextAreaElement>('trLab').value, texts().main.text);
    if (p.error) return void (out.textContent = p.error);
    if (!p.items.length) return void (out.textContent = 'No ratings found.');
    next = null; // the import's run replaces any background render
    const evs = await evalAll(
      p.items.map(i => i.comp),
      n => (out.textContent = `Re-measuring ${n} / ${p.items.length}…`),
    );
    if (!evs) return void (out.textContent = 'Interrupted; try again.');
    let added = 0;
    p.items.forEach((it, i) => {
      if (!evs[i]?.metrics) return;
      app.ratings.push({ comp: it.comp, r: it.r, m: evs[i]!.metrics!, at: Date.now() });
      added++;
    });
    retrain();
    const drops = [...p.dropped].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`);
    out.textContent =
      `Imported ${added} rating${added === 1 ? '' : 's'}` +
      (p.skipped ? `, skipped ${p.skipped} unreadable` : '') +
      (p.items.length - added ? `, ${p.items.length - added} could not be laid out` : '') +
      '.' +
      (drops.length ? ` Not carried over: ${drops.join('; ')}.` : '');
    $<HTMLTextAreaElement>('trLab').value = '';
    if (started) showNext();
  };

  function start() {
    if (started) return;
    started = true;
    const slot = mainSlot(app.comp),
      t = slot ? app.comp.texts[slot]?.text : '';
    if (!$<HTMLInputElement>('trText').value && t) $<HTMLInputElement>('trText').value = t.replace(/\n/g, ' ');
    showNext();
  }
  $('trText').onchange = () => {
    if (!started) return;
    next = null;
    showNext();
  };
  document.querySelector<HTMLButtonElement>('.tabs [data-tab="trainer"]')!.addEventListener('click', start);
  drawLearned();
}
