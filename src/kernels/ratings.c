// Ratings kernel (src/evolve/ratings.ts fitPairwise): logistic regression on feature differences by gradient
// descent, the same arithmetic in the same order as the TypeScript, so both give the same weights bit for bit.
// Math.exp is V8's (base/ieee754.cc, from FreeBSD's fdlibm e_exp.c), so the results match Node and Chromium exactly.

#define PAGE 65536
extern unsigned char __heap_base;
unsigned char *room(unsigned int bytes) {
  unsigned long need = (unsigned long)&__heap_base + bytes,
                have = (unsigned long)__builtin_wasm_memory_size(0) * PAGE;
  if (need > have && __builtin_wasm_memory_grow(0, (need - have + PAGE - 1) / PAGE) < 0) return 0;
  return &__heap_base;
}

typedef unsigned int u32;
typedef unsigned long long u64;
static u32 hi_word(double x) { return (u32)(__builtin_bit_cast(u64, x) >> 32); }
static u32 lo_word(double x) { return (u32)__builtin_bit_cast(u64, x); }
static double from_words(u32 hi, u32 lo) { return __builtin_bit_cast(double, ((u64)hi << 32) | lo); }

static double jsexp(double x) {
  static const double one = 1.0, halF[2] = {0.5, -0.5}, o_threshold = 7.09782712893383973096e+02,
                      u_threshold = -7.45133219101941108420e+02,
                      ln2HI[2] = {6.93147180369123816490e-01, -6.93147180369123816490e-01},
                      ln2LO[2] = {1.90821492927058770002e-10, -1.90821492927058770002e-10},
                      invln2 = 1.44269504088896338700e+00, P1 = 1.66666666666666019037e-01,
                      P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05,
                      P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08, E = 2.718281828459045;
  static volatile double huge = 1.0e+300, twom1000 = 9.33263618503218878990e-302, two1023 = 8.988465674311579539e307;
  double y, hi = 0.0, lo = 0.0, c, t, twopk;
  int k = 0, xsb;
  u32 hx = hi_word(x);
  xsb = (hx >> 31) & 1;
  hx &= 0x7fffffff;
  if (hx >= 0x40862E42) {
    if (hx >= 0x7ff00000) {
      if (((hx & 0xfffff) | lo_word(x)) != 0) return x + x;
      return xsb == 0 ? x : 0.0;
    }
    if (x > o_threshold) return huge * huge;
    if (x < u_threshold) return twom1000 * twom1000;
  }
  if (hx > 0x3fd62e42) {
    if (hx < 0x3FF0A2B2) {
      if (x == 1.0) return E;
      hi = x - ln2HI[xsb];
      lo = ln2LO[xsb];
      k = 1 - xsb - xsb;
    } else {
      k = (int)(invln2 * x + halF[xsb]);
      t = k;
      hi = x - t * ln2HI[0];
      lo = t * ln2LO[0];
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {
    if (huge + x > one) return one + x;
  } else {
    k = 0;
  }
  t = x * x;
  if (k >= -1021) twopk = from_words(0x3ff00000 + ((u32)k << 20), 0);
  else twopk = from_words(0x3ff00000 + ((u32)(k + 1000) << 20), 0);
  c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k == 0) return one - ((x * c) / (c - 2.0) - x);
  y = one - ((lo - (x * c) / (2.0 - c)) - hi);
  if (k >= -1021) {
    if (k == 1024) return y * 2.0 * two1023;
    return y * twopk;
  }
  return y * twopk * twom1000;
}

// Layout: doubles d [m*k] (feature differences, a row per vote), y [m] (1 if the first won), w [k] (out), g [k].
static double *D, *Y, *W, *G;
unsigned char *fit_setup(int m, int k) {
  unsigned char *p = room(8u * ((unsigned)m * k + m + 2u * k));
  if (!p) return 0;
  D = (double *)p;
  Y = D + m * k;
  W = Y + m;
  G = W + k;
  return p;
}
void fit(int m, int k, double l2, int iters) {
  const double lr = 0.5;
  for (int j = 0; j < k; j++) W[j] = 0;
  for (int it = 0; it < iters; it++) {
    for (int j = 0; j < k; j++) G[j] = l2 * W[j];
    for (int i = 0; i < m; i++) {
      double s = 0;
      for (int j = 0; j < k; j++) s = s + D[i * k + j] * W[j];
      double p = 1 / (1 + jsexp(-s));
      for (int j = 0; j < k; j++) G[j] += ((p - Y[i]) * D[i * k + j]) / m;
    }
    for (int j = 0; j < k; j++) W[j] -= lr * G[j];
  }
}

