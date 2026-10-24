"""Noise as B sees it: unresolved contact. Notches (tiny gaps where strokes nearly touch: closing with a disc of radius 2
px at 480 px, per unit of ink) and pinholes (enclosed holes under 40 px, per 10,000 ink px), each standardised against the
rated set (means and spreads in data/ratings/debris.json, columns 1 and 2) and summed. Spikes (thin slivers) were tried
and rejected: they measure thin strokes, which B rewards. Usage: noise(png_bytes) -> float (lower is quieter)."""
import io, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
D = np.array(json.load(open('data/ratings/debris.json'))['F']); MU, SD = D[:, 1:3].mean(0), D[:, 1:3].std(0)
disk = lambda r: (lambda y, x: x * x + y * y <= r * r)(*np.mgrid[-r:r + 1, -r:r + 1])
def noise(png):
    a = np.asarray(Image.open(io.BytesIO(png)).convert('RGB').resize((480, 480))).astype(int); ink = (a[..., 0] > 150) & (a[..., 0] - a[..., 2] > 60)  # gold ink
    yy, xx = np.mgrid[0:480, 0:480]; ink &= ((xx - 240) ** 2 + (yy - 240) ** 2) < (240 * 0.87) ** 2; A = ink.sum() + 1
    notch = (ndi.binary_closing(ink, disk(2)) & ~ink).sum() / A * 100; holes = ndi.binary_fill_holes(ink) & ~ink; hl, hn = ndi.label(holes)
    pin = ((ndi.sum(holes, hl, range(1, hn + 1)) < 40).sum() if hn else 0) / (A / 10000)
    return float((notch - MU[0]) / SD[0] + (pin - MU[1]) / SD[1])
