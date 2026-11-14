// What the studio tells the user about stored favourites it had to leave out.
import { describe, expect, it } from 'vitest';
import { skippedNote } from '../src/studio/storage';

describe('skipped favourites note', () => {
  it('says nothing when every favourite was read', () => expect(skippedNote([])).toBe(''));
  it('names the ones left as they are', () => {
    expect(skippedNote(['Seal'])).toBe('1 saved favourite couldn’t be read and was left as it is: “Seal”.');
    expect(skippedNote(['a', 'b'])).toBe('2 saved favourites couldn’t be read and were left as they are: “a”, “b”.');
  });
  it('names six at most', () => {
    const note = skippedNote(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(note).toContain('8 saved favourites');
    expect(note.endsWith('“f” and 2 more.')).toBe(true);
  });
});
