// Seeded randomness: the Park–Miller generator used everywhere (COMPOSITION_ENGINE.md §1.3).
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = ((Math.floor(Math.abs(seed)) % 2147483646) + 2147483646) % 2147483646 || 1;
    if (this.s <= 0) this.s += 2147483646;
  }
  /** Uniform in (0, 1). */
  next(): number {
    this.s = (this.s * 16807) % 2147483647;
    return this.s / 2147483647;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  pick<T>(a: readonly T[]): T {
    return a[this.int(a.length)];
  }
  /** Pick with weights (non-negative). */
  weighted<T>(a: readonly T[], w: readonly number[]): T {
    const t = w.reduce((x, y) => x + y, 0);
    let r = this.next() * t;
    for (let i = 0; i < a.length; i++) {
      r -= w[i];
      if (r <= 0) return a[i];
    }
    return a[a.length - 1];
  }
  /** A fresh seed for a node (maze, seal) or a child. */
  seed(): number {
    return 1 + this.int(2147483640);
  }
  get state() {
    return this.s;
  }
}
