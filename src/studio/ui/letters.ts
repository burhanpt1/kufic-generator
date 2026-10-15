// Letters tab: the letter editor working on the glyph set every composition uses, with a line preview.
import { alphabet, compose } from '../../engine';
import type { ComposeOptions, Grid } from '../../engine';
import type { Style } from '../../model/schema';
import { renderGrid } from '../../render';
import type { RenderOptions } from '../../render/svg';
import { clearMonogramCache } from '../../monogram/methods';
import type { EditorState } from '../../app/letterEditor';
import { loadOverrides, lookup, wireEditor as wireLetterEditor } from '../../app/letterEditor';
import { mainSlot } from './gallery';
import type { App } from './main';
import { $ } from './main';

const renderOpts = (s: Style, label: string): RenderOptions => ({
  weight: s.stroke.weight, soft: s.stroke.softness, ink: s.palette.ink, ink2: s.palette.ink2, paper: s.palette.paper,
  mark: s.palette.mark, grid: false, label, terminal: 'none', colourMode: 'solid', ground: 'plain', corners: 'none',
  bandStyle: 'none', tiling: '488', geoAngle: 67, geoScale: 5, letterStyle: 'solid',
}); // prettier-ignore

/** A text as one justified Kufic line in a style's letters and colours ('' if it has no letters). */
export function linePreview(text: string, s: Style): string {
  const r = compose({
    text: text.trim() || ' ',
    layout: 'line',
    H: s.letter.ascenders,
    wordGap: 2,
    marks: s.letter.marks,
    ra: s.letter.ra,
    ayn: s.letter.ayn,
    la: s.letter.lamAlif,
  } as ComposeOptions);
  return r.kind === 'grid' ? renderGrid(r.grid as Grid, renderOpts(s, 'Kufic preview of ' + text), 1) : '';
}

export function wireLetters(app: App) {
  const s = app.comp.style.letter;
  const state = {
    edKey: 'BEH',
    edForm: 'iso',
    ra: s.ra,
    ayn: s.ayn,
    la: s.lamAlif,
    meem: s.meem,
    sad: s.sad,
    ovr: {},
  } as EditorState;
  loadOverrides(state);
  const draw = () => {
    const st = app.comp.style,
      slot = mainSlot(app.comp),
      text = (slot && app.comp.texts[slot]?.text) || 'بسم الله الرحمن الرحيم';
    Object.assign(state, { ra: st.letter.ra, ayn: st.letter.ayn, la: st.letter.lamAlif });
    const alpha = alphabet(st.letter.ascenders, { ra: st.letter.ra, ayn: st.letter.ayn, la: st.letter.lamAlif });
    $('letterPreview').innerHTML =
      linePreview(text.split('\n')[0], st) + renderGrid(alpha, renderOpts(st, 'Kufic letter forms'), 1);
  };
  const { drawEditor } = wireLetterEditor(lookup(document), document, state, () => {
    clearMonogramCache();
    draw();
    app.glyphsChanged();
  });
  drawEditor();
  app.onChange(draw);
}
