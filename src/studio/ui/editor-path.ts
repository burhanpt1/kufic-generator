// Reading paths for a thuluth roundel, drawn by hand (PLAN-2 §2): strokes sketched on a square pad, in reading order,
// each a pen lift from the last, simplified and stored as the roundel's path in field coordinates (−1…1, y up).
import { toReadingPath } from '../../script/thuluth/roundel/paths';
import { h } from './main';

type Path = [number, number][][];

/** The pad: draw the strokes the words should follow, then use them; or pick a named path. */
export function pathPad(current: unknown, onSet: (path: Path | string | undefined) => void): HTMLElement {
  const size = 220,
    cv = h('canvas', { width: size, height: size, class: 'pathpad', 'aria-label': 'Draw the reading path' }),
    g = cv.getContext('2d'),
    strokes: [number, number][][] = [];
  let cur: [number, number][] | null = null;
  const at = (e: PointerEvent): [number, number] => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) * size) / r.width, ((e.clientY - r.top) * size) / r.height];
  };
  const draw = () => {
    if (!g) return;
    const css = getComputedStyle(cv);
    g.clearRect(0, 0, size, size);
    g.strokeStyle = css.getPropertyValue('--line') || '#999';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI);
    g.stroke();
    // a path already set: shown faintly beneath
    if (Array.isArray(current) && !strokes.length) {
      g.strokeStyle = '#8888';
      (current as Path).forEach(s => {
        g.beginPath();
        s.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](((x + 1) * size) / 2, ((1 - y) * size) / 2));
        g.stroke();
      });
    }
    g.lineWidth = 3;
    g.lineCap = 'round';
    strokes.forEach((s, k) => {
      g.strokeStyle = `hsl(${30 + k * 40} 70% 45%)`;
      g.beginPath();
      s.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y));
      g.stroke();
      // where each stroke starts: its number in reading order
      g.fillStyle = g.strokeStyle;
      g.fillText(String(k + 1), s[0][0] + 4, s[0][1] - 4);
    });
  };
  cv.onpointerdown = e => {
    cv.setPointerCapture(e.pointerId);
    cur = [at(e)];
    strokes.push(cur);
  };
  cv.onpointermove = e => {
    if (!cur) return;
    cur.push(at(e));
    draw();
  };
  cv.onpointerup = () => (cur = null);
  const named = h('select', { 'aria-label': 'Reading path' }, h('option', { value: '', textContent: 'Named path…' }));
  ['auto', 'lanes', 'stag2', 'stag3', 'stairs2', 'stairs3', 'stairs4', 'zigzag', 'bolt', 'cup', 'line', 'calliar3', 'calliar4'].forEach(v => named.append(h('option', { value: v, textContent: v }))); // prettier-ignore
  named.onchange = () => named.value && onSet(named.value);
  const note = h('span', {
    class: 'note',
    textContent: 'Draw the strokes in reading order, top first, right to left.',
  });
  const use = h('button', {
      textContent: 'Use drawn path',
      onclick: () => {
        const p = toReadingPath(strokes, size);
        if (p.length) onSet(p);
        else note.textContent = 'Draw at least one stroke across the pad.';
      },
    }),
    clear = h('button', { textContent: 'Clear', onclick: () => ((strokes.length = 0), draw()) }),
    none = h('button', { textContent: 'No path', onclick: () => onSet(undefined) });
  draw();
  return h('div', { class: 'pathbox' }, cv, h('div', { class: 'bar' }, use, clear, none, named), note);
}
