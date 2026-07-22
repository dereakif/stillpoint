import { describe, expect, test } from 'bun:test';
import { findWordAtOffset } from './wordSelection';

describe('findWordAtOffset', () => {
  test('finds a plain word at the clicked character', () => {
    expect(findWordAtOffset('Call me Ishmael.', 9, 'en')).toEqual({
      start: 8,
      end: 15,
      text: 'Ishmael',
    });
  });

  test('keeps contractions and hyphenated compounds together', () => {
    expect(findWordAtOffset("don't stop", 3, 'en')?.text).toBe("don't");
    expect(findWordAtOffset('well-known whale', 6, 'en')?.text).toBe(
      'well-known'
    );
  });

  test('supports Unicode words and combining marks', () => {
    expect(findWordAtOffset('naïve café 東京', 2, 'en')?.text).toBe('naïve');
    expect(findWordAtOffset('naïve café 東京', 12, 'ja')?.text).toBe('東京');
  });

  test('returns null for whitespace and unrelated punctuation', () => {
    expect(findWordAtOffset('one two', 3, 'en')).toBeNull();
    expect(findWordAtOffset('one, two', 3, 'en')).toBeNull();
  });

  test('clamps offsets to the available text', () => {
    expect(findWordAtOffset('word', -20, 'en')?.text).toBe('word');
    expect(findWordAtOffset('word', 200, 'en')?.text).toBe('word');
  });

  test('uses the Unicode-aware fallback without Intl.Segmenter', () => {
    const originalSegmenter = Intl.Segmenter;
    Object.defineProperty(Intl, 'Segmenter', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(findWordAtOffset('co-operate déjà', 4)?.text).toBe('co-operate');
      expect(findWordAtOffset('co-operate déjà', 13)?.text).toBe('déjà');
    } finally {
      Object.defineProperty(Intl, 'Segmenter', {
        configurable: true,
        value: originalSegmenter,
      });
    }
  });
});
