import { describe, expect, test } from 'bun:test';
import { positionToTokenIndex } from '../utils';
import { createSessionFromTokenEntries } from './boundedSession';

describe('createSessionFromTokenEntries', () => {
  test('creates a bounded RSVP document at the clicked token', () => {
    const session = createSessionFromTokenEntries(
      [
        { text: 'before', start: 0, end: 6, cfiRange: 'epubcfi(before)' },
        { text: 'clicked,', start: 8, end: 16, cfiRange: 'epubcfi(clicked)' },
        { text: 'after', start: 18, end: 23, cfiRange: 'epubcfi(after)' },
      ],
      1,
      10,
      {
        title: 'Chapter One',
        sectionHref: 'chapter.xhtml',
        sourceCfi: 'epubcfi(source)',
      }
    );

    expect(session.document.source.text).toBe('before clicked, after');
    expect(session.document.tokens.map((token) => token.text)).toEqual([
      'before',
      'clicked,',
      'after',
    ]);
    expect(
      positionToTokenIndex(session.document.tokens, session.initialPosition)
    ).toBe(1);
    expect(session.tokenCfis).toEqual([
      'epubcfi(before)',
      'epubcfi(clicked)',
      'epubcfi(after)',
    ]);
    expect(session.sectionHref).toBe('chapter.xhtml');
  });

  test('maps split RSVP tokens back to their source CFI', () => {
    const session = createSessionFromTokenEntries(
      [
        {
          text: 'one/two',
          start: 0,
          end: 7,
          cfiRange: 'epubcfi(compound)',
        },
      ],
      0,
      5
    );

    expect(session.document.tokens.map((token) => token.text)).toEqual([
      'one',
      'two',
    ]);
    expect(session.tokenCfis).toEqual([
      'epubcfi(compound)',
      'epubcfi(compound)',
    ]);
    expect(
      positionToTokenIndex(session.document.tokens, session.initialPosition)
    ).toBe(1);
  });

  test('returns null without readable entries', () => {
    expect(createSessionFromTokenEntries([], -1, 0)).toBeNull();
  });
});
