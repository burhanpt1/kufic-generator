// Raster kernel (src/script/thuluth/raster.ts Alpha.fill): fill polygons as one non-zero path into an 8-bit alpha
// window, with exact horizontal coverage on S sub-scanlines per pixel, composited source-over. The same arithmetic in
// the same order as the TypeScript (coverage summed in float32, JavaScript's Math.round), so both give the same bytes.
// Input, laid out by JavaScript in pts[]: for each polygon its point count, then x0 y0 x1 y1 ... (pixels, y down).
// The window win[] holds rows py0..py1, columns px0..px1 of the alpha channel, read and written in place.
#define S 4
#define MAXPTS (1 << 17)
#define MAXWIN (1 << 21)
#define MAXEDGE (1 << 16)
static double pts[MAXPTS];
static unsigned char win[MAXWIN];
static float cov[MAXWIN];
static double ex0[MAXEDGE], ey0[MAXEDGE], ex1[MAXEDGE], ey1[MAXEDGE];
static int ed[MAXEDGE];
static double xs[MAXEDGE];
static int ws[MAXEDGE];
double *ptsbuf(void) { return pts; }
unsigned char *winbuf(void) { return win; }
int maxpts(void) { return MAXPTS; }
int maxwin(void) { return MAXWIN; }

static double jsround(double x) { // Math.round: the nearest integer, halves towards +infinity
  double r = __builtin_floor(x);
  return x - r >= 0.5 ? r + 1 : r;
}

// npoly polygons in pts[]; window [px0, px1] x [py0, py1]. Returns 0 if the edges overflow the kernel's tables.
int fill(int npoly, int px0, int px1, int py0, int py1) {
  const int bw = px1 - px0 + 1, bh = py1 - py0 + 1;
  int ne = 0, o = 0;
  for (int p = 0; p < npoly; p++) {
    const int n = (int)pts[o++];
    for (int i = 0; i < n; i++) {
      const int j = (i + 1) % n;
      const double ax = pts[o + 2 * i], ay = pts[o + 2 * i + 1], bx = pts[o + 2 * j], by = pts[o + 2 * j + 1];
      if (ay == by) continue;
      if (ne >= MAXEDGE) return 0;
      if (ay < by) { ex0[ne] = ax; ey0[ne] = ay; ex1[ne] = bx; ey1[ne] = by; ed[ne] = 1; }
      else { ex0[ne] = bx; ey0[ne] = by; ex1[ne] = ax; ey1[ne] = ay; ed[ne] = -1; }
      ne++;
    }
    o += 2 * n;
  }
  for (int k = 0; k < bw * bh; k++) cov[k] = 0;
  for (int py = py0; py <= py1; py++)
    for (int sj = 0; sj < S; sj++) {
      const double sy = py + (sj + 0.5) / S;
      int m = 0;
      for (int e = 0; e < ne; e++)
        if (sy >= ey0[e] && sy < ey1[e]) {
          const double x = ex0[e] + ((sy - ey0[e]) * (ex1[e] - ex0[e])) / (ey1[e] - ey0[e]);
          // insertion by x, after any equal crossing (as a stable sort leaves them)
          int k = m;
          while (k > 0 && xs[k - 1] > x) { xs[k] = xs[k - 1]; ws[k] = ws[k - 1]; k--; }
          xs[k] = x;
          ws[k] = ed[e];
          m++;
        }
      if (m < 2) continue;
      int wind = 0;
      for (int k = 0; k < m - 1; k++) {
        wind += ws[k];
        if (!wind) continue;
        const double xa = xs[k] > px0 ? xs[k] : px0, xb = xs[k + 1] < px1 + 1 ? xs[k + 1] : px1 + 1;
        if (xb <= xa) continue;
        const int row = (py - py0) * bw - px0, ia = (int)__builtin_floor(xa);
        int ib = (int)__builtin_ceil(xb) - 1;
        if (ib > px1) ib = px1;
        for (int px = ia; px <= ib; px++) {
          const double hi = xb < px + 1 ? xb : px + 1, lo = xa > px ? xa : px;
          cov[row + px] = (float)((double)cov[row + px] + (hi - lo) / S);
        }
      }
    }
  for (int k = 0; k < bw * bh; k++) {
    const double c = cov[k];
    if (c == 0) continue;
    const int a = win[k], src = (int)jsround((c < 1 ? c : 1) * 255);
    int v = a + (int)jsround((double)(src * (255 - a)) / 255);
    win[k] = (unsigned char)(v < 255 ? v : 255);
  }
  return 1;
}
