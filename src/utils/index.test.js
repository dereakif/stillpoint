import { describe, expect, test } from 'bun:test';
import {
  computeORPIndex,
  computeWordDuration,
  createDocumentModel,
  createDocumentParagraphs,
  createRSVPPlayer,
  getParagraphTokenRange,
  getReadingPositionSummary,
  normalizeText,
  positionToTokenIndex,
  splitAtORP,
  tokenIndexToPosition,
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

describe('createDocumentParagraphs', () => {
  test('creates stable paragraph IDs and preserves content', () => {
    expect(
      createDocumentParagraphs(
        'First line.\r\nStill first!\r\n\r\n  Second paragraph?  '
      )
    ).toEqual([
      { id: 'paragraph-1', text: 'First line.\nStill first!' },
      { id: 'paragraph-2', text: 'Second paragraph?' },
    ]);
  });

  test('returns no paragraphs for blank text', () => {
    expect(createDocumentParagraphs('  \n\n  ')).toEqual([]);
  });
});

describe('createDocumentModel', () => {
  const source =
    '# Introduction\r\n\r\nA readable paragraph.\r\n\r\n> A quoted thought.\r\n\r\n- First item\r\n- Second item\r\n\r\n---';

  test('creates stable document, section, block, and token IDs', () => {
    const document = createDocumentModel(source, {
      id: 'document-reading-list',
      title: 'Reading list',
      revision: 3,
    });

    expect(document).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        id: 'document-reading-list',
        title: 'Reading list',
      })
    );
    expect(document.sections).toHaveLength(1);
    expect(document.sections[0].id).toBe('section-1');
    expect(document.sections[0].blockIds).toEqual([
      'paragraph-1',
      'paragraph-2',
      'paragraph-3',
      'paragraph-4',
      'paragraph-5',
    ]);
    expect(document.tokens[0]).toEqual(
      expect.objectContaining({
        id: 'token-1',
        sectionId: 'section-1',
        blockId: 'paragraph-1',
        tokenOffset: 0,
      })
    );
    expect(document.tokenToBlock['token-1']).toEqual({
      sectionId: 'section-1',
      blockId: 'paragraph-1',
      tokenOffset: 0,
    });
  });

  test('represents supported block shapes without changing source text', () => {
    const document = createDocumentModel(source);

    expect(document.source).toEqual(
      expect.objectContaining({
        text: source,
        format: 'markdown',
        revision: 1,
        rangeBasis: 'normalizedText',
      })
    );
    expect(document.sections[0].blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'list',
      'separator',
    ]);

    document.sections[0].blocks.forEach((block) => {
      expect(
        document.source.normalizedText.slice(
          block.source.start,
          block.source.end
        )
      ).toBe(block.sourceText);
    });
  });

  test('preserves IDs when the same document is reparsed', () => {
    const first = createDocumentModel(source, { id: 'document-7' });
    const reparsed = createDocumentModel(first.source.text, {
      id: first.id,
      revision: first.source.revision + 1,
    });

    expect(reparsed.id).toBe(first.id);
    expect(reparsed.sections.map((section) => section.id)).toEqual(
      first.sections.map((section) => section.id)
    );
    expect(reparsed.tokens.map((token) => token.id)).toEqual(
      first.tokens.map((token) => token.id)
    );
    expect(reparsed.source.revision).toBe(2);
  });

  test('creates sections from Markdown headings and plain chapter labels', () => {
    const document = createDocumentModel(
      '# Opening\n\nFirst text.\n\n## Details\n\nSecond text.\n\nChapter 3: Finale\n\nLast text.'
    );

    expect(document.sections.map((section) => section.title)).toEqual([
      'Opening',
      'Details',
      'Chapter 3: Finale',
    ]);
    expect(document.sections.map((section) => section.id)).toEqual([
      'section-1',
      'section-2',
      'section-3',
    ]);
    expect(document.sections[1].blocks[0]).toEqual(
      expect.objectContaining({
        type: 'heading',
        text: 'Details',
        headingLevel: 2,
        headingSyntax: 'markdown',
      })
    );
    expect(document.sections[2].blocks[0]).toEqual(
      expect.objectContaining({
        type: 'heading',
        headingSyntax: 'chapter-label',
      })
    );
  });

  test('keeps documents without headings in one untitled section', () => {
    const document = createDocumentModel(
      'A short standalone line\n\nA longer paragraph follows it.'
    );

    expect(document.sections).toHaveLength(1);
    expect(document.sections[0].title).toBeNull();
    expect(document.sections[0].blocks.map((block) => block.type)).toEqual([
      'paragraph',
      'paragraph',
    ]);
  });

  test('preserves URLs, punctuation, and Unicode in parsed text', () => {
    const document = createDocumentModel(
      '## Café — 東京\n\nVisit https://example.com/a/b; déjà vu?'
    );

    expect(document.sections[0].title).toBe('Café — 東京');
    expect(document.sections[0].blocks[1].text).toBe(
      'Visit https://example.com/a/b; déjà vu?'
    );
    expect(document.tokens.map((token) => token.text)).toContain(
      'https://example.com/a/b;'
    );
  });

  test('treats malformed and ambiguous heading-like lines as paragraphs', () => {
    const document = createDocumentModel(
      '#\n\n###\n\nChapter\n\nNot a heading'
    );

    expect(document.sections).toHaveLength(1);
    expect(document.sections[0].blocks.map((block) => block.type)).toEqual([
      'paragraph',
      'paragraph',
      'paragraph',
      'paragraph',
    ]);
  });

  test('excludes separators from RSVP tokens', () => {
    const document = createDocumentModel('Before.\n\n---\n\nAfter.');

    expect(document.tokens.map((token) => token.text)).toEqual([
      'Before.',
      'After.',
    ]);
  });
});

describe('getParagraphTokenRange', () => {
  test('locates a token without changing original whitespace', () => {
    expect(getParagraphTokenRange('alpha  beta\nstill', 1)).toEqual({
      start: 7,
      end: 11,
    });
  });

  test('locates slash-separated RSVP tokens in source text', () => {
    expect(getParagraphTokenRange('before/after now', 1)).toEqual({
      start: 7,
      end: 12,
    });
  });

  test('returns null for an invalid token offset', () => {
    expect(getParagraphTokenRange('alpha beta', 20)).toBeNull();
    expect(getParagraphTokenRange('alpha beta', -1)).toBeNull();
  });
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

  test('uses booleans consistently for every metadata field', () => {
    const [token] = tokenize('plain');

    expect(token).toEqual({
      text: 'plain',
      length: 5,
      isSlashPart: false,
      hasSlashAfter: false,
      hasEmDashAfter: false,
      isSentenceEnd: false,
      isCommaPause: false,
      isParagraphEnd: false,
      blockId: 'paragraph-1',
      tokenOffset: 0,
    });
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

describe('reading position conversion', () => {
  const tokens = tokenize('alpha beta\n\ngamma delta epsilon');

  test('converts a reading position to a flat token index', () => {
    expect(
      positionToTokenIndex(tokens, {
        blockId: 'paragraph-2',
        tokenOffset: 1,
      })
    ).toBe(3);
  });

  test('converts a flat token index to a reading position', () => {
    expect(tokenIndexToPosition(tokens, 4)).toEqual({
      blockId: 'paragraph-2',
      tokenOffset: 2,
    });
  });

  test('clamps invalid offsets and safely handles empty tokens', () => {
    expect(
      positionToTokenIndex(tokens, {
        blockId: 'paragraph-2',
        tokenOffset: 100,
      })
    ).toBe(4);
    expect(
      positionToTokenIndex(tokens, { blockId: 'missing', tokenOffset: 0 })
    ).toBe(0);
    expect(tokenIndexToPosition([], 0)).toBeNull();
  });
});

describe('getReadingPositionSummary', () => {
  test('reports paragraph, word, and document progress consistently', () => {
    expect(
      getReadingPositionSummary('one two\n\nthree four five', {
        blockId: 'paragraph-2',
        tokenOffset: 1,
      })
    ).toEqual({
      paragraphNumber: 2,
      paragraphCount: 2,
      wordNumber: 2,
      wordCount: 3,
      documentWordNumber: 4,
      documentWordCount: 5,
      progress: 4 / 5,
      percentage: 80,
    });
  });

  test('uses the first readable token for a missing position', () => {
    expect(getReadingPositionSummary('alpha beta', null)).toEqual(
      expect.objectContaining({
        paragraphNumber: 1,
        wordNumber: 1,
        documentWordNumber: 1,
        percentage: 50,
      })
    );
  });

  test('returns null when the document has no readable tokens', () => {
    expect(getReadingPositionSummary('  \n\n  ', null)).toBeNull();
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
  test('uses parsed document tokens without Markdown markers', () => {
    const document = createDocumentModel('# Heading\n\nReadable text.');
    const player = createRSVPPlayer(document);
    const words = [];

    player.subscribe('word', (token) => words.push(token.text));
    player.preview();
    player.skipForward(1);

    expect(words).toEqual(['Heading', 'Readable']);
    expect(player.getState().position).toEqual({
      blockId: 'paragraph-2',
      tokenOffset: 0,
      sectionId: 'section-1',
    });
  });

  test('pauses once at a chapter boundary and continues into the next chapter', async () => {
    const document = createDocumentModel('# One\n\nalpha\n\n# Two\n\nbeta');
    const player = createRSVPPlayer(document, { baseWpm: 800 });
    const words = [];
    let promptCount = 0;
    const boundaryReached = new Promise((resolve) => {
      player.subscribe('chapterComplete', (boundary) => {
        promptCount += 1;
        resolve(boundary);
      });
    });

    player.subscribe('word', (token) => words.push(token.text));
    player.play();
    const boundary = await boundaryReached;

    expect(words).toEqual(['One', 'alpha']);
    expect(player.isPlaying()).toBe(false);
    expect(boundary.completedChapter.title).toBe('One');
    expect(boundary.completedChapter.wordsRead).toBe(2);
    expect(boundary.completedChapter.wordCount).toBe(2);
    expect(boundary.nextChapter.title).toBe('Two');
    expect(boundary.nextPosition).toEqual({
      blockId: 'paragraph-3',
      tokenOffset: 0,
      sectionId: 'section-2',
    });
    expect(player.getPendingChapterBoundary()).toEqual(boundary);

    player.continueToNextChapter();
    expect(words).toEqual(['One', 'alpha', 'Two']);
    expect(player.getState().position).toEqual(boundary.nextPosition);
    expect(promptCount).toBe(1);
    player.pause();
  });

  test('does not prompt for a chapter restored as completed', async () => {
    const document = createDocumentModel('# One\n\nalpha\n\n# Two\n\nbeta');
    const player = createRSVPPlayer(document, {
      baseWpm: 800,
      completedChapterIds: ['section-1'],
    });
    let promptCount = 0;
    const completed = new Promise((resolve) => {
      player.subscribe('complete', resolve);
    });

    player.subscribe('chapterComplete', () => {
      promptCount += 1;
    });
    player.play();
    await completed;

    expect(promptCount).toBe(0);
    expect(player.getState().completedChapterIds).toEqual(['section-1']);
  });

  test('does not prompt twice after rewinding across a completed boundary', async () => {
    const document = createDocumentModel('# One\n\nalpha\n\n# Two\n\nbeta');
    const player = createRSVPPlayer(document, { baseWpm: 800 });
    let promptCount = 0;
    const firstBoundary = new Promise((resolve) => {
      player.subscribe('chapterComplete', (boundary) => {
        promptCount += 1;
        resolve(boundary);
      });
    });

    player.play();
    await firstBoundary;
    player.rewind(1);

    const completed = new Promise((resolve) => {
      player.subscribe('complete', resolve);
    });
    player.play();
    await completed;

    expect(promptCount).toBe(1);
  });

  test('reviews a completed chapter from its first readable token', async () => {
    const document = createDocumentModel('# One\n\nalpha\n\n# Two\n\nbeta');
    const player = createRSVPPlayer(document, { baseWpm: 800 });
    const boundaryReached = new Promise((resolve) => {
      player.subscribe('chapterComplete', resolve);
    });

    player.play();
    await boundaryReached;
    player.reviewCompletedChapter();

    expect(player.isPlaying()).toBe(false);
    expect(player.getPendingChapterBoundary()).toBeNull();
    expect(player.getState().position).toEqual({
      blockId: 'paragraph-2',
      tokenOffset: 0,
      sectionId: 'section-1',
    });
  });

  test('keeps direct navigation correct across chapter boundaries', async () => {
    const document = createDocumentModel('# One\n\nalpha\n\n# Two\n\nbeta');
    const player = createRSVPPlayer(document, { baseWpm: 800 });
    const boundaryReached = new Promise((resolve) => {
      player.subscribe('chapterComplete', resolve);
    });

    player.play();
    await boundaryReached;
    player.skipForward(5);
    expect(player.getState().position).toEqual({
      blockId: 'paragraph-4',
      tokenOffset: 0,
      sectionId: 'section-2',
    });
    expect(player.getPendingChapterBoundary()).toBeNull();

    player.rewind(100);
    expect(player.getState().position).toEqual({
      blockId: 'paragraph-1',
      tokenOffset: 0,
      sectionId: 'section-1',
    });
  });

  test('reports chapter and document progress separately', () => {
    const document = createDocumentModel('# One\n\nalpha\n\n# Two\n\nbeta');
    const player = createRSVPPlayer(document);
    const documentProgress = [];
    const chapterProgress = [];

    player.subscribe('progress', (progress) => documentProgress.push(progress));
    player.subscribe('chapterProgress', (chapter) =>
      chapterProgress.push(chapter.progress)
    );
    player.preview();
    player.skipForward(2);

    expect(documentProgress).toEqual([1 / 4, 3 / 4]);
    expect(chapterProgress).toEqual([1 / 2, 1 / 2]);
    expect(player.getChapterState()).toEqual({
      id: 'section-2',
      title: 'Two',
      number: 2,
      count: 2,
      progress: 1 / 2,
    });
  });

  test('plays tokens in order and reports progress and completion', async () => {
    const player = createRSVPPlayer('alpha beta gamma', { baseWpm: 800 });
    const words = [];
    const progress = [];
    const completed = new Promise((resolve) => {
      player.subscribe('complete', resolve);
    });

    player.subscribe('word', (token) => words.push(token.text));
    player.subscribe('progress', (value) => progress.push(value));

    player.play();
    expect(player.isPlaying()).toBe(true);
    expect(words).toEqual(['alpha']);

    await completed;

    expect(words).toEqual(['alpha', 'beta', 'gamma']);
    expect(progress).toEqual([1 / 3, 2 / 3, 1]);
    expect(player.isPlaying()).toBe(false);
  });

  test('starts from the beginning when played after completion', async () => {
    const player = createRSVPPlayer('alpha', { baseWpm: 800 });
    const words = [];
    const completed = new Promise((resolve) => {
      player.subscribe('complete', resolve);
    });

    player.subscribe('word', (token) => words.push(token.text));
    player.play();
    await completed;

    player.play();

    expect(words).toEqual(['alpha', 'alpha']);
    expect(player.isPlaying()).toBe(true);
    player.pause();
  });

  test('pauses playback and emits play-state changes', () => {
    const player = createRSVPPlayer('alpha beta');
    const states = [];

    player.subscribe('playStateChange', (playing) => states.push(playing));
    player.play();
    player.pause();

    expect(states).toEqual([true, false]);
    expect(player.isPlaying()).toBe(false);
  });

  test('reports each newly read token once for session activity', () => {
    const player = createRSVPPlayer('alpha beta');
    const wordsRead = [];

    player.subscribe('wordRead', (token) => wordsRead.push(token.text));
    player.play();
    player.setWpm(400);
    player.pause();
    player.play();

    expect(wordsRead).toEqual(['alpha']);
    player.pause();
  });

  test('redisplays the current token for its full duration after resume', () => {
    const player = createRSVPPlayer('alpha beta');
    const words = [];

    player.subscribe('word', (token) => words.push(token.text));
    player.play();
    player.pause();
    player.play();

    expect(words).toEqual(['alpha', 'alpha']);
    expect(player.isPlaying()).toBe(true);
    player.pause();
  });

  test('rewinds and skips within token boundaries', () => {
    const player = createRSVPPlayer('alpha beta gamma delta');
    const words = [];

    player.subscribe('word', (token) => words.push(token.text));
    player.preview();
    player.skipForward(2);
    player.rewind(1);
    player.rewind(100);
    player.skipForward(100);

    expect(words).toEqual(['alpha', 'gamma', 'beta', 'alpha', 'delta']);
  });

  test('reports displayed-token progress consistently during navigation', () => {
    const player = createRSVPPlayer('alpha beta gamma');
    const progress = [];

    player.subscribe('progress', (value) => progress.push(value));
    player.preview();
    player.skipForward(2);
    player.rewind(1);

    expect(progress).toEqual([1 / 3, 1, 2 / 3]);
  });

  test('starts at and reports shared reading positions', () => {
    const player = createRSVPPlayer('alpha beta\n\ngamma delta', {
      initialPosition: { blockId: 'paragraph-2', tokenOffset: 1 },
    });
    const words = [];
    const positions = [];

    player.subscribe('word', (token) => words.push(token.text));
    player.subscribe('positionChange', (position) => positions.push(position));
    player.preview();
    player.setPosition({ blockId: 'paragraph-1', tokenOffset: 1 });

    expect(words).toEqual(['delta', 'beta']);
    expect(positions).toEqual([
      { blockId: 'paragraph-2', tokenOffset: 1 },
      { blockId: 'paragraph-1', tokenOffset: 1 },
    ]);
  });

  test('supports explicit reset and restart commands', () => {
    const player = createRSVPPlayer('alpha beta');
    const words = [];

    player.subscribe('word', (token) => words.push(token.text));
    player.skipForward(1);
    player.reset();
    expect(player.isPlaying()).toBe(false);
    player.restart();

    expect(words).toEqual(['beta', 'alpha', 'alpha']);
    expect(player.isPlaying()).toBe(true);
    player.pause();
  });

  test('handles playback and navigation safely when no tokens exist', () => {
    const player = createRSVPPlayer('   ');
    const words = [];
    const progress = [];

    player.subscribe('word', (token) => words.push(token));
    player.subscribe('progress', (value) => progress.push(value));

    player.preview();
    player.play();
    player.rewind();
    player.skipForward();
    player.reset();
    player.restart();

    expect(words).toEqual([]);
    expect(progress).toEqual([]);
    expect(player.isPlaying()).toBe(false);
  });

  test('exposes immutable commands and a state snapshot', () => {
    const player = createRSVPPlayer('alpha beta', { baseWpm: 400 });

    expect(Object.isFrozen(player)).toBe(true);
    expect(player.getState()).toEqual({
      isPlaying: false,
      wpm: 400,
      currentIndex: 0,
      tokenCount: 2,
      progress: 0.5,
      position: { blockId: 'paragraph-1', tokenOffset: 0 },
      completedChapterIds: [],
    });

    player.skipForward(1);
    expect(player.getState()).toEqual({
      isPlaying: false,
      wpm: 400,
      currentIndex: 1,
      tokenCount: 2,
      progress: 1,
      position: { blockId: 'paragraph-1', tokenOffset: 1 },
      completedChapterIds: [],
    });

    player.loadText('');
    expect(player.getState()).toEqual({
      isPlaying: false,
      wpm: 400,
      currentIndex: null,
      tokenCount: 0,
      progress: 0,
      position: null,
      completedChapterIds: [],
    });
  });

  test('clamps WPM and reports changes', () => {
    const player = createRSVPPlayer('alpha');
    const changes = [];

    player.subscribe('wpmChange', (wpm) => changes.push(wpm));
    player.setWpm(50);
    expect(player.getWpm()).toBe(100);
    player.setWpm(900);
    expect(player.getWpm()).toBe(800);
    expect(changes).toEqual([100, 800]);
  });

  test('redisplays the current token when WPM changes during playback', () => {
    const player = createRSVPPlayer('alpha beta');
    const words = [];

    player.subscribe('word', (token) => words.push(token.text));
    player.play();
    player.setWpm(400);

    expect(words).toEqual(['alpha', 'alpha']);
    expect(player.getWpm()).toBe(400);
    expect(player.isPlaying()).toBe(true);
    player.pause();
  });

  test('supports multiple listeners and independent unsubscription', () => {
    const player = createRSVPPlayer('alpha beta');
    const firstListenerWords = [];
    const secondListenerWords = [];
    const unsubscribeFirst = player.subscribe('word', (token) =>
      firstListenerWords.push(token.text)
    );
    const unsubscribeSecond = player.subscribe('word', (token) =>
      secondListenerWords.push(token.text)
    );

    player.preview();
    expect(unsubscribeFirst()).toBe(true);
    expect(unsubscribeFirst()).toBe(false);
    player.skipForward(1);
    unsubscribeSecond();
    player.rewind(1);

    expect(firstListenerWords).toEqual(['alpha']);
    expect(secondListenerWords).toEqual(['alpha', 'beta']);
  });

  test('rejects unknown events and non-function listeners', () => {
    const player = createRSVPPlayer('alpha');

    expect(() => player.subscribe('unknown', () => {})).toThrow(
      'Unknown RSVP player event: unknown'
    );
    expect(() => player.subscribe('word', null)).toThrow(
      'RSVP player listener must be a function'
    );
  });

  test('loads replacement text at the beginning and pauses playback', () => {
    const player = createRSVPPlayer('old text');
    const words = [];

    player.subscribe('word', (token) => words.push(token.text));
    player.play();
    player.loadText('new content');
    player.preview();

    expect(player.isPlaying()).toBe(false);
    expect(words).toEqual(['old', 'new']);
  });
});
