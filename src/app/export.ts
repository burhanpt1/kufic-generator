// Save the current SVG, or a PNG rendered from it, as a download.

export function download(doc: Document, filename: string, data: Blob) {
  const url = URL.createObjectURL(data);
  const a = doc.createElement('a');
  a.href = url;
  a.download = filename;
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file name (no extension) for a composition: its preset's name if it is one, else the first words of its text.
 *  Letters and digits of any script are kept, harakat and everything else dropped; 'kufic' when nothing is left. */
export function downloadName(text: string, preset = ''): string {
  const clean = (s: string) =>
    s
      .normalize('NFC')
      .split('\n')[0]
      .replace(/\p{M}/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');
  // whole words, up to 40 characters
  let out = '';
  for (const w of (clean(preset).toLowerCase() || clean(text)).split('-')) {
    if (out && out.length + 1 + w.length > 40) break;
    out = out ? out + '-' + w : w.slice(0, 40);
  }
  return out || 'kufic';
}

export function saveSVG(doc: Document, name: string, svg: string) {
  download(doc, name + '.svg', new Blob([svg], { type: 'image/svg+xml' }));
}

/** Rasterise at up to 4× (capped near 4000 px wide), as the prototype did. onError is told when the picture could
 *  not be made (the SVG would not load, or the browser would not give the canvas back as a PNG). */
export function savePNG(
  doc: Document,
  name: string,
  svg: string,
  onError: (message: string) => void = m => console.error(m),
) {
  const img = new Image();
  img.onload = () => {
    try {
      const scale = Math.max(1, Math.min(4, 4000 / img.width));
      const c = doc.createElement('canvas');
      c.width = img.width * scale;
      c.height = img.height * scale;
      const ctx = c.getContext('2d');
      if (!ctx) return onError('Could not make the PNG: this browser gave no canvas to draw on.');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => {
        if (b) download(doc, name + '.png', b);
        else onError('Could not make the PNG: the picture is too large for this browser. The SVG still saves.');
      }, 'image/png');
    } catch (e) {
      onError('Could not make the PNG: ' + String((e as Error)?.message ?? e));
    }
  };
  img.onerror = () => onError('Could not make the PNG: the drawing would not load as a picture. The SVG still saves.');
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

export function saveSTL(doc: Document, name: string, stl: Uint8Array) {
  download(doc, name + '.stl', new Blob([stl as BlobPart], { type: 'model/stl' }));
}
