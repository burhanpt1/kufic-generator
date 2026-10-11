// The app: reads the controls, runs the engine, renders the SVG and the status line.
import { alphabet, compose } from '../engine';
import type { ComposeOptions, ComposeResult, Grid } from '../engine';
import { renderCircle, renderGrid, renderSquare, wrap } from '../render';
import type { RenderOptions } from '../render';
import type { Lookup, State } from './controls';
import { initialState, lookup, setSeg, wireControls } from './controls';
import { loadOverrides, wireEditor } from './editor';
import { savePNG, saveSVG } from './export';
import { NOTES, PALETTES } from './presets';

type Composition = Extract<ComposeResult, { kind: 'square' | 'circle' }>;

/** What the last render() did, for export and for tests. */
export interface LastRender {
  svg: string;
  name: string;
  engine: { fn: 'compose' | 'alphabet'; args: unknown[]; output: unknown } | null;
  render: { fn: 'renderSquare' | 'renderCircle' | 'renderGrid'; opt: RenderOptions; margin?: number } | null;
}

export function start(doc: Document = document) {
  const $: Lookup = lookup(doc);
  const state: State = initialState();
  loadOverrides(state);
  const last: LastRender = { svg: '', name: 'kufic', engine: null, render: null };
  const val = (id: string) => $(id).value;
  const checked = (id: string) => $(id).checked;

  function render() {
    const text = val('text'),
      H = +val('asc'),
      wordGap = +val('gap'),
      rings = +val('rings');
    const weight = +val('weight'),
      soft = +val('soft'),
      taper = +val('taper'),
      centreSize = +val('centreSize');
    const out: Record<string, string | number> = {
      ascOut: H,
      gapOut: wordGap,
      ringsOut: text.split(/\n+/).filter(l => l.trim()).length > 1 ? 'one per line' : rings,
      weightOut: Math.round(weight * 100) + '%',
      softOut: Math.round(soft * 100) + '%',
      taperOut: Math.round(taper * 100) + '%',
      centreOut: Math.round(centreSize * 100) + '%',
      geoAngleOut: val('geoAngle') + '°',
      geoScaleOut: val('geoScale'),
    };
    Object.entries(out).forEach(([k, v]) => ($(k).textContent = String(v)));
    const L = state.layout,
      comp = L === 'rings' || L === 'circle';
    $('layoutNote').textContent = NOTES[L];
    $('compOpts').classList.toggle('hidden', !comp);
    $('editor').classList.toggle('hidden', L !== 'letters');
    $('vowelOpts').classList.toggle('hidden', state.marks !== 'all');
    const pal = PALETTES[state.palette];
    const opt = {
      weight,
      soft,
      ink: pal.ink,
      ink2: pal.ink2,
      paper: pal.paper,
      mark: checked('contrast') ? pal.mark : pal.ink,
      grid: checked('grid') && L !== 'circle',
      label: 'Kufic rendering of ' + text.replace(/\n/g, ' '),
      terminal: state.terminal,
      colourMode: state.colourMode,
      ground: state.ground,
      corners: state.corners,
      bandStyle: state.bandStyle,
      tiling: state.tiling,
      geoAngle: +val('geoAngle'),
      geoScale: +val('geoScale'),
      letterStyle: state.letterStyle,
    } as RenderOptions;
    let meta = '',
      warn = '';
    last.engine = last.render = null;
    const grid = (g: Grid, o: RenderOptions, m: number) => {
      last.render = { fn: 'renderGrid', opt: o, margin: m };
      return renderGrid(g, o, m);
    };
    if (L === 'letters') {
      const lo = { ra: state.ra, ayn: state.ayn, la: state.la } as Parameters<typeof alphabet>[1];
      const g = alphabet(H, lo);
      last.engine = { fn: 'alphabet', args: [H, lo], output: g };
      last.svg = grid(g, { ...opt, colourMode: 'solid', ground: 'plain', terminal: 'none', letterStyle: 'solid' }, 1);
      meta = 'Letter forms, ' + H + '-cell band';
    } else {
      const big = state.terminal === 'leaf' || state.terminal === 'palmette',
        rich = state.bandStyle !== 'none' && state.bandStyle !== 'lines';
      const gap = rich ? (big ? 4 : 3) : big ? 2 : state.bandStyle === 'lines' ? 2 : 1;
      const args = {
        text,
        layout: L,
        H,
        wordGap,
        rings,
        rotation: state.rotation,
        center: state.center,
        marks: state.marks,
        vowels: state.vowels,
        repeat: checked('repeat'),
        ra: state.ra,
        ayn: state.ayn,
        la: state.la,
        terminals: state.terminal === 'none' ? 'none' : state.reach,
        gap,
        cornerBlocks: state.corners !== 'none' && L === 'rings',
        taper,
        centre: centreSize,
        rhythm: checked('rhythm'),
      } as ComposeOptions;
      const res = compose(args);
      last.engine = { fn: 'compose', args: [args], output: res };
      const info = res.info;
      if (res.kind === 'empty') {
        last.svg = wrap(200, 200, opt, '');
        warn = info.tooBig
          ? 'This text needs a larger size than the page can build. Try fewer rings or a smaller centre.'
          : 'Type some Arabic text to begin.';
      } else if (res.kind === 'grid') {
        last.svg = grid(res.grid, { ...opt, ground: 'plain' }, 2);
        meta = `${res.grid.w} × ${res.grid.h} cells. Abjad value ${info.abjad}`;
      } else {
        const c = res as Composition;
        last.render = { fn: c.kind === 'circle' ? 'renderCircle' : 'renderSquare', opt };
        last.svg = c.kind === 'circle' ? renderCircle(c, opt) : renderSquare(c, opt);
        meta = `${c.kind === 'circle' ? c.size + ' cells across' : c.size + ' × ' + c.size + ' cells'}, ${info.rings} ring${info.rings === 1 ? '' : 's'}`;
        if (info.rep! > 1) meta += `, text repeated ${info.rep}×`;
        meta += `. Abjad value ${info.abjad}`;
      }
      if (info.unsupported && info.unsupported.length) warn += ` Skipped: ${info.unsupported.join(' ')}`;
    }
    last.name = 'kufic-' + L;
    $('art').innerHTML = last.svg;
    $('meta').textContent = meta;
    $('warn').textContent = warn;
  }

  wireControls($, doc, state, render);
  const { drawEditor } = wireEditor($, doc, state, render);

  $('fatimid').onclick = () => {
    setSeg($, state, 'terminal', 'terminal', 'palmette');
    setSeg($, state, 'reach', 'reach', 'tails');
    setSeg($, state, 'ground', 'ground', 'vine');
    setSeg($, state, 'colourMode', 'colourMode', 'ring');
    setSeg($, state, 'center', 'center', 'abjad');
    setSeg($, state, 'layout', 'layout', 'circle');
    setSeg($, state, 'marks', 'marks', 'dots');
    setSeg($, state, 'corners', 'corners', 'geo');
    setSeg($, state, 'la', 'la', 'knot');
    setSeg($, state, 'bandStyle', 'bandStyle', 'braid');
    setSeg($, state, 'tiling', 'tiling', '488');
    setSeg($, state, 'letterStyle', 'letterStyle', 'solid');
    $('asc').value = '11';
    $('weight').value = '0.8';
    $('soft').value = '0.3';
    $('rings').value = '3';
    $('taper').value = '0.5';
    $('centreSize').value = '0.18';
    $('rhythm').checked = true;
    state.palette = 0;
    [...$('swatches').children].forEach((c, j) => c.setAttribute('aria-pressed', String(j === 0)));
    render();
  };

  $('saves').classList.add('on');
  $('saveSvg').onclick = () => saveSVG(doc, last.name, last.svg);
  $('savePng').onclick = () => savePNG(doc, last.name, last.svg);

  drawEditor();
  render();
  return { state, render, last };
}
