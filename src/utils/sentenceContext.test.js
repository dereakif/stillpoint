import { describe, expect, test } from 'bun:test';
import { createDocumentModel } from './index';
import { getSentenceContext } from './sentenceContext';

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

  test('handles abbreviations using Intl sentence segmentation', () => {
    const context = contextForWord(
      'Dr. Smith arrived early. Everyone noticed.',
      'Smith'
    );

    expect(context.sentenceText).toBe('Dr. Smith arrived early.');
  });

  test('handles Unicode sentence punctuation', () => {
    const context = contextForWord(
      '最初の文です。 次の文です！',
      '次の文です！'
    );

    expect(context.sentenceText).toBe('次の文です！');
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

  test('returns null for missing tokens and empty documents', () => {
    expect(getSentenceContext(createDocumentModel(''), 0)).toBeNull();
    expect(getSentenceContext(createDocumentModel('one word'), -1)).toBeNull();
    expect(getSentenceContext(createDocumentModel('one word'), 99)).toBeNull();
  });
});
