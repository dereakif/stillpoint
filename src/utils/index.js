import { clampReadingWpm } from '../readingSpeed';
import {
  getSentenceNavigationTarget,
  getSentenceTokenRanges,
} from './sentenceContext';

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
 * @property {string} [sectionId]
 */

/**
 * @typedef {'word' | 'wordRead' | 'progress' | 'positionChange' | 'complete' | 'playStateChange' | 'wpmChange' | 'chapterProgress' | 'chapterComplete'} RSVPPlayerEvent
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

const MARKDOWN_HEADING_PATTERN = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$/;
const CHAPTER_LABEL_PATTERN =
  /^chapter\s+(?:\d+|[ivxlcdm]+|[a-z]+)(?:\s*[:.\-–—]\s*.*|\s+.*)?$/i;
const LIST_ITEM_PATTERN = /^\s*(?:[-+*]|\d+[.)])\s+(.+)$/;
const SEPARATOR_PATTERN = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

const parseDocumentBlocks = (normalizedText) => {
  const lines = normalizedText.split('\n');
  const lineOffsets = [];
  let offset = 0;

  lines.forEach((line) => {
    lineOffsets.push(offset);
    offset += line.length + 1;
  });

  const blocks = [];
  let lineIndex = 0;

  const addBlock = (startLine, endLine, details) => {
    const start = lineOffsets[startLine];
    const end = lineOffsets[endLine] + lines[endLine].length;
    const sourceText = normalizedText.slice(start, end);

    blocks.push({
      id: `paragraph-${blocks.length + 1}`,
      ...details,
      sourceText,
      source: { start, end },
      sectionId: null,
      tokens: [],
    });
  };

  while (lineIndex < lines.length) {
    if (!lines[lineIndex].trim()) {
      lineIndex += 1;
      continue;
    }

    const line = lines[lineIndex];
    const trimmedLine = line.trim();
    const headingMatch = line.match(MARKDOWN_HEADING_PATTERN);

    if (headingMatch) {
      addBlock(lineIndex, lineIndex, {
        type: 'heading',
        text: headingMatch[2].trim(),
        headingLevel: headingMatch[1].length,
        headingSyntax: 'markdown',
      });
      lineIndex += 1;
      continue;
    }

    if (CHAPTER_LABEL_PATTERN.test(trimmedLine)) {
      addBlock(lineIndex, lineIndex, {
        type: 'heading',
        text: trimmedLine,
        headingLevel: 1,
        headingSyntax: 'chapter-label',
      });
      lineIndex += 1;
      continue;
    }

    if (SEPARATOR_PATTERN.test(line)) {
      addBlock(lineIndex, lineIndex, {
        type: 'separator',
        text: trimmedLine,
      });
      lineIndex += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const startLine = lineIndex;
      const quoteLines = [];

      while (lineIndex < lines.length && /^\s*>/.test(lines[lineIndex])) {
        quoteLines.push(lines[lineIndex].replace(/^\s*>\s?/, ''));
        lineIndex += 1;
      }

      addBlock(startLine, lineIndex - 1, {
        type: 'quote',
        text: quoteLines.join('\n').trim(),
      });
      continue;
    }

    if (LIST_ITEM_PATTERN.test(line)) {
      const startLine = lineIndex;
      const items = [];

      while (
        lineIndex < lines.length &&
        LIST_ITEM_PATTERN.test(lines[lineIndex])
      ) {
        items.push(lines[lineIndex].match(LIST_ITEM_PATTERN)[1].trim());
        lineIndex += 1;
      }

      addBlock(startLine, lineIndex - 1, {
        type: 'list',
        text: items.join('\n'),
        items,
      });
      continue;
    }

    const startLine = lineIndex;
    const paragraphLines = [];

    while (lineIndex < lines.length && lines[lineIndex].trim()) {
      if (
        paragraphLines.length &&
        (MARKDOWN_HEADING_PATTERN.test(lines[lineIndex]) ||
          CHAPTER_LABEL_PATTERN.test(lines[lineIndex].trim()) ||
          SEPARATOR_PATTERN.test(lines[lineIndex]) ||
          /^\s*>/.test(lines[lineIndex]) ||
          LIST_ITEM_PATTERN.test(lines[lineIndex]))
      ) {
        break;
      }

      paragraphLines.push(lines[lineIndex].trim());
      lineIndex += 1;
    }

    addBlock(startLine, lineIndex - 1, {
      type: 'paragraph',
      text: paragraphLines.join('\n').trim(),
    });
  }

  return blocks;
};

const createSections = (blocks) => {
  const sections = [];
  let currentSection = null;

  const startSection = (title = null, headingBlockId = null) => {
    currentSection = {
      id: `section-${sections.length + 1}`,
      title,
      headingBlockId,
      blockIds: [],
      blocks: [],
    };
    sections.push(currentSection);
  };

  blocks.forEach((block) => {
    if (block.type === 'heading') {
      if (!currentSection || currentSection.blocks.length) {
        startSection(block.text, block.id);
      } else {
        currentSection.title = block.text;
        currentSection.headingBlockId = block.id;
      }
    } else if (!currentSection) {
      startSection();
    }

    block.sectionId = currentSection.id;
    currentSection.blockIds.push(block.id);
    currentSection.blocks.push(block);
  });

  if (!sections.length) startSection();
  return sections;
};

/**
 * Parses Markdown-oriented source into the versioned document model used by
 * editing, navigation, and immersive playback. Source text remains intact and
 * separate from parsed sections, blocks, and tokens.
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
    sourceFormat = 'markdown',
    revision = 1,
  } = {}
) => {
  const normalizedText = rawText.replace(/\r\n?/g, '\n');
  const blocks = parseDocumentBlocks(normalizedText);
  const sections = createSections(blocks);
  const tokens = [];

  blocks.forEach((block) => {
    if (block.type === 'separator') return;

    let sourceSearchFrom = 0;
    tokenize(block.text).forEach((token) => {
      const localStart = block.sourceText.indexOf(token.text, sourceSearchFrom);
      const localEnd = localStart === -1 ? -1 : localStart + token.text.length;

      if (localEnd !== -1) sourceSearchFrom = localEnd;

      const structuredToken = {
        ...token,
        id: `token-${tokens.length + 1}`,
        sectionId: block.sectionId,
        blockId: block.id,
        blockType: block.type,
        tokenOffset: block.tokens.length,
        isParagraphEnd: false,
        source:
          localStart === -1
            ? null
            : {
                start: block.source.start + localStart,
                end: block.source.start + localEnd,
              },
      };

      block.tokens.push(structuredToken);
      tokens.push(structuredToken);
    });
  });

  const readableBlocks = blocks.filter((block) => block.tokens.length);
  readableBlocks.slice(0, -1).forEach((block) => {
    block.tokens.at(-1).isParagraphEnd = true;
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
    sections,
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
  return {
    blockId: token.blockId,
    tokenOffset: token.tokenOffset,
    ...(token.sectionId ? { sectionId: token.sectionId } : {}),
  };
};

/**
 * Summarizes a shared reading position for navigation-mode controls using the
 * same one-based displayed-token progress semantics as immersive playback.
 *
 * @param {string | { tokens: RSVPToken[], sections: object[] }} content
 * @param {ReadingPosition | null | undefined} position
 * @returns {{ paragraphNumber: number, paragraphCount: number, wordNumber: number, wordCount: number, documentWordNumber: number, documentWordCount: number, progress: number, percentage: number } | null}
 */
export const getReadingPositionSummary = (content, position) => {
  const isDocumentModel = typeof content !== 'string';
  const tokens = isDocumentModel ? content.tokens : tokenize(content);
  if (!tokens.length) return null;

  const paragraphs = isDocumentModel
    ? content.sections
        .flatMap((section) => section.blocks)
        .filter((block) => block.tokens.length)
    : createDocumentParagraphs(content);
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
 * @param {string | { tokens: RSVPToken[], sections?: object[] }} content
 * @param {{ baseWpm?: number, initialPosition?: ReadingPosition | null, completedChapterIds?: string[], timingOptions?: object }} [options]
 */
export const createRSVPPlayer = (
  content,
  {
    baseWpm = 300,
    initialPosition = null,
    completedChapterIds = [],
    timingOptions = {},
  } = {}
) => {
  let tokens = typeof content === 'string' ? tokenize(content) : content.tokens;
  let index = positionToTokenIndex(tokens, initialPosition);
  let timerId = null;
  let playing = false;
  let wpm = clampReadingWpm(baseWpm);
  let chapterDefinitions =
    typeof content === 'string'
      ? []
      : (content.sections ?? [])
          .filter((section) =>
            tokens.some((token) => token.sectionId === section.id)
          )
          .map((section) => ({ id: section.id, title: section.title }));
  const createFallbackSentenceRanges = (currentTokens) => {
    const ranges = [];
    let startTokenIndex = 0;

    currentTokens.forEach((token, tokenIndex) => {
      if (
        !token.isSentenceEnd &&
        !token.isParagraphEnd &&
        tokenIndex < currentTokens.length - 1
      ) {
        return;
      }

      ranges.push({ startTokenIndex, endTokenIndex: tokenIndex });
      startTokenIndex = tokenIndex + 1;
    });

    return ranges;
  };
  let sentenceRanges =
    typeof content === 'string'
      ? createFallbackSentenceRanges(tokens)
      : getSentenceTokenRanges(content);
  let pendingChapterBoundary = null;
  const completedChapters = new Set(completedChapterIds);
  const promptedChapterBoundaries = new Set();
  const readTokenIndices = new Set();

  const listeners = {
    word: new Set(),
    wordRead: new Set(),
    progress: new Set(),
    positionChange: new Set(),
    complete: new Set(),
    playStateChange: new Set(),
    wpmChange: new Set(),
    chapterProgress: new Set(),
    chapterComplete: new Set(),
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

  const getChapterState = (tokenIndex = index) => {
    if (!tokens.length) return null;

    const safeIndex = Math.max(0, Math.min(tokens.length - 1, tokenIndex));
    const token = tokens[safeIndex];
    const chapterIndex = chapterDefinitions.findIndex(
      (chapter) => chapter.id === token.sectionId
    );

    if (chapterIndex === -1) {
      return {
        id: null,
        title: null,
        number: 1,
        count: 1,
        progress: (safeIndex + 1) / tokens.length,
      };
    }

    const chapter = chapterDefinitions[chapterIndex];
    const chapterTokenIndices = tokens
      .map((candidate, candidateIndex) =>
        candidate.sectionId === chapter.id ? candidateIndex : -1
      )
      .filter((candidateIndex) => candidateIndex !== -1);
    const chapterStart = chapterTokenIndices[0];

    return {
      id: chapter.id,
      title: chapter.title,
      number: chapterIndex + 1,
      count: chapterDefinitions.length,
      progress: (safeIndex - chapterStart + 1) / chapterTokenIndices.length,
    };
  };

  const getChapterBoundaryAfter = (tokenIndex) => {
    if (tokenIndex >= tokens.length - 1) return null;

    const completedChapter = getChapterState(tokenIndex);
    const nextChapter = getChapterState(tokenIndex + 1);
    if (
      !completedChapter?.id ||
      !nextChapter?.id ||
      completedChapter.id === nextChapter.id
    ) {
      return null;
    }

    const firstChapterTokenIndex = tokens.findIndex(
      (token) => token.sectionId === completedChapter.id
    );
    const firstReadableChapterTokenIndex = tokens.findIndex(
      (token) =>
        token.sectionId === completedChapter.id && token.blockType !== 'heading'
    );
    const completedStartIndex =
      firstReadableChapterTokenIndex === -1
        ? firstChapterTokenIndex
        : firstReadableChapterTokenIndex;
    const completedWordCount = tokens.filter(
      (token) => token.sectionId === completedChapter.id
    ).length;
    const wordsRead = [...readTokenIndices].filter(
      (readIndex) => tokens[readIndex]?.sectionId === completedChapter.id
    ).length;

    return {
      id: `${completedChapter.id}->${nextChapter.id}`,
      completedChapter: {
        ...completedChapter,
        wordCount: completedWordCount,
        wordsRead,
      },
      nextChapter,
      completedStartIndex,
      nextIndex: tokenIndex + 1,
      nextPosition: tokenIndexToPosition(tokens, tokenIndex + 1),
    };
  };

  const emitCurrentToken = () => {
    if (!tokens.length || index >= tokens.length) return;

    if (playing && !readTokenIndices.has(index)) {
      readTokenIndices.add(index);
      emit('wordRead', tokens[index]);
    }
    emit('word', tokens[index]);
    emit('progress', (index + 1) / tokens.length);
    emit('chapterProgress', getChapterState(index));
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
    const duration = computeWordDuration(token, wpm, timingOptions);
    timerId = setTimeout(() => {
      const chapterBoundary = getChapterBoundaryAfter(index);

      if (
        chapterBoundary &&
        !completedChapters.has(chapterBoundary.completedChapter.id) &&
        !promptedChapterBoundaries.has(chapterBoundary.id)
      ) {
        completedChapters.add(chapterBoundary.completedChapter.id);
        promptedChapterBoundaries.add(chapterBoundary.id);
        pendingChapterBoundary = chapterBoundary;
        playing = false;
        emit('playStateChange', false);
        emit('chapterComplete', chapterBoundary);
        return;
      }

      index += 1;
      scheduleNext();
    }, duration);
  };

  const jumpTo = (newIndex) => {
    player.pause();
    pendingChapterBoundary = null;
    if (!tokens.length) return;

    index = Math.max(0, Math.min(tokens.length - 1, newIndex));
    emitCurrentToken();
  };

  player.preview = emitCurrentToken;

  player.loadText = (newText) => {
    player.pause();

    tokens = tokenize(newText);
    sentenceRanges = createFallbackSentenceRanges(tokens);
    chapterDefinitions = [];
    pendingChapterBoundary = null;
    promptedChapterBoundaries.clear();
    completedChapters.clear();
    readTokenIndices.clear();
    index = 0;
  };

  player.loadDocument = (documentModel) => {
    player.pause();

    tokens = documentModel.tokens;
    sentenceRanges = getSentenceTokenRanges(documentModel);
    chapterDefinitions = documentModel.sections
      .filter((section) =>
        tokens.some((token) => token.sectionId === section.id)
      )
      .map((section) => ({ id: section.id, title: section.title }));
    pendingChapterBoundary = null;
    promptedChapterBoundaries.clear();
    completedChapters.clear();
    readTokenIndices.clear();
    index = 0;
  };

  player.play = () => {
    if (playing || !tokens.length) return;

    if (pendingChapterBoundary) {
      index = pendingChapterBoundary.nextIndex;
      pendingChapterBoundary = null;
    }

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

  player.continueToNextChapter = () => {
    if (!pendingChapterBoundary) return;
    player.play();
  };

  player.reviewCompletedChapter = () => {
    if (!pendingChapterBoundary) return;
    const chapterStart = pendingChapterBoundary.completedStartIndex;
    pendingChapterBoundary = null;
    jumpTo(chapterStart);
  };

  player.getPendingChapterBoundary = () => pendingChapterBoundary;
  player.getChapterState = () => getChapterState();

  player.playToggle = () => {
    if (playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  player.reset = () => {
    player.pause();
    pendingChapterBoundary = null;
    promptedChapterBoundaries.clear();
    readTokenIndices.clear();
    index = 0;
    emitCurrentToken();
  };

  player.restart = () => {
    player.pause();
    pendingChapterBoundary = null;
    promptedChapterBoundaries.clear();
    readTokenIndices.clear();
    index = 0;
    player.play();
  };

  const getCurrentTokenIndex = () =>
    tokens.length ? Math.min(index, tokens.length - 1) : index;

  player.previousSentence = () =>
    jumpTo(
      getSentenceNavigationTarget(
        sentenceRanges,
        getCurrentTokenIndex(),
        'previous'
      )
    );
  player.nextSentence = () =>
    jumpTo(
      getSentenceNavigationTarget(
        sentenceRanges,
        getCurrentTokenIndex(),
        'next'
      )
    );

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
    completedChapterIds: [...completedChapters],
  });

  player.setWpm = (newWpm) => {
    wpm = clampReadingWpm(newWpm);
    emit('wpmChange', wpm);

    if (playing) {
      clearTimeout(timerId);
      scheduleNext();
    }
  };

  player.getWpm = () => wpm;

  return Object.freeze(player);
};
