// Partition kernel (src/layout/solvers.ts partition()): split n text segments into G contiguous non-empty groups of
// the given capacities, spreading the slack evenly, with a penalty for breaking inside a word. Dynamic programming over
// (group, end); the same arithmetic in the same order as the TypeScript, so both give identical groups.
// Input, laid out by JavaScript: in[0..n) widths, in[n..2n) 1 where the segment ends a word, in[2n..2n+G) capacities.
// Output: out[0..G] the group boundaries (out[0] = 0, out[G] = n). run() returns 1, or 0 if no split fits.
#define MAXN 4096
#define MAXG 64
static double in[2 * MAXN + MAXG];
static int out[MAXG + 1];
static double pw[MAXN + 1], pg[MAXN + 1];
static double f[(MAXG + 1) * (MAXN + 1)];
static int from[(MAXG + 1) * (MAXN + 1)];
double *inbuf(void) { return in; }
int *outbuf(void) { return out; }
int maxn(void) { return MAXN; }
int maxg(void) { return MAXG; }

int run(int n, int G, double wg) {
  const double INF = 1e18, PEN = 0.3;
  const double *minW = in, *ends = in + n, *caps = in + 2 * n;
  if (n < G || n > MAXN || G > MAXG) return 0;
  pw[0] = 0;
  pg[0] = 0;
  for (int i = 0; i < n; i++) {
    pw[i + 1] = pw[i] + minW[i];
    pg[i + 1] = pg[i] + (i < n - 1 ? (ends[i] != 0 ? wg : 1) : 0);
  }
  const int S = n + 1;
  for (int k = 0; k < (G + 1) * S; k++) {
    f[k] = INF;
    from[k] = 0;
  }
  f[0] = 0;
  for (int g = 1; g <= G; g++) {
    const double c = caps[g - 1];
    if (!(c >= 1)) return 0;
    double *fg = f + g * S, *fp = f + (g - 1) * S;
    int *frg = from + g * S;
    for (int j = g; j <= n - (G - g); j++)
      for (int i = j - 1; i >= g - 1; i--) {
        const double W = pw[j] - pw[i] + pg[j - 1] - pg[i];
        if (W > c) break;
        if (fp[i] == INF) continue;
        const double sl = (c - W) / c, cost = fp[i] + sl * sl + (j < n && ends[j - 1] == 0 ? PEN : 0);
        if (cost < fg[j]) {
          fg[j] = cost;
          frg[j] = i;
        }
      }
  }
  if (f[G * S + n] >= INF) return 0;
  int j = n;
  out[G] = n;
  for (int g = G; g > 0; g--) {
    j = from[g * S + j];
    out[g - 1] = j;
  }
  return 1;
}
