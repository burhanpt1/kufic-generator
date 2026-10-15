// Moving placed items (for nested regions, which are resolved around their own centre).
import type { Pt } from '../geometry/types';
import type { PlacedItem, StripPlace } from './placed';

const mv = (p: Pt, d: Pt): Pt => [p[0] + d[0], p[1] + d[1]];
const mvs = (P: Pt[], d: Pt) => P.map(p => mv(p, d));

function movePlace(pl: StripPlace, d: Pt): StripPlace {
  switch (pl.type) {
    case 'line':
      return { ...pl, O: mv(pl.O, d) };
    case 'arc':
      return { ...pl, C: mv(pl.C, d) };
    case 'run':
      return { ...pl, pts: mvs(pl.pts, d) };
  }
}

export function translateItem(it: PlacedItem, d: Pt): PlacedItem {
  switch (it.type) {
    case 'ground':
    case 'spandrels':
    case 'pattern':
      return { ...it, area: it.area.map(r => mvs(r, d)), centre: mv(it.centre, d) } as PlacedItem;
    case 'fill':
      return { ...it, area: it.area.map(r => mvs(r, d)) };
    case 'star':
      return { ...it, centre: mv(it.centre, d) };
    case 'strip':
      return { ...it, place: movePlace(it.place, d) };
    case 'grid':
      return { ...it, at: mv(it.at, d) };
    case 'separator':
      return { ...it, path: mvs(it.path, d), circle: it.circle && { ...it.circle, C: mv(it.circle.C, d) } };
    case 'finial':
    case 'diamond':
      return { ...it, p: mv(it.p, d) };
    case 'abjad':
      return { ...it, centre: mv(it.centre, d), frame: it.frame && mvs(it.frame, d) };
    case 'rule':
      return { ...it, path: mvs(it.path, d) };
    case 'outline':
      return { ...it, outer: mvs(it.outer, d), inner: it.inner && mvs(it.inner, d) };
    case 'ribbon':
      return { ...it, paths: it.paths.map(q => mvs(q, d)) };
  }
}
