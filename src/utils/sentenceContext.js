const documentBlocks = (documentModel) =>
  documentModel.sections.flatMap((section) => section.blocks);

const findBlock = (documentModel, blockId) =>
  documentBlocks(documentModel).find((block) => block.id === blockId);

const mapTokenRanges = (block) => {
  let searchFrom = 0;

  return block.tokens.map((token) => {
    const start = block.text.indexOf(token.text, searchFrom);
    if (start === -1) return { token, start: -1, end: -1 };

    const end = start + token.text.length;
    searchFrom = end;
    return { token, start, end };
  });
};

const trimRange = (text, range) => {
  let { start, end } = range;
  while (start < end && /\s/u.test(text[start])) start += 1;
  while (end > start && /\s/u.test(text[end - 1])) end -= 1;
  return { start, end };
};

const NON_TERMINAL_ABBREVIATION_PATTERN =
  /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St)|\b[A-Z])\.$/u;

const segmentSentenceRanges = (text, segmenter) => {
  const ranges = [...segmenter.segment(text)]
    .map(({ segment, index }) =>
      trimRange(text, { start: index, end: index + segment.length })
    )
    .filter(({ start, end }) => end > start);

  return ranges.reduce((merged, range) => {
    const previous = merged.at(-1);
    if (
      previous &&
      NON_TERMINAL_ABBREVIATION_PATTERN.test(
        text.slice(previous.start, previous.end)
      )
    ) {
      previous.end = range.end;
      return merged;
    }

    merged.push({ ...range });
    return merged;
  }, []);
};

const isTerminalToken = (token) =>
  token.isSentenceEnd && !NON_TERMINAL_ABBREVIATION_PATTERN.test(token.text);

const refineSegmentedRanges = (text, ranges, tokenRanges) =>
  ranges.flatMap((range) => {
    const internalBoundaries = tokenRanges.filter(
      ({ token, end }) =>
        isTerminalToken(token) && end > range.start && end < range.end
    );
    if (!internalBoundaries.length) return [range];

    const refined = [];
    let start = range.start;
    internalBoundaries.forEach(({ end }) => {
      refined.push(trimRange(text, { start, end }));
      start = end;
    });
    refined.push(trimRange(text, { start, end: range.end }));
    return refined.filter(({ start: rangeStart, end }) => end > rangeStart);
  });

const fallbackSentenceRanges = (tokenRanges) => {
  const ranges = [];
  let firstIndex = 0;

  tokenRanges.forEach((tokenRange, index) => {
    if (!isTerminalToken(tokenRange.token) && index < tokenRanges.length - 1) {
      return;
    }

    ranges.push({
      start: tokenRanges[firstIndex].start,
      end: tokenRange.end,
    });
    firstIndex = index + 1;
  });

  return ranges;
};

const defaultSentenceSegmenter = () =>
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'sentence' })
    : null;

export const getSentenceTokenRanges = (
  documentModel,
  { segmenter = defaultSentenceSegmenter() } = {}
) => {
  const tokenIndices = new Map(
    documentModel.tokens.map((token, index) => [token.id, index])
  );

  return documentBlocks(documentModel).flatMap((block) => {
    if (!block.tokens.length) return [];

    const tokenRanges = mapTokenRanges(block).filter(
      ({ start }) => start !== -1
    );
    if (!tokenRanges.length) return [];

    const segmentationText =
      block.type === 'paragraph' || block.type === 'quote'
        ? block.text.replace(/\n/g, ' ')
        : block.text;
    const characterRanges = segmenter
      ? refineSegmentedRanges(
          segmentationText,
          segmentSentenceRanges(segmentationText, segmenter),
          tokenRanges
        )
      : fallbackSentenceRanges(tokenRanges);

    return characterRanges
      .map((characterRange) => {
        const sentenceTokens = tokenRanges.filter(
          ({ start, end }) =>
            start < characterRange.end && end > characterRange.start
        );
        const firstToken = sentenceTokens[0]?.token;
        const lastToken = sentenceTokens.at(-1)?.token;
        if (!firstToken || !lastToken) return null;

        return {
          blockId: block.id,
          startTokenIndex: tokenIndices.get(firstToken.id),
          endTokenIndex: tokenIndices.get(lastToken.id),
          sentenceText: block.text.slice(
            characterRange.start,
            characterRange.end
          ),
          characterRange,
        };
      })
      .filter(Boolean);
  });
};

export const getSentenceNavigationTarget = (
  sentenceRanges,
  tokenIndex,
  direction
) => {
  if (!Number.isInteger(tokenIndex) || !sentenceRanges.length)
    return tokenIndex;

  const sentenceIndex = sentenceRanges.findIndex(
    ({ startTokenIndex, endTokenIndex }) =>
      tokenIndex >= startTokenIndex && tokenIndex <= endTokenIndex
  );
  if (sentenceIndex === -1) return tokenIndex;

  const currentSentence = sentenceRanges[sentenceIndex];
  if (direction === 'previous') {
    if (tokenIndex > currentSentence.startTokenIndex) {
      return currentSentence.startTokenIndex;
    }
    return (
      sentenceRanges[sentenceIndex - 1]?.startTokenIndex ??
      currentSentence.startTokenIndex
    );
  }
  if (direction === 'next') {
    return sentenceRanges[sentenceIndex + 1]?.startTokenIndex ?? tokenIndex;
  }

  return tokenIndex;
};

export const getSentenceContext = (documentModel, tokenIndex, options) => {
  if (!Number.isInteger(tokenIndex) || tokenIndex < 0) return null;

  const currentToken = documentModel.tokens[tokenIndex];
  if (!currentToken) return null;

  const block = findBlock(documentModel, currentToken.blockId);
  if (!block?.tokens.length) return null;

  const sentenceRange = getSentenceTokenRanges(documentModel, options).find(
    ({ startTokenIndex, endTokenIndex }) =>
      tokenIndex >= startTokenIndex && tokenIndex <= endTokenIndex
  );
  if (!sentenceRange) return null;

  const currentRange = mapTokenRanges(block).find(
    ({ token }) => token.id === currentToken.id
  );
  if (!currentRange || currentRange.start === -1) return null;

  return {
    blockId: block.id,
    tokenId: currentToken.id,
    sentenceText: sentenceRange.sentenceText,
    highlightRange: {
      start: currentRange.start - sentenceRange.characterRange.start,
      end: currentRange.end - sentenceRange.characterRange.start,
    },
  };
};
