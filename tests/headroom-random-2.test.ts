// Headroom check on 50 random evolvable compositions (batch 2 of 4: 200 in all, split so they run in parallel).
import { expect, it } from 'vitest';
import { randomBatchViolations } from './helpers/clearance';

it('keeps letters half a cell from separators and the outline', async () => {
  expect(await randomBatchViolations(1002, 50)).toEqual([]);
}, 300000);
