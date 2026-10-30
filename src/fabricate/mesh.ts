// 3D printing (COMPOSITION_ENGINE.md §9 Phase 6.8): a heightmap (the relief depth map, or any image) becomes a closed
// solid, written as binary STL. The top surface is an adaptive right-triangulated irregular network (RTIN, after
// Mapbox's Martini), so flat ground and letter tops take few triangles while edges stay sharp; RTIN meshes are
// conforming (no T-junctions), and the walls and bottom are built from the same triangles, so the solid is watertight.
// Pure: images come in as RGBA pixels, so it runs in tests and workers.

/** Pixels as from canvas getImageData or pngjs: RGBA, row-major, top row first. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/** Heights in 0..1 on a grid of samples, and which samples are part of the object. */
export interface Heightmap {
  width: number;
  height: number;
  /** Row-major, top row first. */
  h: Float32Array;
  /** 1 where the object is; 0 is cut away. */
  mask: Uint8Array;
  /** The same as a continuous field, positive inside, so outlines can be traced between samples. */
  solid?: Float32Array;
}

export interface HeightmapOptions {
  /** Dark is high instead of white (engraved instead of raised, or a dark-on-light drawing). */
  invert?: boolean;
  /** Snap heights to this many steps (2 = a two-level stamp of a logo or line drawing). 0 keeps every grey. */
  levels?: number;
  /** Cut away samples whose height is at or below this (0..1), e.g. the black floor of a relief map. -1 keeps all. */
  cutBelow?: number;
  /** Box-blur radius in samples, to soften a photograph before meshing. */
  blur?: number;
}

/** Image → heightmap: luminance (white high by default), transparent pixels cut away. */
export function heightmapFromPixels(px: Pixels, o: HeightmapOptions = {}): Heightmap {
  const { width, height, data } = px,
    n = width * height;
  let h = new Float32Array(n);
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const lum = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    h[i] = o.invert ? 1 - lum : lum;
  }
  if (o.blur && o.blur > 0) h = boxBlur(h, width, height, Math.round(o.blur));
  const L = o.levels ?? 0;
  if (L >= 2) for (let i = 0; i < n; i++) h[i] = Math.round(h[i] * (L - 1)) / (L - 1);
  const cut = o.cutBelow ?? -1,
    solid = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    solid[i] = Math.min(data[i * 4 + 3] / 255 - 0.5, cut >= 0 ? h[i] - cut : 1);
    mask[i] = solid[i] > 0 ? 1 : 0;
  }
  return { width, height, h, mask, solid };
}

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array<ArrayBuffer> {
  const tmp = new Float32Array(src.length),
    out = new Float32Array(src.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0,
        c = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++, c++) s += src[y * w + k];
      tmp[y * w + x] = s / c;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0,
        c = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++, c++) s += tmp[k * w + x];
      out[y * w + x] = s / c;
    }
  return out;
}

export interface SolidOptions {
  /** Width of the object in millimetres (the depth follows the image). */
  widthMM?: number;
  /** Solid base under everything, in millimetres. */
  baseMM?: number;
  /** Height of white (1) above the base, in millimetres. */
  reliefMM?: number;
  /** Largest allowed height error of the simplified surface, in millimetres. */
  maxErrorMM?: number;
  /** Samples across the longer side (rounded up to 2^k so the RTIN grid is 2^k + 1; at most 2048). */
  resolution?: number;
}

/** A triangle mesh in millimetres: x right, y away from the viewer (image up), z up. Counter-clockwise outward. */
export interface Mesh {
  positions: Float32Array;
  triangles: Uint32Array;
}

/** Bilinear sample of the heightmap at grid step `step` (in pixels, from the first pixel centre); the mask by nearest
 *  sample. Beyond the image is cut away. */
function resample(hm: Heightmap, size: number, step: number) {
  const n = size + 1,
    h = new Float32Array(n * n),
    mask = new Uint8Array(n * n),
    { width: W, height: H } = hm,
    v = (a: number, b: number) => hm.h[b * W + a];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = i * step,
        y = j * step;
      if (x > W - 1 + 1e-6 || y > H - 1 + 1e-6) continue;
      mask[j * n + i] = hm.mask[Math.round(y) * W + Math.round(x)];
      const x0 = Math.min(W - 1, Math.floor(x)),
        y0 = Math.min(H - 1, Math.floor(y)),
        x1 = Math.min(W - 1, x0 + 1),
        y1 = Math.min(H - 1, y0 + 1),
        fx = x - x0,
        fy = y - y0;
      h[j * n + i] = (v(x0, y0) * (1 - fx) + v(x1, y0) * fx) * (1 - fy) + (v(x0, y1) * (1 - fx) + v(x1, y1) * fx) * fy;
    }
  return { h, mask };
}

/** Heightmap → closed solid. Cut-away samples become holes and an outline that follows the mask. */
export function heightmapToMesh(hm: Heightmap, o: SolidOptions = {}): Mesh {
  const widthMM = o.widthMM ?? 120,
    base = o.baseMM ?? 2,
    relief = o.reliefMM ?? 3,
    maxErr = (o.maxErrorMM ?? 0.05) / Math.max(relief, 1e-9),
    longest = Math.max(hm.width, hm.height),
    size = 2 ** Math.ceil(Math.log2(Math.max(2, Math.min(o.resolution ?? 512, 2048)))),
    n = size + 1,
    // one grid step in image pixels; the image fits in the grid's top-left corner
    step = Math.max(1, longest - 1) / size,
    mm = widthMM / (Math.max(1, hm.width - 1) / step),
    rows = (hm.height - 1) / step,
    { h, mask } = resample(hm, size, step);

  // errors: Martini's, plus "must split" wherever the mask changes, so outlines are cut at full resolution
  const errors = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const m = mask[j * n + i];
      if ((i > 0 && mask[j * n + i - 1] !== m) || (i < size && mask[j * n + i + 1] !== m)) errors[j * n + i] = 2;
      if ((j > 0 && mask[(j - 1) * n + i] !== m) || (j < size && mask[(j + 1) * n + i] !== m)) errors[j * n + i] = 2;
    }
  const numTriangles = size * size * 2 - 2,
    numParents = numTriangles - size * size,
    coords = new Uint16Array(numTriangles * 4);
  for (let t = 0; t < numTriangles; t++) {
    let id = t + 2,
      ax = 0,
      ay = 0,
      bx = 0,
      by = 0,
      cx = 0,
      cy = 0;
    if (id & 1) bx = by = cx = size;
    else ax = ay = cy = size;
    while ((id >>= 1) > 1) {
      const mx = (ax + bx) >> 1,
        my = (ay + by) >> 1;
      if (id & 1) [bx, by, ax, ay] = [ax, ay, cx, cy];
      else [ax, ay, bx, by] = [bx, by, cx, cy];
      [cx, cy] = [mx, my];
    }
    coords.set([ax, ay, bx, by], t * 4);
  }
  for (let t = numTriangles - 1; t >= 0; t--) {
    const k = t * 4,
      ax = coords[k],
      ay = coords[k + 1],
      bx = coords[k + 2],
      by = coords[k + 3],
      mx = (ax + bx) >> 1,
      my = (ay + by) >> 1,
      cx = mx + my - ay,
      cy = my + ax - mx,
      mid = my * n + mx,
      err = Math.abs((h[ay * n + ax] + h[by * n + bx]) / 2 - h[mid]);
    errors[mid] = Math.max(errors[mid], err);
    if (t < numParents)
      errors[mid] = Math.max(
        errors[mid],
        errors[((ay + cy) >> 1) * n + ((ax + cx) >> 1)],
        errors[((by + cy) >> 1) * n + ((bx + cx) >> 1)],
      );
  }

  // walk the RTIN; keep triangles that are (mostly) inside the mask. Grid y runs down and mesh y up, so triangles are
  // wound clockwise on the grid to come out counter-clockwise seen from above.
  const all: number[] = [],
    keep: number[] = [];
  const emit = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    const a = ay * n + ax,
      b = by * n + bx,
      c = cy * n + cx;
    all.push(...((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0 ? [a, c, b] : [a, b, c]));
    keep.push(mask[a] + mask[b] + mask[c] >= 2 ? 1 : 0);
  };
  const walk = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    const mx = (ax + bx) >> 1,
      my = (ay + by) >> 1;
    if (Math.abs(ax - cx) + Math.abs(ay - cy) > 1 && errors[my * n + mx] > maxErr) {
      walk(cx, cy, ax, ay, mx, my);
      walk(bx, by, cx, cy, mx, my);
    } else emit(ax, ay, bx, by, cx, cy);
  };
  walk(0, 0, size, size, size, 0);
  walk(size, size, 0, 0, 0, size);

  // Outline edges: kept edges with no twin running the other way. Where parts touch at a single corner (a pinch), the
  // walls of both would share one vertical edge and the solid would not be manifold: fill the triangles round that
  // corner and look again.
  const N = n * n,
    key = (p: number, q: number) => p * N + q,
    incident = new Map<number, number[]>();
  for (let t = 0; t < keep.length; t++)
    for (let k = 0; k < 3; k++) {
      const g = all[t * 3 + k];
      if (!incident.has(g)) incident.set(g, []);
      incident.get(g)!.push(t);
    }
  let outline: [number, number][];
  for (;;) {
    const kept = new Set<number>();
    for (let t = 0; t < keep.length; t++)
      if (keep[t]) for (let k = 0; k < 3; k++) kept.add(key(all[t * 3 + k], all[t * 3 + ((k + 1) % 3)]));
    outline = [];
    const out = new Map<number, number>();
    for (const k of kept) {
      const s = Math.floor(k / N),
        e = k % N;
      if (kept.has(key(e, s))) continue;
      outline.push([s, e]);
      out.set(s, (out.get(s) ?? 0) + 1);
    }
    const pinches = [...out].filter(([, c]) => c > 1).map(([g]) => g);
    if (!pinches.length) break;
    for (const g of pinches) for (const t of incident.get(g)!) keep[t] = 1;
  }

  // vertices: each used grid sample twice, on top and on the bottom
  const index = new Int32Array(N).fill(-1),
    used: number[] = [];
  for (let t = 0; t < keep.length; t++)
    if (keep[t])
      for (let k = 0; k < 3; k++) {
        const g = all[t * 3 + k];
        if (index[g] < 0) index[g] = used.push(g) - 1;
      }
  const V = used.length,
    positions = new Float32Array(V * 6);
  used.forEach((g, v) => {
    const i = g % n,
      j = (g - i) / n,
      x = i * mm,
      y = (rows - j) * mm;
    positions.set([x, y, base + relief * h[g]], v * 3);
    positions.set([x, y, 0], (V + v) * 3);
  });
  const tris: number[] = [];
  for (let t = 0; t < keep.length; t++) {
    if (!keep[t]) continue;
    const [p, q, r] = [index[all[t * 3]], index[all[t * 3 + 1]], index[all[t * 3 + 2]]];
    tris.push(p, q, r, V + p, V + r, V + q);
  }
  // a wall from each outline edge down to the bottom
  for (const [gs, ge] of outline) {
    const s = index[gs],
      e = index[ge];
    tris.push(e, s, V + s, e, V + s, V + e);
  }
  return { positions, triangles: Uint32Array.from(tris) };
}

/** Binary STL (little-endian, millimetres). */
export function meshToSTL(mesh: Mesh, name = 'kufic'): Uint8Array {
  const { positions: P, triangles: T } = mesh,
    count = T.length / 3,
    buf = new ArrayBuffer(84 + count * 50),
    dv = new DataView(buf),
    head = `${name} (binary STL, mm)`.slice(0, 80);
  for (let i = 0; i < head.length; i++) dv.setUint8(i, head.charCodeAt(i) & 0x7f);
  dv.setUint32(80, count, true);
  let o = 84;
  for (let t = 0; t < count; t++) {
    const a = T[t * 3] * 3,
      b = T[t * 3 + 1] * 3,
      c = T[t * 3 + 2] * 3,
      ux = P[b] - P[a],
      uy = P[b + 1] - P[a + 1],
      uz = P[b + 2] - P[a + 2],
      vx = P[c] - P[a],
      vy = P[c + 1] - P[a + 1],
      vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    [nx, ny, nz] = [nx / len, ny / len, nz / len];
    for (const v of [nx, ny, nz, P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[c], P[c + 1], P[c + 2]]) {
      dv.setFloat32(o, v, true);
      o += 4;
    }
    dv.setUint16(o, 0, true);
    o += 2;
  }
  return new Uint8Array(buf);
}

/** Bounding box and triangle count, for the UI and tests. */
export function meshStats(mesh: Mesh) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], mesh.positions[i]);
    max[i % 3] = Math.max(max[i % 3], mesh.positions[i]);
  }
  return { triangles: mesh.triangles.length / 3, min, max };
}
