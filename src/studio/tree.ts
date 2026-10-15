// The composition tree as layers (COMPOSITION_ENGINE.md §8, level 3): list nodes, and add, remove, reorder and
// replace them. Every edit returns a new composition that passes the schema, or null when the edit would break it.
import type { BorderNode, Composition, FillerNode, RegionNode, SpandrelNode } from '../model/schema';
import { CompositionSchema } from '../model/schema';

export type Path = (string | number)[];
export interface Layer {
  path: Path;
  depth: number;
  kind: 'frame' | 'spandrels' | 'region' | 'border' | 'fill';
  label: string;
  /** Borders can move up and down within their region. */
  movable?: boolean;
}

const outlineLabel = (r: RegionNode) => {
  const o = r.outline;
  return o.kind === 'polygon'
    ? `${o.sides}-gon`
    : o.kind === 'star'
      ? `${o.points}-point star`
      : o.kind === 'preset'
        ? o.name
        : o.kind === 'circle'
          ? 'circle'
          : 'custom outline';
};
export function borderLabel(b: BorderNode, c: Composition): string {
  if (b.type === 'ornamentBorder') return `ornament band: ${b.ornament}`;
  const t = c.texts[b.text]?.text ?? '';
  return `text “${t.length > 24 ? t.slice(0, 24) + '…' : t}”${b.separator && b.separator.kind !== 'none' ? ` + ${b.separator.kind}` : ''}`;
}
export function fillLabel(f: FillerNode | SpandrelNode): string {
  switch (f.type) {
    case 'monogram':
      return `monogram: ${f.method}`;
    case 'pattern':
      return `pattern: ${f.pattern.tiling}`;
    case 'lines':
      return 'text lines';
    case 'region':
      return 'nested region';
    default:
      return f.type;
  }
}

function regionLayers(r: RegionNode, path: Path, depth: number, c: Composition, out: Layer[]) {
  out.push({ path, depth, kind: 'region', label: `region: ${outlineLabel(r)}` });
  r.borders.forEach((b, i) =>
    out.push({
      path: [...path, 'borders', i],
      depth: depth + 1,
      kind: 'border',
      label: borderLabel(b, c),
      movable: true,
    }),
  );
  if (r.fill) {
    out.push({ path: [...path, 'fill'], depth: depth + 1, kind: 'fill', label: `fill: ${fillLabel(r.fill)}` });
    if (r.fill.type === 'region') regionLayers(r.fill.node, [...path, 'fill', 'node'], depth + 2, c, out);
  }
}
/** The tree, depth first, as rows for a layers panel. */
export function layers(c: Composition): Layer[] {
  const out: Layer[] = [{ path: ['root'], depth: 0, kind: 'frame', label: `frame (${c.canvas.shape})` }];
  if (c.root.spandrels)
    out.push({
      path: ['root', 'spandrels'],
      depth: 1,
      kind: 'spandrels',
      label: `corners: ${fillLabel(c.root.spandrels)}`,
    });
  regionLayers(c.root.child, ['root', 'child'], 1, c, out);
  return out;
}

export function getAt(c: Composition, path: Path): unknown {
  let n: unknown = c;
  for (const k of path) n = n == null ? undefined : (n as Record<string | number, unknown>)[k];
  return n;
}
const valid = (c: Composition): Composition | null => {
  const r = CompositionSchema.safeParse(c);
  return r.success ? (r.data as Composition) : null;
};
function edit(c: Composition, path: Path, f: (parent: Record<string | number, unknown>, key: string | number) => void) {
  if (!path.length) return null;
  const n = structuredClone(c),
    parent = getAt(n, path.slice(0, -1)) as Record<string | number, unknown> | undefined;
  if (!parent || typeof parent !== 'object') return null;
  f(parent, path[path.length - 1]);
  return valid(n);
}

/** Replace the node at path (undefined removes an optional node). */
export const setAt = (c: Composition, path: Path, value: unknown) =>
  edit(c, path, (p, k) => {
    if (value === undefined) delete p[k];
    else p[k] = structuredClone(value);
  });

/** Remove a border, the fill or the corners. Regions and the frame can't be removed. */
export function removeAt(c: Composition, path: Path): Composition | null {
  const k = path[path.length - 2];
  if (k === 'borders') {
    return edit(c, path, p => (p as unknown as unknown[]).splice(path[path.length - 1] as number, 1));
  }
  const last = path[path.length - 1];
  if (last === 'fill' || last === 'spandrels') return setAt(c, path, undefined);
  return null;
}

/** Move a border by delta places (negative = outward). */
export function moveBorder(c: Composition, path: Path, delta: number): Composition | null {
  const i = path[path.length - 1] as number,
    j = i + delta,
    list = getAt(c, path.slice(0, -1)) as unknown[] | undefined;
  if (!Array.isArray(list) || j < 0 || j >= list.length) return null;
  return edit(c, path.slice(0, -1), (p, k) => {
    const a = (p[k] as unknown[]).slice();
    [a[i], a[j]] = [a[j], a[i]];
    p[k] = a;
  });
}

/** A new border of the given type in a region, appended innermost. New text borders use the region's first text
 *  slot, or a new slot. */
export function addBorder(c: Composition, regionPath: Path, type: BorderNode['type']): Composition | null {
  const r = getAt(c, regionPath) as RegionNode | undefined;
  if (!r || r.type !== 'region') return null;
  const n = structuredClone(c);
  let b: BorderNode;
  if (type === 'textBorder') {
    const used = r.borders.find(x => x.type === 'textBorder') as { text: string } | undefined;
    let slot = used?.text ?? Object.keys(n.texts)[0];
    if (!slot) {
      slot = 'main';
      n.texts[slot] = { text: 'بسم الله', repeat: 'fill', wordGap: 2 };
    }
    b = { type: 'textBorder', text: slot, scale: 'auto', taper: 0.5, separator: { kind: 'lines', width: 2 } };
  } else b = { type: 'ornamentBorder', ornament: 'braid', width: 2 };
  (getAt(n, regionPath) as RegionNode).borders.push(b);
  return valid(n);
}

/** Set a region's fill (or the frame's corners when path ends in 'spandrels'). */
export const setFill = (c: Composition, path: Path, f: FillerNode | SpandrelNode | undefined) => setAt(c, path, f);

/** Default fills by type, for an "add fill" menu. */
export function defaultFill(type: FillerNode['type'], c: Composition): FillerNode {
  const slot = Object.keys(c.texts)[0] ?? 'main';
  switch (type) {
    case 'lines':
      return { type, text: slot, lineGap: 1 };
    case 'flow':
      return { type, text: slot, lineGap: 1, strength: 0.8 };
    case 'maze':
      return { type, text: slot, corridors: 0.7, wall: true };
    case 'monogram':
      return { type, text: slot, method: 'seal', params: {} };
    case 'abjad':
    case 'roundel':
      return { type, text: slot };
    case 'strapwork':
      return { type, text: slot, tiling: '488' };
    case 'lattice':
      return { type, text: slot };
    case 'pattern':
      return { type, pattern: { tiling: '488', angle: 67, scale: 5 } };
    case 'region':
      return { type, node: { type: 'region', outline: { kind: 'circle' }, borders: [], fill: { type: 'rings' } } };
    default:
      return { type } as FillerNode;
  }
}
