// Editor (COMPOSITION_ENGINE.md §8, levels 2 and 3): text slots with their abjad values, guided controls
// (shape → borders → centre → letters → style), and the layers panel over the composition tree.
import { TRAITS, traitsOf } from '../../evolve/genes';
import type { Trait } from '../../evolve/genes';
import { applyTrait, relevantTraits } from '../../evolve/operators';
import { Rng } from '../../evolve/rng';
import type { Composition, FillerNode, SpandrelNode } from '../../model/schema';
import { CompositionSchema } from '../../model/schema';
import { SILHOUETTE_NAMES, SILHOUETTES } from '../../model/silhouettes';
import type { SilhouetteName } from '../../model/silhouettes';
import { abjadTable, valueOf } from '../chronogram';
import { addBorder, defaultFill, getAt, layers, moveBorder, removeAt, setAt } from '../tree';
import type { Path } from '../tree';
import { svgOutline } from './editor-outline';
import { pathPad } from './editor-path';
import { valueLabel } from './labels';
import type { App } from './main';
import { $, h } from './main';

const GROUPS: [string, Trait[]][] = [
  ['Shape', ['outline', 'sides', 'points', 'depth', 'spread']],
  ['Borders', ['borders', 'taper', 'separator', 'separatorWidth', 'ground', 'tiling', 'angle', 'scale']],
  ['Centre and corners', ['fill', 'monogram', 'vary', 'interlace', 'spandrels', 'tips', 'corners']],
  [
    'Letters',
    ['script', 'pen', 'letterSet', 'ascenders', 'ra', 'lamAlif', 'marks', 'alternates', 'plait', 'terminal', 'reach'],
  ],
  [
    'Style',
    ['palette', 'colouring', 'stroke', 'corner', 'banded', 'weight', 'softness', 'contrast', 'stemTaper', 'sprouts'],
  ],
];
const FILL_TYPES: FillerNode['type'][] = [
  'monogram',
  'abjad',
  'roundel',
  'lines',
  'flow',
  'maze',
  'strapwork',
  'lattice',
  'pattern',
  'iznik',
  'rings',
  'vine',
  'solid',
  'region',
];
const SPANDREL_TYPES = ['stars', 'pattern', 'iznik', 'vine', 'solid'] as const;

const valid = (c: Composition) => {
  const r = CompositionSchema.safeParse(c);
  return r.success ? (r.data as Composition) : null;
};

export function wireEditor(app: App) {
  const open = new Set<string>(['Shape', 'Borders']);
  let sel: Path = ['root', 'child'];

  // ---- texts ----
  let textsKey = '';
  function drawTexts() {
    const c = app.comp,
      key = Object.keys(c.texts).join('|');
    const T = abjadTable(c.style.abjad);
    // rebuild only when the slots change, so typing keeps focus
    if (key !== textsKey) {
      textsKey = key;
      $('texts').innerHTML = '';
      for (const name of Object.keys(c.texts)) {
        const ta = h('textarea', {
          class: 'ar',
          dir: 'rtl',
          rows: 2,
          id: 'slot-' + name,
          'aria-label': `Text ${name}`,
        });
        const rep = h(
          'select',
          { 'aria-label': `How ${name} fills its border` },
          h('option', { value: 'fill', textContent: 'repeat to fill' }),
          h('option', { value: 'once', textContent: 'once' }),
        );
        ta.oninput = () => {
          const n = structuredClone(app.comp);
          n.texts[name].text = ta.value;
          const v = valid(n);
          if (v) app.set(v, { replace: true });
        };
        ta.onchange = () => app.set(structuredClone(app.comp)); // one undo step per edit
        rep.onchange = () => {
          const n = structuredClone(app.comp);
          n.texts[name].repeat = rep.value as 'fill';
          app.set(n);
        };
        $('texts').append(
          h(
            'div',
            { class: 'slot' },
            h('div', { class: 'meta' }, h('span', {}, name), h('span', { id: 'abjad-' + name })),
            ta,
            h('div', { class: 'bar' }, rep),
          ),
        );
      }
    }
    for (const [name, s] of Object.entries(c.texts)) {
      const ta = $<HTMLTextAreaElement>('slot-' + name);
      if (document.activeElement !== ta && ta.value !== s.text) ta.value = s.text;
      (ta.nextElementSibling!.firstElementChild as HTMLSelectElement).value = s.repeat;
      $('abjad-' + name).textContent = `abjad ${valueOf(s.text, T)}`;
    }
  }

  // ---- guided ----
  function select(trait: Trait, cur: string | number | boolean | undefined) {
    const vals = [...(TRAITS[trait].values as readonly (string | number | boolean)[])];
    if (cur !== undefined && !vals.includes(cur)) vals.unshift(cur);
    const s = h('select', { 'aria-label': TRAITS[trait].label });
    vals.forEach((v, i) =>
      s.append(h('option', { value: String(i), textContent: valueLabel(trait, v), selected: v === cur })),
    );
    s.onchange = () => {
      const n = structuredClone(app.comp);
      applyTrait(n, trait, vals[+s.value], new Rng(n.seed || 1));
      const v = valid(n);
      if (v) app.set(v);
      else drawGuided();
    };
    return h('label', {}, TRAITS[trait].label, s);
  }
  function drawGuided() {
    const c = app.comp,
      t = traitsOf(c),
      rel = new Set(relevantTraits(c)),
      box = $('guided');
    box.innerHTML = '';
    for (const [name, traits] of GROUPS) {
      const d = h('details', { class: 'group', open: open.has(name) }, h('summary', {}, name));
      d.ontoggle = () => (d.open ? open.add(name) : open.delete(name));
      const f = h('div', { class: 'fields' });
      for (const k of traits) if (rel.has(k)) f.append(select(k, t[k]));
      if (name === 'Shape') f.append(...shapeExtras(c));
      if (name === 'Letters') f.append(...countingFields(c));
      d.append(f);
      box.append(d);
    }
  }
  function shapeExtras(c: Composition) {
    const canvas = h(
      'select',
      { 'aria-label': 'Canvas' },
      ...(['square', 'portrait', 'landscape'] as const).map(v =>
        h('option', { value: v, textContent: v[0].toUpperCase() + v.slice(1), selected: c.canvas.shape === v }),
      ),
    );
    canvas.onchange = () => {
      const n = structuredClone(app.comp);
      n.canvas.shape = canvas.value as 'square';
      app.set(n);
    };
    const seed = h('input', { type: 'number', value: String(c.seed), 'aria-label': 'Seed' });
    seed.onchange = () => {
      const n = structuredClone(app.comp);
      n.seed = Math.max(0, Math.floor(+seed.value || 0));
      const v = valid(n);
      if (v) app.set(v);
    };
    // custom outlines go to the region selected in the layers panel (the main region otherwise)
    const target = (): Path =>
      (getAt(app.comp, sel) as { type?: string })?.type === 'region' ? sel : ['root', 'child'];
    const setOutline = (path: string) => {
      const n = setAt(app.comp, [...target(), 'outline'], { kind: 'svg', path });
      if (n) app.set(n);
    };
    const lib = h('select', { 'aria-label': 'Silhouette' }, h('option', { value: '', textContent: 'Choose…' }));
    for (const [k, name] of Object.entries(SILHOUETTE_NAMES)) lib.append(h('option', { value: k, textContent: name }));
    lib.onchange = () => lib.value && setOutline(SILHOUETTES[lib.value as SilhouetteName]);
    const file = h('input', { type: 'file', accept: '.svg,image/svg+xml', 'aria-label': 'Outline from an SVG file' });
    file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      const d = svgOutline(await f.text());
      if (!d) return alert('No closed shape found in that SVG.');
      setOutline(d);
    };
    const where = (getAt(app.comp, sel) as { type?: string })?.type === 'region' && sel.length > 2 ? ' (nested)' : '';
    return [
      h('label', {}, 'Canvas', canvas),
      h('label', {}, 'Seed', seed),
      h('label', {}, 'Silhouette' + where, lib),
      h('label', {}, 'Outline from SVG' + where, file),
    ];
  }
  function countingFields(c: Composition) {
    const sys = h(
      'select',
      { 'aria-label': 'Abjad values' },
      h('option', { value: 'mashriqi', textContent: 'Eastern (Mashriqi)' }),
      h('option', { value: 'maghribi', textContent: 'Western (Maghribi)' }),
    );
    sys.value = c.style.abjad.system;
    const tm = h(
      'select',
      { 'aria-label': 'ة counts' },
      h('option', { value: '5', textContent: '5 (as ه)' }),
      h('option', { value: '400', textContent: '400 (as ت)' }),
    );
    tm.value = String(c.style.abjad.taMarbuta);
    const upd = () => {
      const n = structuredClone(app.comp);
      n.style.abjad = { system: sys.value as 'mashriqi', taMarbuta: +tm.value as 5 };
      app.set(n);
    };
    sys.onchange = tm.onchange = upd;
    return [h('label', {}, 'Abjad values', sys), h('label', {}, 'ة counts', tm)];
  }

  // ---- layers ----
  const same = (a: Path, b: Path) => a.length === b.length && a.every((x, i) => x === b[i]);
  function apply(n: Composition | null, nextSel?: Path) {
    if (!n) return;
    if (nextSel) sel = nextSel;
    app.set(n);
  }
  function drawLayers() {
    const c = app.comp,
      ls = layers(c);
    if (!ls.some(l => same(l.path, sel))) sel = ['root', 'child'];
    const box = $('layers');
    box.innerHTML = '';
    for (const l of ls) {
      const row = h(
        'div',
        { class: 'layer' + (same(l.path, sel) ? ' sel' : ''), style: `padding-left:${6 + l.depth * 14}px` },
        h('span', { class: 'name', title: l.label }, l.label),
      );
      row.onclick = () => {
        sel = l.path;
        drawLayers();
        drawGuided(); // the outline controls follow the selected region
      };
      const btn = (label: string, tip: string, f: () => void) =>
        h('button', {
          textContent: label,
          title: tip,
          'aria-label': tip,
          onclick: (e: Event) => {
            e.stopPropagation();
            f();
          },
        });
      if (l.movable) {
        const i = l.path[l.path.length - 1] as number;
        row.append(
          btn('↑', 'Move outward', () => apply(moveBorder(c, l.path, -1), [...l.path.slice(0, -1), i - 1])),
          btn('↓', 'Move inward', () => apply(moveBorder(c, l.path, 1), [...l.path.slice(0, -1), i + 1])),
        );
      }
      if (l.kind === 'border' || l.kind === 'fill' || l.kind === 'spandrels')
        row.append(btn('×', 'Remove', () => apply(removeAt(c, l.path))));
      box.append(row);
    }
    drawNode();
  }
  function drawNode() {
    const c = app.comp,
      node = getAt(c, sel) as { type?: string } | undefined,
      box = $('nodeEdit');
    box.innerHTML = '';
    if (!node) return;
    const bar = h('div', { class: 'bar' });
    if (node.type === 'region') {
      bar.append(
        h('button', { textContent: '+ text border', onclick: () => apply(addBorder(c, sel, 'textBorder')) }),
        h('button', { textContent: '+ ornament band', onclick: () => apply(addBorder(c, sel, 'ornamentBorder')) }),
      );
      const fs = h('select', { 'aria-label': 'Fill' }, h('option', { value: '', textContent: 'Set fill…' }));
      FILL_TYPES.forEach(t => fs.append(h('option', { value: t, textContent: valueLabel('fill', t) })));
      fs.onchange = () => fs.value && apply(setAt(c, [...sel, 'fill'], defaultFill(fs.value as FillerNode['type'], c)));
      bar.append(fs);
    }
    if (node.type === 'frame') {
      const ss = h('select', { 'aria-label': 'Corners' }, h('option', { value: '', textContent: 'Set corners…' }));
      SPANDREL_TYPES.forEach(t => ss.append(h('option', { value: t, textContent: valueLabel('spandrels', t) })));
      ss.onchange = () => {
        if (!ss.value) return;
        const f: SpandrelNode =
          ss.value === 'stars' ? { type: 'stars' } : (defaultFill(ss.value as FillerNode['type'], c) as SpandrelNode);
        apply(setAt(c, [...sel, 'spandrels'], f));
      };
      bar.append(ss);
    }
    if (node.type === 'roundel') {
      // the reading path: drawn on a pad, or named ('lanes' fits level lanes to the text)
      const r = node as Extract<FillerNode, { type: 'roundel' }>,
        recipe = r.recipe ?? {};
      box.append(
        pathPad(recipe.path, p => {
          const next = { ...recipe, path: p === 'lanes' ? undefined : p, lanes: p === 'lanes' ? {} : undefined };
          apply(setAt(c, [...sel, 'recipe'], next));
        }),
      );
    }
    // nodes with nested children are edited through the tree; show their own fields only
    const shown =
      node.type === 'region'
        ? { ...node, borders: undefined, fill: undefined }
        : node.type === 'frame'
          ? { ...node, child: undefined, spandrels: undefined }
          : node;
    const ta = h('textarea', {
      spellcheck: false,
      value: JSON.stringify(shown, null, 1),
      'aria-label': 'Node as JSON',
    });
    const msg = h('span', { class: 'note' });
    const applyJson = h('button', {
      textContent: 'Apply',
      onclick: () => {
        let v: Record<string, unknown>;
        try {
          v = JSON.parse(ta.value);
        } catch {
          msg.textContent = 'Not valid JSON.';
          return;
        }
        const old = getAt(c, sel) as Record<string, unknown>;
        // keep the children that were hidden from the editor
        if (node.type === 'region') v = { ...v, borders: old.borders, fill: old.fill };
        if (node.type === 'frame') v = { ...v, child: old.child, spandrels: old.spandrels };
        for (const k of Object.keys(v)) if (v[k] === undefined) delete v[k];
        const n = setAt(c, sel, v);
        if (n) apply(n);
        else msg.textContent = 'That doesn’t fit the composition schema.';
      },
    });
    box.append(bar, ta, h('div', { class: 'bar' }, applyJson, msg));
  }

  app.onChange(() => {
    drawTexts();
    drawGuided();
    drawLayers();
  });
}
