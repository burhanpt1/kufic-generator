// Runs the slowest test files first, so the long ones start at once and the short ones fill in around them (on a fresh
// checkout, as in CI, vitest has no timings of its own and would order by file size). Durations are seconds from a
// recent run (`npm run test:durations` refreshes them); a file not listed counts as middling.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { BaseSequencer } from 'vitest/node';

/** @type {Record<string, number>} */
const durations = JSON.parse(readFileSync(new URL('./durations.json', import.meta.url), 'utf8'));

export default class SlowestFirst extends BaseSequencer {
  /** @param {import('vitest/node').TestSpecification[]} files */
  async sort(files) {
    const root = this.ctx.config.root,
      /** @param {import('vitest/node').TestSpecification} f */
      d = f => durations[relative(root, f.moduleId).replaceAll('\\', '/')] ?? 5;
    return [...files].sort((a, b) => d(b) - d(a));
  }
}
