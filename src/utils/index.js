const PREFIX_WORDS = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'with']);

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

export const splitAtORP = (word, opts = {}) => {
  const idx = computeORPIndex(word, opts);
  return {
    before: word.slice(0, idx),
    pivot: word.slice(idx, idx + 1),
    after: word.slice(idx + 1),
  };
};

const groupPrefixWords = (tokens) => {
  const result = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const nextToken = tokens[index + 1];

    const bare = token.text.toLowerCase().replace(/[^\p{L}]/gu, '');

    if (
      PREFIX_WORDS.has(bare) &&
      nextToken &&
      !token.isSentenceEnd &&
      token.text.length + nextToken.text.length <= 16
    ) {
      result.push({
        ...token,
        text: `${token.text} ${nextToken.text}`,
        length: token.text.length + nextToken.text.length + 1,
        isPhrase: true,
        isSentenceEnd: nextToken.isSentenceEnd,
        isCommaPause: nextToken.isCommaPause,
      });

      index += 1;
      continue;
    }

    result.push(token);
  }

  return result;
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

        isSlashPart: wordData.isSlashPart,
        hasSlashAfter: wordData.hasSlashAfter,

        hasEmDashAfter: false,

        isSentenceEnd: /[.!?]["')\]]?$/.test(text),
        isCommaPause: /[,;:]["')\]]?$/.test(text),

        isParagraphEnd: false,
      });
    });

    const groupedTokens = groupPrefixWords(paragraphTokens);

    const lastToken = groupedTokens.at(-1);

    if (lastToken && paragraphIndex < paragraphs.length - 1) {
      lastToken.isParagraphEnd = true;
    }

    tokens.push(...paragraphTokens);
  });

  return tokens;
};

export const computeWordDuration = (token, baseWpm, opts = {}) => {
  const {
    commaPauseMultiplier = 1.8,
    sentenceEndMultiplier = 2.6,
    paragraphEndMultiplier = 3.2,
    slashMultiplier = 1.25,
    emDashMultiplier = 2,
    longWordThreshold = 7,
    longWordMultiplier = 1.35,
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
  }

  if (token.isCommaPause) multiplier *= commaPauseMultiplier;
  if (token.isSentenceEnd) multiplier *= sentenceEndMultiplier;
  if (token.isParagraphEnd) multiplier *= paragraphEndMultiplier;
  if (token.hasSlashAfter) multiplier *= slashMultiplier;
  if (token.emDashAfter) multiplier *= emDashMultiplier;

  return Math.max(minMs, Math.round(baseMs * multiplier));
};

export const createRSVPPlayer = (text, { baseWpm = 300 } = {}) => {
  let tokens = tokenize(text);
  let index = 0;
  let timerId = null;
  let playing = false;
  let wpm = baseWpm;

  const player = {
    onWord: null, // ← mutable property, children can assign to this later
    onProgress: null,
    onComplete: null,
    onPlayStateChange: null,
    onChangeWpm: null,
  };

  const scheduleNext = () => {
    if (!playing || index >= tokens.length) {
      if (index >= tokens.length) {
        playing = false;
        player.onPlayStateChange?.(false);
        player.onComplete?.(); // read live off `player`, not a closed-over var
      }
      return;
    }
    const token = tokens[index];
    player.onWord?.(token);
    player.onProgress?.((index + 1) / tokens.length);
    const duration = computeWordDuration(token, wpm);
    timerId = setTimeout(() => {
      index += 1;
      scheduleNext();
    }, duration);
  };

  const jumpTo = (newIndex) => {
    player.pause();
    index = Math.max(0, Math.min(tokens.length - 1, newIndex));
    const token = tokens[index];
    player.onWord?.(token);
    player.onProgress?.(index / tokens.length);
  };

  player.preview = () => {
    if (!tokens.length) return;

    const token = tokens[index];

    player.onWord?.(token);
    player.onProgress?.((index + 1) / tokens.length);
  };

  player.loadText = (newText) => {
    player.pause();

    tokens = tokenize(newText);
    index = 0;
  };

  player.play = () => {
    if (!playing) {
      playing = true;
      player.onPlayStateChange?.(true);
      scheduleNext();
    }
  };

  player.pause = () => {
    playing = false;
    clearTimeout(timerId);
    player.onPlayStateChange?.(false);
  };

  player.playToggle = () => {
    if (playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  player.rewind = (n = 5) => jumpTo(index - n);
  player.skipForward = (n = 5) => jumpTo(index + n);

  player.isPlaying = () => playing;

  player.setWpm = (newWpm) => {
    wpm = Math.max(100, Math.min(800, newWpm));
    player.onChangeWpm?.(wpm);

    if (playing) {
      clearTimeout(timerId);
      scheduleNext(); // reschedules the *current* word at the new speed
    }
  };

  player.getWpm = () => wpm;

  // ...rewind, skipForward, setWpm as before, all reading/writing the same closure vars

  return player;
};
