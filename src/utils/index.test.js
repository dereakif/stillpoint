import { describe, expect, test } from 'bun:test';
import {
  computeORPIndex,
  computeWordDuration,
  createRSVPPlayer,
  normalizeText,
  splitAtORP,
  tokenize,
} from './index';

const createToken = (overrides = {}) => ({
  text: 'word',
  length: 4,
  isSlashPart: false,
  hasSlashAfter: false,
  hasEmDashAfter: false,
  isSentenceEnd: false,
  isCommaPause: false,
  isParagraphEnd: false,
  ...overrides,
});

describe('normalizeText', () => {
  test('normalizes whitespace and dash variants while preserving paragraphs', () => {
    expect(
      normalizeText('  First\t\tline – here.  \n\n\n\n  Second — line.  ')
    ).toBe('First line — here.\n\nSecond — line.');
  });
});

describe('tokenize', () => {
  test('returns no tokens for blank text', () => {
    expect(tokenize('   \n\n  ')).toEqual([]);
  });

  test('keeps prefix words as separate tokens', () => {
    expect(tokenize('an entity').map((token) => token.text)).toEqual([
      'an',
      'entity',
    ]);
  });

  test('preserves punctuation and paragraph metadata', () => {
    const tokens = tokenize('the end.\n\nNext part, now.');

    expect(tokens[1]).toEqual(
      expect.objectContaining({
        text: 'end.',
        isSentenceEnd: true,
        isParagraphEnd: true,
      })
    );
    expect(tokens[3]).toEqual(
      expect.objectContaining({ text: 'part,', isCommaPause: true })
    );
    expect(tokens.at(-1)).toEqual(
      expect.objectContaining({ text: 'now.', isSentenceEnd: true })
    );
  });

  test('attaches an em dash to the preceding readable token', () => {
    expect(tokenize('alpha—beta')).toEqual([
      expect.objectContaining({ text: 'alpha', hasEmDashAfter: true }),
      expect.objectContaining({ text: 'beta', hasEmDashAfter: false }),
    ]);
  });

  test('splits slash-separated text but preserves URLs', () => {
    const tokens = tokenize('before/after https://example.com/a/b');

    expect(tokens).toEqual([
      expect.objectContaining({
        text: 'before',
        isSlashPart: true,
        hasSlashAfter: true,
      }),
      expect.objectContaining({
        text: 'after',
        isSlashPart: true,
        hasSlashAfter: false,
      }),
      expect.objectContaining({
        text: 'https://example.com/a/b',
        isSlashPart: false,
      }),
    ]);
  });
});

describe('ORP calculation', () => {
  test.each([
    ['', 0],
    ['a', 0],
    ['word', 1],
    ['reading', 2],
    ['recognition', 3],
    ['extraordinarilylong', 4],
  ])('computes the ORP index for %j', (word, expectedIndex) => {
    expect(computeORPIndex(word)).toBe(expectedIndex);
  });

  test('splits a word around its ORP character', () => {
    expect(splitAtORP('reading')).toEqual({
      before: 're',
      pivot: 'a',
      after: 'ding',
    });
  });
});

describe('computeWordDuration', () => {
  test('uses WPM as the base token duration', () => {
    expect(computeWordDuration(createToken(), 300)).toBe(200);
  });

  test('shortens common function words', () => {
    expect(
      computeWordDuration(createToken({ text: 'the', length: 3 }), 300)
    ).toBe(150);
  });

  test('extends long words', () => {
    expect(
      computeWordDuration(createToken({ text: 'reading', length: 7 }), 300)
    ).toBe(270);
  });

  test('gives exceptionally long words additional recognition time', () => {
    expect(
      computeWordDuration(
        createToken({ text: 'antidisestablishmentarianism', length: 28 }),
        300
      )
    ).toBe(820);
  });

  test.each([
    ['comma', { isCommaPause: true }, 360],
    ['sentence', { isSentenceEnd: true }, 520],
    ['paragraph', { isParagraphEnd: true }, 640],
    ['slash', { hasSlashAfter: true }, 250],
    ['em dash', { hasEmDashAfter: true }, 400],
  ])('applies the %s pause multiplier', (_name, metadata, expectedDuration) => {
    expect(computeWordDuration(createToken(metadata), 300)).toBe(
      expectedDuration
    );
  });

  test('respects the configured minimum duration', () => {
    expect(computeWordDuration(createToken(), 10000)).toBe(60);
  });
});

describe('createRSVPPlayer', () => {
  test('plays tokens in order and reports progress and completion', async () => {
    const player = createRSVPPlayer('alpha beta gamma', { baseWpm: 800 });
    const words = [];
    const progress = [];
    const completed = new Promise((resolve) => {
      player.onComplete = resolve;
    });

    player.onWord = (token) => words.push(token.text);
    player.onProgress = (value) => progress.push(value);

    player.play();
    expect(player.isPlaying()).toBe(true);
    expect(words).toEqual(['alpha']);

    await completed;

    expect(words).toEqual(['alpha', 'beta', 'gamma']);
    expect(progress).toEqual([1 / 3, 2 / 3, 1]);
    expect(player.isPlaying()).toBe(false);
  });

  test('pauses playback and emits play-state changes', () => {
    const player = createRSVPPlayer('alpha beta');
    const states = [];

    player.onPlayStateChange = (playing) => states.push(playing);
    player.play();
    player.pause();

    expect(states).toEqual([true, false]);
    expect(player.isPlaying()).toBe(false);
  });

  test('rewinds and skips within token boundaries', () => {
    const player = createRSVPPlayer('alpha beta gamma delta');
    const words = [];

    player.onWord = (token) => words.push(token.text);
    player.preview();
    player.skipForward(2);
    player.rewind(1);
    player.rewind(100);
    player.skipForward(100);

    expect(words).toEqual(['alpha', 'gamma', 'beta', 'alpha', 'delta']);
  });

  test('clamps WPM and reports changes', () => {
    const player = createRSVPPlayer('alpha');
    const changes = [];

    player.onChangeWpm = (wpm) => changes.push(wpm);
    player.setWpm(50);
    expect(player.getWpm()).toBe(100);
    player.setWpm(900);
    expect(player.getWpm()).toBe(800);
    expect(changes).toEqual([100, 800]);
  });

  test('loads replacement text at the beginning and pauses playback', () => {
    const player = createRSVPPlayer('old text');
    const words = [];

    player.onWord = (token) => words.push(token.text);
    player.play();
    player.loadText('new content');
    player.preview();

    expect(player.isPlaying()).toBe(false);
    expect(words).toEqual(['old', 'new']);
  });
});
