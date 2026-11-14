// The embedded WebAssembly (src/kernels/*.wasm.ts) must be built from the C beside it: each module carries the hash
// of the source it was compiled from (scripts/build-wasm.mjs). A kernel edited without `npm run build:wasm` would
// otherwise run the old code while every "same as the TypeScript" test compared the old code too.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as clipper2 from '../src/kernels/clipper2.wasm';
import * as partition from '../src/kernels/partition.wasm';
import * as raster from '../src/kernels/raster.wasm';
import * as ratings from '../src/kernels/ratings.wasm';
import * as roundel from '../src/kernels/roundel.wasm';
import * as seal from '../src/kernels/seal.wasm';

const root = join(import.meta.dirname, '..');
const sha256 = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');

describe('the embedded kernels are built from the sources in the repository', () => {
  it.each(Object.entries({ seal, partition, raster, ratings, roundel }))('%s', (name, built) => {
    const src = readFileSync(join(root, 'src/kernels', `${name}.c`));
    expect(sha256(src), `src/kernels/${name}.c has changed: run npm run build:wasm`).toBe(built.SOURCE_SHA256);
    // and what is embedded is a WebAssembly module
    expect(Buffer.from(built.WASM_BASE64, 'base64').subarray(0, 4).toString('latin1')).toBe('\0asm');
  });
  it('clipper2 is the installed clipper2-wasm', () => {
    const pkg = join(root, 'node_modules/clipper2-wasm'),
      { version } = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')) as { version: string };
    expect(clipper2.VERSION, 'clipper2-wasm has changed: run npm run build:wasm').toBe(version);
    expect(
      sha256(Buffer.from(clipper2.WASM_BASE64, 'base64')),
      'clipper2-wasm has changed: run npm run build:wasm',
    ).toBe(sha256(readFileSync(join(pkg, 'dist/es/clipper2z.wasm'))));
  });
});
