// Roundel kernels (src/script/thuluth/roundel): the three inner loops the roundel composer spends its time in, with
// the same arithmetic in the same order as the TypeScript they stand in for, so both give the same numbers bit for bit.
//  - gap_*: the mark solver's empty-space measure (solve.ts gapCost): each grid cell's clearance to the nearest ink
//    or mark, kept up to date as one mark moves at a time.
//  - disc: the composer's enclosing disc (compose.ts disc): a quick smallest enclosing circle of the letters' hulls.
//  - oval: the frame's oval (bowl.ts fitFrame): the least oval round everything drawn, over a grid of centres.
// Math.hypot is V8's (normalised by the larger magnitude, the squares Kahan-summed), so the results match Node and
// Chromium exactly; JavaScript's Math.min and Math.max are kept to the letter (a -0 is less than a +0).
// Each kernel runs in its own instance; its arrays live past the heap base, laid out by JavaScript after room().

#define PAGE 65536
extern unsigned char __heap_base;

// Room for `bytes` past the heap base (memory grows as needed); returns its address, or 0 if memory cannot grow.
unsigned char *room(unsigned int bytes) {
  unsigned long need = (unsigned long)&__heap_base + bytes,
                have = (unsigned long)__builtin_wasm_memory_size(0) * PAGE;
  if (need > have && __builtin_wasm_memory_grow(0, (need - have + PAGE - 1) / PAGE) < 0) return 0;
  return &__heap_base;
}

static double jshypot(double a, double b) {
  double x = __builtin_fabs(a), y = __builtin_fabs(b), max = 0;
  if (a != a || b != b) return x == __builtin_inf() || y == __builtin_inf() ? __builtin_inf() : __builtin_nan("");
  if (x > max) max = x;
  if (y > max) max = y;
  if (max == __builtin_inf()) return __builtin_inf();
  if (max == 0) return 0;
  double sum = 0, comp = 0, n, summand, pre;
  n = x / max;
  summand = n * n - comp;
  pre = sum + summand;
  comp = (pre - sum) - summand;
  sum = pre;
  n = y / max;
  summand = n * n - comp;
  pre = sum + summand;
  comp = (pre - sum) - summand;
  sum = pre;
  return __builtin_sqrt(sum) * max;
}
static double jsmin(double a, double b) {
  if (a != a || b != b) return __builtin_nan("");
  if (a < b) return a;
  if (b < a) return b;
  return __builtin_signbit(a) ? a : b;
}
static double jsmax(double a, double b) {
  if (a != a || b != b) return __builtin_nan("");
  if (a > b) return a;
  if (b > a) return b;
  return __builtin_signbit(a) ? b : a;
}

// ---- gap: cells × items -------------------------------------------------------------------------------------------
// Layout (JavaScript writes cx, cy, cb after gap_setup): doubles cx, cy, cb, cmin [nc]; rx, ry, rr [ni]; rows [ni*nc];
// then ints carg [nc], ver [ni], stamp [ni*nc].
static int nc, ni;
static double *cx, *cy, *cb, *cmin, *rx, *ry, *rr, *rows;
static int *carg, *ver, *stamp;

unsigned char *gap_setup(int ncells, int nitems) {
  nc = ncells;
  ni = nitems;
  unsigned long d = 8ul * (4ul * nc + 3ul * ni + (unsigned long)ni * nc), i4 = 4ul * (nc + ni + (unsigned long)ni * nc);
  unsigned char *m = room(d + i4);
  if (!m) return 0;
  double *p = (double *)m;
  cx = p, p += nc;
  cy = p, p += nc;
  cb = p, p += nc;
  cmin = p, p += nc;
  rx = p, p += ni;
  ry = p, p += ni;
  rr = p, p += ni;
  rows = p, p += (unsigned long)ni * nc;
  int *q = (int *)p;
  carg = q, q += nc;
  ver = q, q += ni;
  stamp = q;
  for (int k = 0; k < ni; k++) ver[k] = 0, rx[k] = __builtin_nan(""), ry[k] = rr[k] = 0;
  for (unsigned long o = 0; o < (unsigned long)ni * nc; o++) stamp[o] = -1;
  return m;
}
static double clearance(int c, int k) {
  unsigned long o = (unsigned long)c * ni + k;
  if (stamp[o] != ver[k]) {
    double v = jshypot(cx[c] - rx[k], cy[c] - ry[k]) - rr[k];
    rows[o] = v > 0 ? v : 0; // Math.max(0, v)
    stamp[o] = ver[k];
  }
  return rows[o];
}
static void rescan(int c) {
  double d = cb[c];
  int a = -1;
  for (int j = 0; j < ni; j++) {
    double v = clearance(c, j);
    if (v < d) d = v, a = j;
  }
  cmin[c] = d;
  carg[c] = a;
}
// Item k is now at (x, y) with radius r; unless the measure is fresh, the cells it may now be nearest to, or was
// nearest to, are measured again.
void gap_move(int k, double x, double y, double r, int fresh) {
  rx[k] = x;
  ry[k] = y;
  rr[k] = r;
  ver[k]++;
  if (fresh) return;
  for (int c = 0; c < nc; c++) {
    double dx = cx[c] - x, dy = cy[c] - y, reach = cmin[c] + r + 1e-6;
    if (carg[c] != k && dx * dx + dy * dy > reach * reach * (1 + 1e-9)) continue;
    double v = clearance(c, k);
    if (v < cmin[c]) cmin[c] = v, carg[c] = k;
    else if (carg[c] == k && v > cmin[c]) rescan(c);
  }
}
void gap_rescan_all(void) {
  for (int c = 0; c < nc; c++) rescan(c);
}
double gap_sum(void) {
  double e2 = 0;
  for (int c = 0; c < nc; c++) {
    double d = cmin[c];
    if (d > 1.6) e2 += (d - 1.6) * (d - 1.6);
  }
  return e2 / (nc > 1 ? nc : 1);
}

// ---- disc: the hulls of the placed groups --------------------------------------------------------------------------
// Layout: doubles pool [2*npts] (each hull's x y pairs, written once), hulls [2*nhulls] (offset, count), groups
// [3*ngroups] (x, y, hull, written for each call), out [3]; then the kernel's own: a circle round each hull, and each
// group's reach.
static double *pool, *hulls, *grp, *dout, *hc, *gub;
static int nhull;
unsigned char *disc_setup(int npts, int nhulls, int ngroups) {
  unsigned char *m = room(8u * (2u * npts + 2u * nhulls + 3u * ngroups + 3u + 3u * nhulls + ngroups));
  if (!m) return 0;
  nhull = nhulls;
  pool = (double *)m;
  hulls = pool + 2 * npts;
  grp = hulls + 2 * nhulls;
  dout = grp + 3 * ngroups;
  hc = dout + 3;
  gub = hc + 3 * nhulls;
  return m;
}
// Once the hulls are written: a circle round each (centred on its box), to skip far groups quickly.
void disc_index(void) {
  for (int j = 0; j < nhull; j++) {
    const double *h = pool + 2 * (long)hulls[2 * j];
    int n = (int)hulls[2 * j + 1];
    double x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, r2 = 0;
    for (int k = 0; k < n; k++) {
      double x = h[2 * k], y = h[2 * k + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    double cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (int k = 0; k < n; k++) {
      double dx = h[2 * k] - cx, dy = h[2 * k + 1] - cy;
      if (dx * dx + dy * dy > r2) r2 = dx * dx + dy * dy;
    }
    hc[3 * j] = cx;
    hc[3 * j + 1] = cy;
    hc[3 * j + 2] = __builtin_sqrt(r2) * (1 + 1e-9) + 1e-9;
  }
}
// The largest squared distance any point of group i can have from (ccx, ccy) in the stretched metric, from above.
static double reach(int i, double ccx, double ccy, double sx) {
  int j = (int)grp[3 * i + 2];
  double ex = (__builtin_fabs(grp[3 * i] + hc[3 * j] - ccx) + hc[3 * j + 2]) / sx,
         ey = __builtin_fabs(grp[3 * i + 1] + hc[3 * j + 1] - ccy) + hc[3 * j + 2];
  return (ex * ex + ey * ey) * (1 + 1e-6) + 1e-9;
}
// The farthest point from (ccx, ccy) in a metric stretched by sx across: the first of the points with the largest
// Math.hypot, found by squared distance (skipping groups that cannot reach the farthest found so far) and then
// Math.hypot among the near-farthest only. Its distance in *fd.
static int farthest(int ng, double ccx, double ccy, double sx, double *fd, double *fx, double *fy) {
  double best = -1;
  int first = 0;
  for (int i = 0; i < ng; i++) {
    gub[i] = reach(i, ccx, ccy, sx);
    if (gub[i] > gub[first]) first = i;
  }
  for (int t = -1; t < ng; t++) {
    int i = t < 0 ? first : t;
    if (t == first || gub[i] < best) continue;
    double gx = grp[3 * i], gy = grp[3 * i + 1];
    int j = (int)grp[3 * i + 2], n = (int)hulls[2 * j + 1];
    const double *h = pool + 2 * (long)hulls[2 * j];
    for (int k = 0; k < n; k++) {
      double dx = (gx + h[2 * k] - ccx) / sx, dy = gy + h[2 * k + 1] - ccy, q = dx * dx + dy * dy;
      if (q > best) best = q;
    }
  }
  double near = best * (1 - 1e-9);
  int found = 0;
  *fd = -1;
  for (int i = 0; i < ng; i++) {
    if (gub[i] < near) continue;
    double gx = grp[3 * i], gy = grp[3 * i + 1];
    int j = (int)grp[3 * i + 2], n = (int)hulls[2 * j + 1];
    const double *h = pool + 2 * (long)hulls[2 * j];
    for (int k = 0; k < n; k++) {
      double x = gx + h[2 * k], y = gy + h[2 * k + 1], dx = (x - ccx) / sx, dy = y - ccy;
      if (dx * dx + dy * dy < near) continue;
      double dd = jshypot(dx, dy);
      if (dd > *fd) *fd = dd, *fx = x, *fy = y, found = 1;
    }
  }
  return found;
}
// out: cx, cy, and the radius (before its margin) in the oval metric
int disc(int ng, double oval) {
  double x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (int i = 0; i < ng; i++) {
    double gx = grp[3 * i], gy = grp[3 * i + 1];
    int j = (int)grp[3 * i + 2], n = (int)hulls[2 * j + 1];
    const double *h = pool + 2 * (long)hulls[2 * j];
    for (int k = 0; k < n; k++) {
      double x = gx + h[2 * k], y = gy + h[2 * k + 1];
      x0 = jsmin(x0, x);
      x1 = jsmax(x1, x);
      y0 = jsmin(y0, y);
      y1 = jsmax(y1, y);
    }
  }
  double ccx = (x0 + x1) / 2, ccy = (y0 + y1) / 2, fd, fx = 0, fy = 0;
  for (int it = 0; it < 12; it++) {
    if (!farthest(ng, ccx, ccy, 1, &fd, &fx, &fy)) return 0;
    ccx += ((fx - ccx) * 0.08) / (1 + it * 0.3);
    ccy += ((fy - ccy) * 0.08) / (1 + it * 0.3);
  }
  double r = 0;
  if (farthest(ng, ccx, ccy, oval, &fd, &fx, &fy)) r = jsmax(0, fd);
  dout[0] = ccx;
  dout[1] = ccy;
  dout[2] = r;
  return 1;
}

// ---- oval: everything drawn, as x y margin triples ------------------------------------------------------------------
// Layout: doubles pts [3*npts], ovals [novals], out [5] (area, cx, cy, R, v).
static double *opts, *ovals, *oout;
unsigned char *oval_setup(int npts, int novals) {
  unsigned char *m = room(8u * (3u * npts + novals + 5u));
  if (!m) return 0;
  opts = (double *)m;
  ovals = opts + 3 * npts;
  oout = ovals + novals;
  return m;
}
// The least oval round the points over a grid of centres about (mx, my), for each proportion; R is the largest
// Math.hypot((x - cx) / v, y - cy) + margin, found by square roots first and Math.hypot only near the largest.
int oval(int np, int nv, double mx, double my, double wd, double hd, double pull, double pref) {
  int found = 0;
  for (int iv = 0; iv < nv; iv++) {
    double v = ovals[iv];
    for (double dx = -0.15; dx <= 0.1501; dx += 0.03)
      for (double dy = -0.15; dy <= 0.1501; dy += 0.03) {
        double ccx = mx + dx * wd, ccy = my + dy * hd, amax = -1;
        for (int k = 0; k < np; k++) {
          double ex = (opts[3 * k] - ccx) / v, ey = opts[3 * k + 1] - ccy,
                 a = __builtin_sqrt(ex * ex + ey * ey) + opts[3 * k + 2];
          if (a > amax) amax = a;
        }
        double lim = amax - 1e-9 * (amax + 1), R = 0;
        for (int k = 0; k < np; k++) {
          double ex = (opts[3 * k] - ccx) / v, ey = opts[3 * k + 1] - ccy,
                 a = __builtin_sqrt(ex * ex + ey * ey) + opts[3 * k + 2];
          if (a < lim) continue;
          R = jsmax(R, jshypot(ex, ey) + opts[3 * k + 2]);
        }
        double area = R * R * v * (1 + pull * __builtin_fabs(v - pref));
        if (!found || area < oout[0]) {
          oout[0] = area, oout[1] = ccx, oout[2] = ccy, oout[3] = R, oout[4] = v;
          found = 1;
        }
      }
  }
  return found;
}
