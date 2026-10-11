// Fixed Kufic Lab cases for the visual references. Genome / state values are the lab's own option names.
const BASMALA = 'بسم الله الرحمن الرحيم';
const NAMES = 'بسم الله الرحمن الرحيم\nمحمد علي فاطمة\nالحسن الحسين';
const AYAT_KURSI =
  'الله لا اله الا هو الحي القيوم لا تأخذه سنة ولا نوم له ما في السماوات وما في الأرض من ذا الذي يشفع عنده الا بإذنه يعلم ما بين أيديهم وما خلفهم ولا يحيطون بشيء من علمه الا بما شاء وسع كرسيه السماوات والأرض ولا يئوده حفظهما وهو العلي العظيم';

const cases = [];
const shape = (id, genome, text = BASMALA) => cases.push({ id: `shape--${id}`, kind: 'shape', genome, text });
shape('fatimid-circle', {});
shape('square-4', { layout: 'poly', sides: 4, center: 'abjad', corners: 'stars' });
shape('hexagon', { layout: 'poly', sides: 6, bandStyle: 'pearls', ground: 'tint', center: 'geo' });
shape('octagon-curved', { layout: 'poly', sides: 8, stroke: 'curved', curve: 0.6, center: 'squares', corners: 'none' });
shape('star-8', { layout: 'star', points: 8, depth: 0.55, rings: 2, center: 'abjad' });
shape('star-6-pen', { layout: 'star', points: 6, depth: 0.65, rings: 2, stroke: 'pen', palette: 4, center: 'abjad' });
shape('teardrop', { layout: 'teardrop', rings: 2, palette: 4, center: 'abjad', corners: 'none' });
shape('heart', { layout: 'heart', rings: 2, bandStyle: 'chevron', center: 'abjad', palette: 2 });
shape('mihrab', { layout: 'mihrab', rings: 2, center: 'geo', tiling: 'hex' });
shape('names-circle', { colourMode: 'repeat', letterStyle: 'banded', center: 'abjad' }, NAMES);
shape(
  'la-ilaha-poly5',
  { layout: 'poly', sides: 5, rings: 2, center: 'solid', colourMode: 'radial', ground: 'geo', tiling: '31212' },
  'لا اله الا الله',
);

const fill = (id, state, text = AYAT_KURSI) =>
  cases.push({ id: `fill--${id}`, kind: 'fill', state, text, border: BASMALA });
fill('teardrop', { shape: 'teardrop' });
fill('mihrab-blocks', { shape: 'mihrab', stroke: 'blocks' });
fill('heart-2rings', { shape: 'heart', borderRings: 2 });
fill('circle-open', { shape: 'circle', lineGap: 2 });
fill('octagon', { shape: 'poly', sides: 8 });
// The lab can't fit this text in the default 8-point star (depth 0.55) at all; a deeper star works.
fill('star8-pen', { shape: 'star', sides: 8, depth: 0.65, stroke: 'pen', palette: 4 });

const maze = (id, state, text = BASMALA) =>
  cases.push({ id: `maze--${id}`, kind: 'maze', state: { style: 'maze', ...state }, text });
maze('teardrop', { shape: 'teardrop', mseed: 7 });
maze('circle-twisty', { shape: 'circle', straight: 0.35, mseed: 11 });
maze('hexagon-long', { shape: 'poly', sides: 6, straight: 0.92, mseed: 3, stroke: 'blocks' });

const mono = (id, params, text = 'محمد') => cases.push({ id: `mono--${id}`, kind: 'mono', params, text });
for (const mode of ['mirror', 'below', 'quad', 'pair', 'pinout', 'pinin', 'block', 'spiral', 'tughra'])
  mono(mode, { mode });
mono('seal', { mode: 'seal' });
mono('seal-joined-mirror', { mode: 'seal', joins: true, sym: 'mirror', dots: true }, 'علي');
mono('seal-turn-curved', { mode: 'seal', sym: 'turn', stroke: 'curved', curve: 0.8, frame: 'double' }, 'فاطمة');
mono('block-basmala', { mode: 'block', alternate: true, lines: 1 }, BASMALA);
mono('spiral-seal-core', { mode: 'spiral', core: 'seal', spiralRings: 2 }, BASMALA);
mono('tughra-tall', { mode: 'tughra', spineH: 19, flags: 2, loops: 2, arms: 2 }, 'الحسين');

export const LAB_CASES = cases;
