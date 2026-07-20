import { describe, expect, test } from 'bun:test';
import { createDocumentModel } from './index';
import {
  getSentenceContext,
  getSentenceNavigationTarget,
  getSentenceTokenRanges,
} from './sentenceContext';

const contextForWord = (source, word, occurrence = 0, options) => {
  const documentModel = createDocumentModel(source);
  const matchingIndices = documentModel.tokens
    .map((token, index) => (token.text === word ? index : -1))
    .filter((index) => index !== -1);
  return getSentenceContext(
    documentModel,
    matchingIndices[occurrence],
    options
  );
};

describe('getSentenceContext', () => {
  test('returns the sentence and exact range for a repeated current word', () => {
    const context = contextForWord('Echo now. Echo later.', 'Echo', 1);

    expect(context.sentenceText).toBe('Echo later.');
    expect(
      context.sentenceText.slice(
        context.highlightRange.start,
        context.highlightRange.end
      )
    ).toBe('Echo');
  });

  test('preserves closing punctuation and trims segment whitespace', () => {
    const context = contextForWord(
      'She said, “Stay here.”   Then she left.',
      'Then'
    );

    expect(context.sentenceText).toBe('Then she left.');
    expect(context.highlightRange).toEqual({ start: 0, end: 4 });
  });

  test('does not treat soft paragraph line wraps as sentence boundaries', () => {
    const documentModel = createDocumentModel(
      'Each section will be better understood and\nmake much more sense after reading the other sections. That could not\nbe helped.'
    );
    const ranges = getSentenceTokenRanges(documentModel);

    expect(
      ranges.map(({ sentenceText }) => sentenceText.replace(/\s+/g, ' '))
    ).toEqual([
      'Each section will be better understood and make much more sense after reading the other sections.',
      'That could not be helped.',
    ]);
    expect(getSentenceNavigationTarget(ranges, 0, 'next')).toBe(16);
    expect(getSentenceNavigationTarget(ranges, 16, 'next')).toBe(16);
  });

  test('recognizes punctuation boundaries before lowercase sentence starts', () => {
    const documentModel = createDocumentModel(
      'first sentence ends. next sentence starts.'
    );

    expect(
      getSentenceTokenRanges(documentModel).map(
        ({ sentenceText }) => sentenceText
      )
    ).toEqual(['first sentence ends.', 'next sentence starts.']);
  });

  test('handles abbreviations using Intl sentence segmentation', () => {
    const context = contextForWord(
      'Dr. Smith arrived early. Everyone noticed.',
      'Smith'
    );

    expect(context.sentenceText).toBe('Dr. Smith arrived early.');
  });

  test('handles Unicode sentence punctuation', () => {
    const context = contextForWord(
      '\u6700\u521d\u306e\u6587\u3067\u3059\u3002 \u6b21\u306e\u6587\u3067\u3059\uff01',
      '\u6b21\u306e\u6587\u3067\u3059\uff01'
    );

    expect(context.sentenceText).toBe('\u6b21\u306e\u6587\u3067\u3059\uff01');
  });

  test('uses token sentence boundaries when Intl.Segmenter is unavailable', () => {
    const context = contextForWord(
      'First sentence. Second sentence continues',
      'Second',
      0,
      { segmenter: null }
    );

    expect(context.sentenceText).toBe('Second sentence continues');
  });

  test('maps slash-split tokens to their exact display occurrence', () => {
    const context = contextForWord('Choose before/after carefully.', 'after');

    expect(
      context.sentenceText.slice(
        context.highlightRange.start,
        context.highlightRange.end
      )
    ).toBe('after');
  });

  test('uses logical block text without Markdown markers', () => {
    const context = contextForWord(
      '> Quoted context stays readable.',
      'context'
    );

    expect(context.sentenceText).toBe('Quoted context stays readable.');
  });

  test('returns sentence token ranges in document order across blocks', () => {
    const documentModel = createDocumentModel(
      'First sentence. Second sentence.\n\nThird sentence.'
    );
    const ranges = getSentenceTokenRanges(documentModel);

    expect(
      ranges.map(({ startTokenIndex, endTokenIndex, sentenceText }) => ({
        startTokenIndex,
        endTokenIndex,
        sentenceText,
      }))
    ).toEqual([
      { startTokenIndex: 0, endTokenIndex: 1, sentenceText: 'First sentence.' },
      {
        startTokenIndex: 2,
        endTokenIndex: 3,
        sentenceText: 'Second sentence.',
      },
      { startTokenIndex: 4, endTokenIndex: 5, sentenceText: 'Third sentence.' },
    ]);
  });

  test('navigates backward to the current start before the previous sentence', () => {
    const ranges = getSentenceTokenRanges(
      createDocumentModel('First sentence. Second sentence here.')
    );

    expect(getSentenceNavigationTarget(ranges, 4, 'previous')).toBe(2);
    expect(getSentenceNavigationTarget(ranges, 2, 'previous')).toBe(0);
    expect(getSentenceNavigationTarget(ranges, 0, 'previous')).toBe(0);
  });

  test('navigates forward to the next sentence and stops at the final one', () => {
    const ranges = getSentenceTokenRanges(
      createDocumentModel('First sentence. Second sentence here.')
    );

    expect(getSentenceNavigationTarget(ranges, 0, 'next')).toBe(2);
    expect(getSentenceNavigationTarget(ranges, 3, 'next')).toBe(3);
  });

  test('returns null for missing tokens and empty documents', () => {
    expect(getSentenceContext(createDocumentModel(''), 0)).toBeNull();
    expect(getSentenceContext(createDocumentModel('one word'), -1)).toBeNull();
    expect(getSentenceContext(createDocumentModel('one word'), 99)).toBeNull();
  });
});
