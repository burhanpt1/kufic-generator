// Browser-side rasterising of an SVG for the critic.

/** The SVG as a PNG (longest side `size` px), base64 without the data: prefix. */
export function svgToPngBase64(svg: string, size = 768): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = size / Math.max(img.width, img.height),
        c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = () => rej(new Error('could not rasterise the composition'));
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  });
}
