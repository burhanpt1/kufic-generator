// @vitest-environment jsdom
// Drives the real UI (index.html markup + src/ui) through every golden case and checks it produces the same SVG,
// engine call, render call and status line as recorded in tests/golden/ (originally captured from the prototype).
// UPDATE_GOLDEN=1 (npm run golden) rewrites the snapshots instead, for intentional output changes.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { start } from '../src/ui/app';
import { CASES } from './golden/cases.mjs';
import { applyUI, serialize } from './golden/harness.mjs';

const root = join(import.meta.dirname, '..'),
  dir = join(root, 'tests/golden');
const update = !!process.env.UPDATE_GOLDEN;
const golden = (rel: string) => readFileSync(join(dir, rel), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));

interface Entry {
  id: string;
  ui: Record<string, unknown>;
  engine: string | null;
  render: unknown;
  meta: string;
  warn: string;
}
const recorded: Entry[] = [];
const manifest = update
  ? new Map<string, Entry>()
  : new Map((JSON.parse(golden('manifest.json')) as Entry[]).map(c => [c.id, c]));

if (update) {
  for (const d of ['svg', 'engine']) {
    rmSync(join(dir, d), { recursive: true, force: true });
    mkdirSync(join(dir, d));
  }
  afterAll(() => writeFileSync(join(dir, 'manifest.json'), JSON.stringify(recorded, null, 1) + '\n'));
}

describe('UI reproduces the golden cases', () => {
  it.each(CASES.map(c => [c.id, c] as const))('%s', (id, c) => {
    localStorage.clear();
    document.body.innerHTML = body;
    const app = start(document);
    applyUI({ window } as never, c.ui);
    app.render();
    const { last } = app;
    const svg = last.svg + '\n';
    const engine = last.engine && JSON.stringify({ ...last.engine, output: serialize(last.engine.output) }) + '\n';
    const render = JSON.parse(JSON.stringify(last.render));
    const meta = document.getElementById('meta')!.textContent!,
      warn = document.getElementById('warn')!.textContent!;
    if (update) {
      writeFileSync(join(dir, `svg/${id}.svg`), svg);
      if (engine) writeFileSync(join(dir, `engine/${id}.json`), engine);
      recorded.push({ id, ui: c.ui, engine: last.engine && last.engine.fn, render, meta, warn });
      return;
    }
    const m = manifest.get(id)!;
    expect(svg === golden(`svg/${id}.svg`), 'SVG differs').toBe(true);
    if (engine) expect(engine === golden(`engine/${id}.json`), 'engine output differs').toBe(true);
    expect(render).toEqual(m.render);
    expect(meta).toBe(m.meta);
    expect(warn).toBe(m.warn);
    expect(document.getElementById('art')!.innerHTML).toContain('<svg');
  });
});
