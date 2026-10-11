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

export function saveSVG(doc: Document, name: string, svg: string) {
  download(doc, name + '.svg', new Blob([svg], { type: 'image/svg+xml' }));
}

/** Rasterise at up to 4× (capped near 4000 px wide), as the prototype did. */
export function savePNG(doc: Document, name: string, svg: string) {
  const img = new Image();
  img.onload = () => {
    const scale = Math.max(1, Math.min(4, 4000 / img.width));
    const c = doc.createElement('canvas');
    c.width = img.width * scale;
    c.height = img.height * scale;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(b => b && download(doc, name + '.png', b), 'image/png');
  };
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}
