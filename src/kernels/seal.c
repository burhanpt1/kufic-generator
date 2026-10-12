// Seal search kernel: simulated annealing over letter positions and variants.
// Memory is laid out by JavaScript in mem[] (int32). Grids are only touched where letters sit.
typedef unsigned char u8; typedef short i16; typedef long long i64;
#define MAXG 40000
static int mem[1 << 20];
int *buf(void) { return mem; }
static u8 cnt[MAXG], shAll[MAXG], ok8[MAXG]; static i16 who[MAXG];
static int touched[MAXG], nt, okl[MAXG], nok;
static int N, n, copies, sym; static int *Lt, *Vt, *Ct, *Jt, *Pt, *St;
static i64 seed; static double blockW;
static double rnd(void) { seed = (seed * 16807) % 2147483647; return (double)seed / 2147483647.0; }
static int fl(double v) { int i = (int)v; return (v < 0 && v != i) ? i - 1 : i; }
static double expo(double x) { if (x < -40) return 0; int k = 0; while (x < -0.5) { x /= 2; k++; } double r = 1 + x * (1 + x * (0.5 + x * (1.0 / 6 + x * (1.0 / 24 + x / 120.0)))); while (k--) r *= r; return r; }
static void tf(int x, int y, int t, int *X, int *Y) { if (!t) { *X = x; *Y = y; } else if (sym == 1) { *X = N - 1 - x; *Y = y; } else { *X = N - 1 - x; *Y = N - 1 - y; } }
static void mark8(int k) { int x = k % N, y = k / N; for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) { int X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= N || Y >= N) continue; int kk = Y * N + X; if (!ok8[kk]) { ok8[kk] = 1; okl[nok++] = kk; } } }
#define VAR(i) (Vt + (Lt[(i) * 2 + 1] + Pt[(i) * 3 + 2]) * 7)
static double energy(double share, double ink0, int detail) {
  nt = 0; nok = 0; int ink = 0; double cost = 0;
  for (int t = 0; t < copies; t++) for (int i = 0; i < n; i++) {
    int *v = VAR(i), px = Pt[i * 3], py = Pt[i * 3 + 1], id = i + n * t; if (!t) cost += v[2] / 1000.0;
    for (int c = 0; c < v[4]; c++) { int *cc = Ct + (v[3] + c) * 3, X, Y; tf(cc[0] + px, cc[1] + py, t, &X, &Y); int k = Y * N + X;
      if (!cnt[k]) { touched[nt++] = k; who[k] = id; shAll[k] = 1; } else if (who[k] != id) who[k] = -2;
      cnt[k]++; if (!cc[2]) shAll[k] = 0; ink++; }
  }
  int shared = 0, clash = 0, touch = 0, joined = 0, dangling = 0;
  for (int q = 0; q < nt; q++) { int k = touched[q]; if (cnt[k] >= 2) { if (shAll[k]) { shared++; mark8(k); } else clash += cnt[k] - 1; } }
  int blocks = 0; // solid 2x2 ink, counted at its top-left cell: letters that have collided
  for (int q = 0; q < nt; q++) { int k = touched[q], x = k % N; if (x < N - 1 && k + N + 1 < N * N && cnt[k + 1] && cnt[k + N] && cnt[k + N + 1]) blocks++; }
  if (detail) for (int i = 0; i < n; i++) St[8 + i] = 0;
  for (int t = 0; t < copies; t++) for (int i = 0; i < n; i++) {
    int *v = VAR(i), px = Pt[i * 3], py = Pt[i * 3 + 1], id = i + n * t;
    for (int j = 0; j < v[6]; j++) { int *jj = Jt + (v[5] + j) * 3, X, Y, X0, Y0; tf(jj[0] + px + jj[2], jj[1] + py, t, &X, &Y); tf(jj[0] + px, jj[1] + py, t, &X0, &Y0);
      int inside = X >= 0 && Y >= 0 && X < N && Y < N; int k = inside ? Y * N + X : 0;
      if (inside && cnt[k] && who[k] != id) { joined++; mark8(k); mark8(Y0 * N + X0); } else { dangling++; if (detail) St[8 + i] += 3; } }
  }
  for (int t = 0; t < copies; t++) for (int i = 0; i < n; i++) {
    int *v = VAR(i), px = Pt[i * 3], py = Pt[i * 3 + 1], id = i + n * t;
    for (int c = 0; c < v[4]; c++) { int *cc = Ct + (v[3] + c) * 3, X, Y; tf(cc[0] + px, cc[1] + py, t, &X, &Y); int k = Y * N + X;
      if (detail && cnt[k] >= 2 && !shAll[k]) St[8 + i] += 2;
      if (ok8[k]) continue;
      for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; int XX = X + dx, YY = Y + dy; if (XX < 0 || YY < 0 || XX >= N || YY >= N) continue; int kk = YY * N + XX;
        if (cnt[kk] && who[kk] >= 0 && who[kk] != id) { touch++; if (detail) St[8 + i]++; } } }
  }
  int x0 = 1 << 30, y0 = 1 << 30, x1 = -(1 << 30), y1 = -(1 << 30);
  for (int t = 0; t < copies; t++) for (int i = 0; i < n; i++) { int *v = VAR(i), px = Pt[i * 3], py = Pt[i * 3 + 1], X, Y;
    tf(px, py, t, &X, &Y); if (X < x0) x0 = X; if (X + 1 > x1) x1 = X + 1; if (Y < y0) y0 = Y; if (Y + 1 > y1) y1 = Y + 1;
    tf(px + v[0] - 1, py + v[1] - 1, t, &X, &Y); if (X < x0) x0 = X; if (X + 1 > x1) x1 = X + 1; if (Y < y0) y0 = Y; if (Y + 1 > y1) y1 = Y + 1; }
  int bw = x1 - x0, bh = y1 - y0, area = bw * bh, d = bw > bh ? bw - bh : bh - bw;
  double E = 60.0 * clash + 5.0 * touch - share * 9 * shared + 18.0 * dangling - share * 6 * joined + 22.0 * (area - ink) / ink0 + 2.5 * d + 0.3 * cost * copies + blockW * blocks;
  if (detail) { St[0] = shared; St[1] = clash; St[2] = touch; St[3] = joined; St[4] = dangling; St[5] = bw; St[6] = bh; St[7] = area; }
  for (int q = 0; q < nt; q++) { cnt[touched[q]] = 0; who[touched[q]] = -1; }
  for (int q = 0; q < nok; q++) ok8[okl[q]] = 0;
  return E;
}
static void clampP(int i) { int *v = VAR(i); if (Pt[i * 3] > N - v[0]) Pt[i * 3] = N - v[0]; if (Pt[i * 3] < 0) Pt[i * 3] = 0; if (Pt[i * 3 + 1] > N - v[1]) Pt[i * 3 + 1] = N - v[1]; if (Pt[i * 3 + 1] < 0) Pt[i * 3 + 1] = 0; }
int run(int n_, int N_, int copies_, int sym_, int iters, int seed_, int shareMilli, int ink0, int offL, int offV, int offC, int offJ, int offP, int offS, int blockMilli) {
  n = n_; N = N_; copies = copies_; sym = sym_; seed = seed_; blockW = blockMilli / 1000.0; Lt = mem + offL; Vt = mem + offV; Ct = mem + offC; Jt = mem + offJ; Pt = mem + offP; St = mem + offS;
  if (N * N > MAXG) return -1;
  for (int k = 0; k < N * N; k++) { cnt[k] = 0; ok8[k] = 0; who[k] = -1; }
  double share = shareMilli / 1000.0, E = energy(share, ink0, 0), T = 30, decay = expo(-6.39693 / iters);
  for (int it = 0; it < iters; it++) {
    int i = fl(rnd() * n), j = -1, ox = Pt[i * 3], oy = Pt[i * 3 + 1], ov = Pt[i * 3 + 2], jx = 0, jy = 0; double mv = rnd();
    if (mv < 0.58) { Pt[i * 3] += fl((rnd() - 0.5) * 6 + 0.5); Pt[i * 3 + 1] += fl((rnd() - 0.5) * 6 + 0.5); clampP(i); }
    else if (mv < 0.76 && Lt[i * 2] > 1) { Pt[i * 3 + 2] = fl(rnd() * Lt[i * 2]); clampP(i); }
    else if (mv < 0.9 && n > 1) { j = (i + 1 + fl(rnd() * (n - 1))) % n; jx = Pt[j * 3]; jy = Pt[j * 3 + 1]; Pt[i * 3] = jx; Pt[i * 3 + 1] = jy; Pt[j * 3] = ox; Pt[j * 3 + 1] = oy; clampP(i); clampP(j); }
    else { int *v = VAR(i); Pt[i * 3] = fl(rnd() * (N - v[0])); Pt[i * 3 + 1] = fl(rnd() * (N - v[1])); }
    double E2 = energy(share, ink0, 0);
    if (E2 <= E || rnd() < expo((E - E2) / T)) E = E2;
    else { Pt[i * 3] = ox; Pt[i * 3 + 1] = oy; Pt[i * 3 + 2] = ov; if (j >= 0) { Pt[j * 3] = jx; Pt[j * 3 + 1] = jy; } }
    T = T * decay; if (T < 0.05) T = 0.05;
  }
  energy(share, ink0, 1);
  return 0;
}
