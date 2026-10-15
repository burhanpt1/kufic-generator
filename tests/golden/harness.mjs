// JSON form of engine output. Typed arrays (grid cells, tags, ring ids) become {"$u8": "..."} with one base-36
// digit per cell, so a 100×100 grid is one readable 10 kB string instead of 10,000 array entries.
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
export function serialize(value) {
  return JSON.parse(
    JSON.stringify(value, (k, v) => {
      if (v && typeof v === 'object' && ArrayBuffer.isView(v)) {
        const name = v.constructor.name;
        if (name !== 'Uint8Array') throw new Error(`unexpected ${name} in engine output`);
        if (v.some(n => n >= DIGITS.length)) return { $u8: Array.from(v) };
        return { $u8: Array.from(v, n => DIGITS[n]).join('') };
      }
      if (typeof v === 'number' && !Number.isFinite(v)) return { $num: String(v) };
      return v;
    }),
  );
}
