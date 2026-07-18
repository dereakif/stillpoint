/**
 * @typedef {object} RSVPToken
 * @property {string} text
 * @property {number} length
 * @property {boolean} isSlashPart
 * @property {boolean} hasSlashAfter
 * @property {boolean} hasEmDashAfter
 * @property {boolean} isSentenceEnd
 * @property {boolean} isCommaPause
 * @property {boolean} isParagraphEnd
 * @property {string} blockId
 * @property {number} tokenOffset
 * @property {string} [id]
 * @property {string} [sectionId]
 * @property {'heading' | 'paragraph' | 'quote' | 'list' | 'separator'} [blockType]
 * @property {{ start: number, end: number } | null} [source]
 */

/**
 * @typedef {object} ReadingPosition
 * @property {string} blockId
 * @property {number} tokenOffset
 */

/**
 * @typedef {'word' | 'progress' | 'positionChange' | 'complete' | 'playStateChange' | 'wpmChange'} RSVPPlayerEvent
 */

/**
 * @typedef {object} RSVPPlayerState
 * @property {boolean} isPlaying
 * @property {number} wpm
 * @property {number | null} currentIndex
 * @property {number} tokenCount
 * @property {number} progress
 * @property {ReadingPosition | null} position
 */

const FUNCTION_WORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'to',
  'in',
  'on',
  'and',
  'or',
  'is',
  'it',
  'for',
  'at',
  'by',
  'as',
  'be',
  'was',
  'are',
  'that',
  'this',
]);

export const computeORPIndex = (word) => {
  const len = word.length;
  if (len === 0) return 0;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return Math.min(4, Math.floor(len * 0.45));
};

export const splitAtORP = (word) => {
  const idx = computeORPIndex(word);
  return {
    before: word.slice(0, idx),
    pivot: word.slice(idx, idx + 1),
    after: word.slice(idx + 1),
  };
};

const isUrl = (value) => /^https?:\/\//i.test(value);

const splitWordToken = (word) => {
  if (isUrl(word) || !word.includes('/')) {
    return [{ text: word, isSlashPart: false }];
  }

  return word
    .split('/')
    .filter(Boolean)
    .map((part, index, parts) => ({
      text: part,
      isSlashPart: true,
      hasSlashAfter: index < parts.length - 1,
    }));
};

/**
 * Creates deterministic paragraph IDs while preserving punctuation and
 * intentional line breaks within each paragraph.
 *
 * @param {string} rawText
 * @returns {{ id: string, text: string }[]}
 */
export const createDocumentParagraphs = (rawText) =>
  rawText
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: `paragraph-${index + 1}`, text }));

/**
 * Locates an RSVP token within its original paragraph text so navigation mode
 * can highlight it without changing the document's whitespace or punctuation.
 *
 * @param {string} paragraphText
 * @param {number} tokenOffset
 * @returns {{ start: number, end: number } | null}
 */
export const getParagraphTokenRange = (paragraphText, tokenOffset) => {
  if (!Number.isInteger(tokenOffset) || tokenOffset < 0) return null;

  const tokens = tokenize(paragraphText);
  if (tokenOffset >= tokens.length) return null;

  let searchFrom = 0;

  for (let index = 0; index <= tokenOffset; index += 1) {
    const tokenText = tokens[index].text;
    const start = paragraphText.indexOf(tokenText, searchFrom);
    if (start === -1) return null;

    const end = start + tokenText.length;
    if (index === tokenOffset) return { start, end };
    searchFrom = end;
  }

  return null;
};

export const normalizeText = (rawText) => {
  return (
    rawText
      // Normalize different dash characters.
      .replace(/[–—]/g, ' — ')

      // Remove spaces around line breaks without destroying paragraphs.
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')

      // Collapse repeated spaces and tabs.
      .replace(/[ \t]{2,}/g, ' ')

      // Preserve paragraph breaks but remove excessive blank lines.
      .replace(/\n{3,}/g, '\n\n')

      .trim()
  );
};

/**
 * @param {string} rawText
 * @returns {RSVPToken[]}
 */
export const tokenize = (rawText) => {
  const normalizedText = normalizeText(rawText);

  const paragraphs = normalizedText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const tokens = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const wordGroups = paragraph.split(/\s+/).filter(Boolean);

    const expandedWords = wordGroups.flatMap(splitWordToken);

    const paragraphTokens = [];

    expandedWords.forEach((wordData) => {
      const text = wordData.text;

      // Do not display the em dash as its own RSVP token.
      // Attach it to the previous readable token instead.
      if (text === '—') {
        const previousToken = paragraphTokens.at(-1);

        if (previousToken) {
          previousToken.hasEmDashAfter = true;
        }

        return;
      }

      paragraphTokens.push({
        text,
        length: text.length,

        isSlashPart: Boolean(wordData.isSlashPart),
        hasSlashAfter: Boolean(wordData.hasSlashAfter),

        hasEmDashAfter: false,

        isSentenceEnd: /[.!?]["')\]]?$/.test(text),
        isCommaPause: /[,;:]["')\]]?$/.test(text),

        isParagraphEnd: false,
        blockId: `paragraph-${paragraphIndex + 1}`,
        tokenOffset: paragraphTokens.length,
      });
    });

    const lastToken = paragraphTokens.at(-1);

    if (lastToken && paragraphIndex < paragraphs.length - 1) {
      lastToken.isParagraphEnd = true;
    }

    tokens.push(...paragraphTokens);
  });

  return tokens;
};

const classifyDocumentBlock = (text) => {
  const lines = text.split('\n').map((line) => line.trim());

  if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(text.trim())) return 'separator';
  if (/^#{1,6}\s+\S/.test(lines[0])) return 'heading';
  if (lines.every((line) => /^>\s*\S/.test(line))) return 'quote';
  if (lines.every((line) => /^(?:[-+*]|\d+[.)])\s+\S/.test(line))) {
    return 'list';
  }

  return 'paragraph';
};

/**
 * Creates the versioned document model used by navigation, editing, and future
 * structured importers. Source text remains intact and separate from parsed
 * sections, blocks, and tokens.
 *
 * IDs are deterministic within a document revision. Callers should preserve
 * the document ID when reparsing edited source.
 *
 * @param {string} rawText
 * @param {{ id?: string, title?: string, sourceFormat?: string, revision?: number }} [options]
 */
export const createDocumentModel = (
  rawText,
  {
    id = 'document-1',
    title = 'Untitled document',
    sourceFormat = 'plain-text',
    revision = 1,
  } = {}
) => {
  const normalizedText = rawText.replace(/\r\n?/g, '\n');
  const paragraphs = createDocumentParagraphs(normalizedText);
  const sectionId = 'section-1';
  let sourceSearchFrom = 0;

  const blocks = paragraphs.map((paragraph) => {
    const sourceStart = normalizedText.indexOf(
      paragraph.text,
      sourceSearchFrom
    );
    const start = sourceStart === -1 ? sourceSearchFrom : sourceStart;
    const end = start + paragraph.text.length;
    sourceSearchFrom = end;

    return {
      id: paragraph.id,
      type: classifyDocumentBlock(paragraph.text),
      text: paragraph.text,
      sectionId,
      source: { start, end },
      tokens: [],
    };
  });

  const blockById = Object.fromEntries(
    blocks.map((block) => [block.id, block])
  );
  const blockTokenSearchOffsets = new Map();
  const tokens = tokenize(normalizedText).map((token, index) => {
    const block = blockById[token.blockId];
    const localSearchFrom = blockTokenSearchOffsets.get(token.blockId) ?? 0;
    const localStart = block?.text.indexOf(token.text, localSearchFrom) ?? -1;
    const localEnd = localStart === -1 ? -1 : localStart + token.text.length;

    if (localEnd !== -1) {
      blockTokenSearchOffsets.set(token.blockId, localEnd);
    }

    const structuredToken = {
      ...token,
      id: `token-${index + 1}`,
      sectionId,
      blockType: block?.type ?? 'paragraph',
      source:
        block && localStart !== -1
          ? {
              start: block.source.start + localStart,
              end: block.source.start + localEnd,
            }
          : null,
    };

    block?.tokens.push(structuredToken);
    return structuredToken;
  });

  return {
    schemaVersion: 1,
    id,
    title,
    source: {
      text: rawText,
      normalizedText,
      format: sourceFormat,
      revision,
      rangeBasis: 'normalizedText',
    },
    sections: [
      {
        id: sectionId,
        title: null,
        blockIds: blocks.map((block) => block.id),
        blocks,
      },
    ],
    tokens,
    tokenToBlock: Object.fromEntries(
      tokens.map((token) => [
        token.id,
        {
          sectionId: token.sectionId,
          blockId: token.blockId,
          tokenOffset: token.tokenOffset,
        },
      ])
    ),
  };
};

/**
 * @param {RSVPToken[]} tokens
 * @param {ReadingPosition | null | undefined} position
 * @returns {number}
 */
export const positionToTokenIndex = (tokens, position) => {
  if (!tokens.length || !position) return 0;

  const blockStart = tokens.findIndex(
    (token) => token.blockId === position.blockId
  );
  if (blockStart === -1) return 0;

  const blockLength = tokens.filter(
    (token) => token.blockId === position.blockId
  ).length;
  const tokenOffset = Math.max(
    0,
    Math.min(blockLength - 1, position.tokenOffset)
  );

  return blockStart + tokenOffset;
};

/**
 * @param {RSVPToken[]} tokens
 * @param {number} index
 * @returns {ReadingPosition | null}
 */
export const tokenIndexToPosition = (tokens, index) => {
  if (!tokens.length) return null;

  const token = tokens[Math.max(0, Math.min(tokens.length - 1, index))];
  return { blockId: token.blockId, tokenOffset: token.tokenOffset };
};

/**
 * Summarizes a shared reading position for navigation-mode controls using the
 * same one-based displayed-token progress semantics as immersive playback.
 *
 * @param {string} rawText
 * @param {ReadingPosition | null | undefined} position
 * @returns {{ paragraphNumber: number, paragraphCount: number, wordNumber: number, wordCount: number, documentWordNumber: number, documentWordCount: number, progress: number, percentage: number } | null}
 */
export const getReadingPositionSummary = (rawText, position) => {
  const tokens = tokenize(rawText);
  if (!tokens.length) return null;

  const paragraphs = createDocumentParagraphs(rawText);
  const tokenIndex = positionToTokenIndex(tokens, position);
  const currentPosition = tokenIndexToPosition(tokens, tokenIndex);
  const paragraphIndex = Math.max(
    0,
    paragraphs.findIndex(
      (paragraph) => paragraph.id === currentPosition.blockId
    )
  );
  const paragraphWordCount = tokens.filter(
    (token) => token.blockId === currentPosition.blockId
  ).length;
  const progress = (tokenIndex + 1) / tokens.length;

  return {
    paragraphNumber: paragraphIndex + 1,
    paragraphCount: paragraphs.length,
    wordNumber: currentPosition.tokenOffset + 1,
    wordCount: paragraphWordCount,
    documentWordNumber: tokenIndex + 1,
    documentWordCount: tokens.length,
    progress,
    percentage: Math.round(progress * 100),
  };
};

/**
 * @param {RSVPToken} token
 * @param {number} baseWpm
 * @param {object} [opts]
 * @returns {number}
 */
export const computeWordDuration = (token, baseWpm, opts = {}) => {
  const {
    commaPauseMultiplier = 1.8,
    sentenceEndMultiplier = 2.6,
    paragraphEndMultiplier = 3.2,
    slashMultiplier = 1.25,
    emDashMultiplier = 2,
    longWordThreshold = 7,
    longWordMultiplier = 1.35,
    veryLongWordThreshold = 16,
    veryLongWordCharacterMultiplier = 0.05,
    functionWordMultiplier = 0.75,
    minMs = 60,
  } = opts;

  const baseMs = 60000 / baseWpm; // ms per "average" word at this WPM

  let multiplier = 1;

  const bare = token.text.toLowerCase().replace(/[^a-z]/gi, '');
  if (FUNCTION_WORDS.has(bare)) {
    multiplier *= functionWordMultiplier;
  } else if (token.length >= longWordThreshold) {
    // scale a bit further for very long words on top of the flat multiplier
    const extra = 1 + (token.length - longWordThreshold) * 0.04;
    multiplier *= longWordMultiplier * extra;

    if (token.length >= veryLongWordThreshold) {
      const veryLongWordExtra =
        1 +
        (token.length - veryLongWordThreshold + 1) *
          veryLongWordCharacterMultiplier;
      multiplier *= veryLongWordExtra;
    }
  }

  if (token.isCommaPause) multiplier *= commaPauseMultiplier;
  if (token.isSentenceEnd) multiplier *= sentenceEndMultiplier;
  if (token.isParagraphEnd) multiplier *= paragraphEndMultiplier;
  if (token.hasSlashAfter) multiplier *= slashMultiplier;
  if (token.hasEmDashAfter) multiplier *= emDashMultiplier;

  return Math.max(minMs, Math.round(baseMs * multiplier));
};

/**
 * Creates an RSVP player with a stable command, state, and event interface.
 *
 * @param {string} text
 * @param {{ baseWpm?: number, initialPosition?: ReadingPosition | null }} [options]
 */
export const createRSVPPlayer = (
  text,
  { baseWpm = 300, initialPosition = null } = {}
) => {
  let tokens = tokenize(text);
  let index = positionToTokenIndex(tokens, initialPosition);
  let timerId = null;
  let playing = false;
  let wpm = baseWpm;

  const listeners = {
    word: new Set(),
    progress: new Set(),
    positionChange: new Set(),
    complete: new Set(),
    playStateChange: new Set(),
    wpmChange: new Set(),
  };

  const emit = (event, value) => {
    listeners[event].forEach((listener) => listener(value));
  };

  const player = {};

  /**
   * @param {RSVPPlayerEvent} event
   * @param {(value?: RSVPToken | ReadingPosition | number | boolean) => void} listener
   * @returns {() => boolean}
   */
  player.subscribe = (event, listener) => {
    const eventListeners = listeners[event];

    if (!eventListeners) {
      throw new Error(`Unknown RSVP player event: ${event}`);
    }

    if (typeof listener !== 'function') {
      throw new TypeError('RSVP player listener must be a function');
    }

    eventListeners.add(listener);
    return () => eventListeners.delete(listener);
  };

  const emitCurrentToken = () => {
    if (!tokens.length || index >= tokens.length) return;

    emit('word', tokens[index]);
    emit('progress', (index + 1) / tokens.length);
    emit('positionChange', tokenIndexToPosition(tokens, index));
  };

  const scheduleNext = () => {
    if (!playing || index >= tokens.length) {
      if (index >= tokens.length && tokens.length) {
        playing = false;
        emit('playStateChange', false);
        emit('complete');
      }
      return;
    }

    const token = tokens[index];
    emitCurrentToken();
    const duration = computeWordDuration(token, wpm);
    timerId = setTimeout(() => {
      index += 1;
      scheduleNext();
    }, duration);
  };

  const jumpTo = (newIndex) => {
    player.pause();
    if (!tokens.length) return;

    index = Math.max(0, Math.min(tokens.length - 1, newIndex));
    emitCurrentToken();
  };

  player.preview = emitCurrentToken;

  player.loadText = (newText) => {
    player.pause();

    tokens = tokenize(newText);
    index = 0;
  };

  player.play = () => {
    if (playing || !tokens.length) return;

    if (index >= tokens.length) {
      index = 0;
    }

    playing = true;
    emit('playStateChange', true);
    scheduleNext();
  };

  player.pause = () => {
    playing = false;
    clearTimeout(timerId);
    emit('playStateChange', false);
  };

  player.playToggle = () => {
    if (playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  player.reset = () => {
    player.pause();
    index = 0;
    emitCurrentToken();
  };

  player.restart = () => {
    player.pause();
    index = 0;
    player.play();
  };

  player.rewind = (n = 5) => jumpTo(index - n);
  player.skipForward = (n = 5) => jumpTo(index + n);

  player.isPlaying = () => playing;

  player.setPosition = (position) =>
    jumpTo(positionToTokenIndex(tokens, position));

  player.getState = () => ({
    isPlaying: playing,
    wpm,
    currentIndex: tokens.length ? Math.min(index, tokens.length - 1) : null,
    tokenCount: tokens.length,
    progress: tokens.length
      ? (Math.min(index, tokens.length - 1) + 1) / tokens.length
      : 0,
    position: tokenIndexToPosition(tokens, index),
  });

  player.setWpm = (newWpm) => {
    wpm = Math.max(100, Math.min(800, newWpm));
    emit('wpmChange', wpm);

    if (playing) {
      clearTimeout(timerId);
      scheduleNext();
    }
  };

  player.getWpm = () => wpm;

  return Object.freeze(player);
};
