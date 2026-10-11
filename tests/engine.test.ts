import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { alphabet, compose, setOverrides } from '../src/engine';
import type { ComposeOptions } from '../src/engine';
import { serialize } from './golden/harness.mjs';

const dir = join(import.meta.dirname, 'golden/engine');
const files = readdirSync(dir).filter(f => f.endsWith('.json'));

// The golden cases were recorded with no glyph edits.
beforeAll(() => setOverrides({}));

describe('engine reproduces the golden compose()/alphabet() output', () => {
  it.each(files)('%s', f => {
    const expected = readFileSync(join(dir, f), 'utf8');
    const { fn, args } = JSON.parse(expected);
    const output = fn === 'compose' ? compose(args[0] as ComposeOptions) : alphabet(args[0], args[1]);
    expect(JSON.stringify({ fn, args, output: serialize(output) }) + '\n' === expected).toBe(true);
  });
});
