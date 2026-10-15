// ع (owner's review of the held-out seals): the stemmed design in every form by default; the open medial U read as س.
import { describe, expect, it } from 'vitest';
import { getRows } from '../src/glyphs/overrides';
import { DEFAULT_STYLE } from '../src/model/style';

describe('ع', () => {
  it('is stemmed by default', () => expect(DEFAULT_STYLE.letter.ayn).toBe('cup'));
  it.each(['ini', 'med'] as const)('has a stem in its %s form', form =>
    expect(getRows('AIN', form, { ayn: DEFAULT_STYLE.letter.ayn })).toEqual(['#.#', '###', '.#.', '.#.', '###']),
  );
  it('keeps the open design as an option', () =>
    expect(getRows('AIN', 'med', { ayn: 'open' })).toEqual(['#.#', '#.#', '###']));
});
