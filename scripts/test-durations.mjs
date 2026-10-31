// Times every test file and writes tests/durations.json, which the test sequencer (tests/sequencer.ts) uses to start
// the slowest files first. Run after adding or reshaping tests:   npm run test:durations
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  out = join(mkdtempSync(join(tmpdir(), 'durations-')), 'results.json');
try {
  execFileSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${out}`], { cwd: root, stdio: 'inherit' });
} catch {
  // failing tests still have timings
}
const { testResults } = JSON.parse(readFileSync(out, 'utf8')),
  durations = Object.fromEntries(
    testResults
      .map(t => [relative(root, t.name).replaceAll('\\', '/'), +((t.endTime - t.startTime) / 1000).toFixed(1)])
      .sort((a, b) => b[1] - a[1]),
  );
writeFileSync(join(root, 'tests/durations.json'), JSON.stringify(durations, null, 2) + '\n');
console.log(`tests/durations.json: ${Object.keys(durations).length} files`);
