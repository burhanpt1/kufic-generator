import { describe, expect, it } from 'vitest';
import { abjad, uniqueLetters } from '../src/abjad';

describe('abjad()', () => {
  it('is 786 for the basmala, with or without vowels', () => {
    expect(abjad('بسم الله الرحمن الرحيم')).toBe(786);
    expect(abjad('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ')).toBe(786);
  });
  it('is 165 for لا اله الا الله', () => {
    expect(abjad('لا اله الا الله')).toBe(165);
  });
  it('counts ة as 5 and ignores non-letters', () => {
    expect(abjad('ة')).toBe(5);
    expect(abjad('abc 123 ،')).toBe(0);
  });
  it('gives the thousands letter غ 1000', () => {
    expect(abjad('غ')).toBe(1000);
  });
});

describe('uniqueLetters()', () => {
  it('lists distinct letters in order of first appearance, normalising alif and hamza seats', () => {
    expect(uniqueLetters('يا علي')).toBe('ي ا ع ل');
    expect(uniqueLetters('أإآٱا')).toBe('ا');
    expect(uniqueLetters('ـبـ')).toBe('ب');
  });
});
