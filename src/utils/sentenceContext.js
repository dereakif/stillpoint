const findBlock = (documentModel, blockId) =>
  documentModel.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.id === blockId);

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

const fallbackSentenceRange = (tokenRanges, currentRange) => {
  const currentIndex = tokenRanges.indexOf(currentRange);
  let firstIndex = currentIndex;
  let lastIndex = currentIndex;

  while (firstIndex > 0 && !tokenRanges[firstIndex - 1].token.isSentenceEnd) {
    firstIndex -= 1;
  }
  while (
    lastIndex < tokenRanges.length - 1 &&
    !tokenRanges[lastIndex].token.isSentenceEnd
  ) {
    lastIndex += 1;
  }

  return {
    start: tokenRanges[firstIndex].start,
    end: tokenRanges[lastIndex].end,
  };
};

const defaultSentenceSegmenter = () =>
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'sentence' })
    : null;

export const getSentenceContext = (
  documentModel,
  tokenIndex,
  { segmenter = defaultSentenceSegmenter() } = {}
) => {
  if (!Number.isInteger(tokenIndex) || tokenIndex < 0) return null;

  const currentToken = documentModel.tokens[tokenIndex];
  if (!currentToken) return null;

  const block = findBlock(documentModel, currentToken.blockId);
  if (!block?.tokens.length) return null;

  const tokenRanges = mapTokenRanges(block);
  const currentRange = tokenRanges.find(
    ({ token }) => token.id === currentToken.id
  );
  if (!currentRange || currentRange.start === -1) return null;

  const segmentedRanges = segmenter
    ? segmentSentenceRanges(block.text, segmenter)
    : [];
  const sentenceRange =
    segmentedRanges.find(
      ({ start, end }) => currentRange.start < end && currentRange.end > start
    ) ?? fallbackSentenceRange(tokenRanges, currentRange);
  const sentenceText = block.text.slice(sentenceRange.start, sentenceRange.end);

  return {
    blockId: block.id,
    tokenId: currentToken.id,
    sentenceText,
    highlightRange: {
      start: currentRange.start - sentenceRange.start,
      end: currentRange.end - sentenceRange.start,
    },
  };
};
