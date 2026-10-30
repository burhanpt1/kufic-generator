// The 3D print dialog: the current design's relief map, or an image the user picks, becomes a binary STL.
import { resolve } from '../../compose';
import { saveSTL } from '../../app/export';
import { RELIEF_LEVELS, reliefSVG } from '../../fabricate';
import { heightmapFromPixels, heightmapToMesh, meshToSTL } from '../../fabricate/mesh';
import { findLevels, terraceMesh } from '../../fabricate/terrace';
import type { Heightmap, Pixels } from '../../fabricate/mesh';
import type { App } from './main';
import { $ } from './main';

/** Draw an image so its longer side is `size` pixels and read the pixels back. */
function pixelsOf(img: CanvasImageSource & { width: number; height: number }, size: number): Pixels {
  const k = size / Math.max(img.width, img.height),
    c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k));
  c.height = Math.max(1, Math.round(img.height * k));
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height);
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error('could not read the image'));
    img.src = src;
  });
}

export function wirePrint3d(app: App) {
  const dlg = $<HTMLDialogElement>('print3d'),
    source = $<HTMLSelectElement>('p3Source'),
    file = $<HTMLInputElement>('p3File'),
    info = $('p3Info'),
    num = (id: string) => Number($<HTMLInputElement>(id).value);
  let image: HTMLImageElement | null = null,
    pixels: Pixels | null = null,
    key = '';
  const surface = () => $<HTMLSelectElement>('p3Levels').value === 'surface';
  /** The plateaus for flat levels: the relief map's own for the design, else found in the image or evenly spaced. */
  function levelsOf(hm: Heightmap): number[] {
    const v = $<HTMLSelectElement>('p3Levels').value;
    if (v !== 'auto') return Array.from({ length: Number(v) }, (_, k) => k / (Number(v) - 1));
    if (source.value === 'design') {
      const L = RELIEF_LEVELS;
      return [L.ground, L.pattern, L.bands, L.letters];
    }
    return findLevels(hm);
  }

  /** The pixels to mesh, cached while the source and detail stay the same. */
  async function source2pixels(): Promise<Pixels | null> {
    // flat levels trace outlines between pixels, so more pixels cost little; a shaded surface meshes every sample
    const size = surface() ? num('p3Res') / 4 + 1 : num('p3Res'),
      k = source.value + size + (source.value === 'design' ? JSON.stringify(app.comp) : file.value);
    if (k === key && pixels) return pixels;
    let img: HTMLImageElement | null;
    if (source.value === 'design') {
      const svg = reliefSVG(resolve(app.comp));
      img = await loadImage('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))));
    } else img = image;
    if (!img) return null;
    pixels = pixelsOf(img, size);
    key = k;
    return pixels;
  }
  function heightmap(px: Pixels): Heightmap {
    const cut = num('p3Cut');
    return heightmapFromPixels(px, {
      invert: $<HTMLInputElement>('p3Invert').checked,
      cutBelow: cut > 0 ? cut / 100 : -1,
      blur: num('p3Blur'),
    });
  }
  function preview(hm: Heightmap) {
    const c = $<HTMLCanvasElement>('p3Preview');
    c.width = hm.width;
    c.height = hm.height;
    const ctx = c.getContext('2d')!,
      d = ctx.createImageData(hm.width, hm.height),
      ls = surface() ? null : levelsOf(hm),
      // flat levels: each sample shows the plateau it lands on
      snap = (v: number) => {
        if (!ls) return v;
        let k = 0;
        while (k + 1 < ls.length && v >= (ls[k] + ls[k + 1]) / 2) k++;
        return ls[k];
      };
    for (let i = 0; i < hm.h.length; i++) {
      const g = Math.round(snap(hm.h[i]) * 255);
      // cut-away parts show red
      d.data.set(hm.mask[i] ? [g, g, g, 255] : [120, 20, 20, 255], i * 4);
    }
    ctx.putImageData(d, 0, 0);
  }
  async function refresh() {
    try {
      const px = await source2pixels();
      if (!px) {
        info.textContent = 'Pick an image.';
        return;
      }
      const w = num('p3Width'),
        hm = heightmap(px);
      preview(hm);
      info.textContent =
        `${w} × ${Math.round((w * px.height) / px.width)} mm, ${num('p3Base') + num('p3Relief')} mm high at most` +
        (surface() ? '' : `, ${levelsOf(hm).length} levels`) +
        '. Red is cut away.';
    } catch (e) {
      info.textContent = String((e as Error).message ?? e);
    }
  }

  source.onchange = () => {
    $('p3FileLabel').classList.toggle('hidden', source.value !== 'image');
    // a relief map's black floor is outside the design; an image keeps everything by default
    $<HTMLInputElement>('p3Cut').value = source.value === 'design' ? '5' : '0';
    if (source.value === 'image' && !image) file.click();
    refresh();
  };
  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    try {
      image = await loadImage(url);
    } catch (e) {
      info.textContent = String((e as Error).message);
    }
    refresh();
  };
  for (const id of ['p3Res', 'p3Levels', 'p3Cut', 'p3Blur', 'p3Invert', 'p3Width', 'p3Base', 'p3Relief'])
    $(id).addEventListener('change', refresh);

  $('p3Make').onclick = async () => {
    const px = await source2pixels();
    if (!px) return void (info.textContent = 'Pick an image.');
    info.textContent = 'Meshing…';
    await new Promise(r => setTimeout(r, 20));
    const hm = heightmap(px),
      size = { widthMM: num('p3Width'), baseMM: num('p3Base'), reliefMM: num('p3Relief') },
      mesh = surface()
        ? heightmapToMesh(hm, { ...size, resolution: num('p3Res') / 4 })
        : terraceMesh(hm, { ...size, levels: levelsOf(hm) }),
      stl = meshToSTL(mesh),
      tris = mesh.triangles.length / 3;
    if (!tris) return void (info.textContent = 'Nothing left to print: everything is cut away.');
    saveSTL(
      document,
      source.value === 'design' ? 'kufic' : (file.files?.[0]?.name.replace(/\.[^.]+$/, '') ?? 'image'),
      stl,
    );
    info.textContent = `Saved: ${tris.toLocaleString()} triangles, ${(stl.length / 1e6).toFixed(1)} MB.`;
  };

  return {
    open() {
      dlg.showModal();
      refresh();
    },
  };
}
