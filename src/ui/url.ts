// Compositions as shareable links: the settings that differ from the defaults, as JSON, deflated and base64url'd
// into the URL fragment (#s=...). The fragment never reaches a server.
import type { Settings } from './settings';

const PREFIX = '#s=';

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const writer = stream.writable.getWriter();
  writer.write(bytes as BufferSource).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader(),
    chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
const toB64url = (b: Uint8Array) => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

export async function encodeSettings(s: Settings): Promise<string> {
  return toB64url(await pipe(new TextEncoder().encode(JSON.stringify(s)), new CompressionStream('deflate-raw')));
}
/** null if the string isn't a valid encoding. */
export async function decodeSettings(code: string): Promise<Settings | null> {
  try {
    const json = new TextDecoder().decode(await pipe(fromB64url(code), new DecompressionStream('deflate-raw')));
    const s = JSON.parse(json);
    return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
  } catch {
    return null;
  }
}

export const hashToCode = (hash: string) => (hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null);
export const codeToHash = (code: string) => (code ? PREFIX + code : '');
