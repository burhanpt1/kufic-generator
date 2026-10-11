// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { start } from '../src/ui/app';
import { decodeSettings, encodeSettings } from '../src/ui/url';
import { applyUI } from './golden/harness.mjs';

const html = readFileSync(join(import.meta.dirname, '../index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
async function open(hash = '') {
  history.replaceState(null, '', '/' + hash);
  document.body.innerHTML = body;
  const app = start(document);
  await app.ready;
  return app;
}
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
};

beforeEach(() => localStorage.clear());

describe('settings encoding', () => {
  it('round-trips, including Arabic text and newlines', async () => {
    const s = {
      text: 'بسم الله\nمحمد',
      layout: 'circle',
      palette: 3,
      grid: true,
      glyphs: { 'BEH.iso': ['#.#', '###'] },
    };
    const code = await encodeSettings(s);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeSettings(code)).toEqual(s);
  });
  it('returns null for anything that is not an encoding', async () => {
    expect(await decodeSettings('not base64 !!')).toBeNull();
    expect(await decodeSettings('AAAA')).toBeNull();
    expect(await decodeSettings(await encodeSettings([1, 2] as never))).toBeNull();
  });
});

describe('state in the URL', () => {
  it('leaves the URL bare at the defaults', async () => {
    const app = await open();
    app.render();
    await settle();
    expect(location.hash).toBe('');
  });

  it('writes a link that reopens to the same composition', async () => {
    let app = await open();
    applyUI({ window } as never, { preset: 'fatimid', text: 'يا علي مدد', rings: 2, palette: 4, grid: true });
    await vi.waitFor(() => expect(location.hash).toMatch(/^#s=/));
    await settle();
    const hash = location.hash,
      svg = app.last.svg,
      settings = app.settings();
    expect(hash.length).toBeLessThan(300);

    app = await open(hash);
    expect(app.settings()).toEqual(settings);
    expect(app.last.svg).toBe(svg);
    expect((document.getElementById('text') as HTMLTextAreaElement).value).toBe('يا علي مدد');
    expect(document.querySelector('#layout [aria-pressed="true"]')!.getAttribute('data-v')).toBe('circle');
  });

  it('carries letter edits with the link', async () => {
    localStorage.setItem('kufi-glyphs', JSON.stringify({ 'DAL.iso': ['###', '#.#', '###'] }));
    let app = await open();
    await settle();
    const hash = location.hash,
      svg = app.last.svg;
    expect(hash).toMatch(/^#s=/);
    localStorage.clear();
    app = await open(hash);
    expect(app.state.ovr).toEqual({ 'DAL.iso': ['###', '#.#', '###'] });
    expect(app.last.svg).toBe(svg);
  });

  it('ignores invalid values and broken links', async () => {
    const code = await encodeSettings({ layout: 'spiral', palette: 99, rot: 45, center: 'letters' });
    const app = await open('#s=' + code);
    expect(app.state.layout).toBe('rings');
    expect(app.state.palette).toBe(0);
    expect(app.state.rotation).toBe(0);
    expect(app.state.center).toBe('letters');
    const fresh = await open('#s=garbage');
    expect(fresh.state.layout).toBe('rings');
  });
});
