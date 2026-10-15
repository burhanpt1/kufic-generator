"""Separate calligraphy from its ground in a photo, and crop a letter target for fitting.

Three grounds were used in the lab:
  blue  - white/cream glaze letters on cobalt tiles (Topkapi): the ground is strongly blue, letters neutral;
          a locally adaptive threshold copes with uneven light.
  gold  - gold letters on a green or black field (panels, the Hagia Sophia roundels): letters are warm (red well above blue).
  black - dark ink on a light ground.

  python photo_mask.py PHOTO --ground blue --crop x0 y0 x1 y1 --out mask.npy
  python photo_mask.py --mask mask.npy --target x0 y0 x1 y1 --out target.json     # a box round one letter, in mask coordinates
"""
import argparse, json
import numpy as np

def mask_from_photo(path, ground, crop=None):
    from PIL import Image
    from skimage.morphology import opening, disk, remove_small_objects
    from skimage.filters import threshold_local
    im = Image.open(path).convert('RGB')
    if crop: im = im.crop(tuple(crop))
    a = np.asarray(im).astype(float); r, g, b = a[..., 0], a[..., 1], a[..., 2]; lum = 0.3 * r + 0.59 * g + 0.11 * b
    if ground == 'blue':
        m = (lum > threshold_local(lum, 151, offset=-12)) & ((b - r) / (lum + 1) < 0.45) & (lum > 60)
    elif ground == 'gold':
        m = (lum > 95) & ((r - b) > 45)
    else:
        m = lum < 128
    m = opening(m, disk(1))
    return remove_small_objects(m, max_size=60)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('photo', nargs='?'); ap.add_argument('--ground', default='blue', choices=['blue', 'gold', 'black'])
    ap.add_argument('--crop', nargs=4, type=int); ap.add_argument('--mask'); ap.add_argument('--target', nargs=4, type=int); ap.add_argument('--out', required=True)
    o = ap.parse_args()
    if o.target:
        m = np.load(o.mask); x0, y0, x1, y1 = o.target
        json.dump({'w': x1 - x0, 'h': y1 - y0, 'data': m[y0:y1, x0:x1].astype(int).flatten().tolist()}, open(o.out, 'w'))
    else:
        np.save(o.out, mask_from_photo(o.photo, o.ground, o.crop))
