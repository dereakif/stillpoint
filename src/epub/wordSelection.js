const WORD_PATTERN = /[\p{L}\p{N}\p{M}_]+(?:['’-][\p{L}\p{N}\p{M}_]+)*/gu;
const CONNECTOR_PATTERN = /^['’-]$/u;

const findFallbackWord = (text, offset) => {
  WORD_PATTERN.lastIndex = 0;
  let match;
  while ((match = WORD_PATTERN.exec(text))) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset < end) {
      return { start, end, text: match[0] };
    }
  }
  return null;
};

const mergeConnectedSegments = (segments, wordIndex) => {
  let first = wordIndex;
  let last = wordIndex;

  while (
    first >= 2 &&
    segments[first - 2].isWordLike &&
    CONNECTOR_PATTERN.test(segments[first - 1].segment) &&
    segments[first - 2].index + segments[first - 2].segment.length ===
      segments[first - 1].index &&
    segments[first - 1].index + segments[first - 1].segment.length ===
      segments[first].index
  ) {
    first -= 2;
  }

  while (
    last + 2 < segments.length &&
    CONNECTOR_PATTERN.test(segments[last + 1].segment) &&
    segments[last + 2].isWordLike &&
    segments[last].index + segments[last].segment.length ===
      segments[last + 1].index &&
    segments[last + 1].index + segments[last + 1].segment.length ===
      segments[last + 2].index
  ) {
    last += 2;
  }

  return { first, last };
};

export const findWordAtOffset = (text, offset, locale) => {
  if (typeof text !== 'string' || !text.length) return null;
  const boundedOffset = Math.min(
    text.length - 1,
    Math.max(0, Number(offset) || 0)
  );

  if (typeof Intl?.Segmenter !== 'function') {
    return findFallbackWord(text, boundedOffset);
  }

  const segments = [
    ...new Intl.Segmenter(locale, { granularity: 'word' }).segment(text),
  ];
  let segmentIndex = segments.findIndex((segment, index) => {
    const end = segments[index + 1]?.index ?? text.length;
    return boundedOffset >= segment.index && boundedOffset < end;
  });
  if (segmentIndex < 0) return null;

  if (!segments[segmentIndex].isWordLike) {
    const isConnector = CONNECTOR_PATTERN.test(segments[segmentIndex].segment);
    const previous = segments[segmentIndex - 1];
    const next = segments[segmentIndex + 1];
    if (!isConnector || !previous?.isWordLike || !next?.isWordLike) return null;
    segmentIndex -= 1;
  }

  const { first, last } = mergeConnectedSegments(segments, segmentIndex);
  const start = segments[first].index;
  const end = segments[last].index + segments[last].segment.length;
  return { start, end, text: text.slice(start, end) };
};

const firstTextDescendant = (node) => {
  if (!node) return null;
  if (node.nodeType === 3) return node;
  const showText = node.ownerDocument?.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
  const walker = node.ownerDocument?.createTreeWalker(node, showText);
  return walker?.nextNode() ?? null;
};

export const caretPositionFromPoint = (document, x, y) => {
  const caretPosition = document.caretPositionFromPoint?.(x, y);
  if (caretPosition?.offsetNode) {
    const textNode = firstTextDescendant(caretPosition.offsetNode);
    if (!textNode) return null;
    return {
      node: textNode,
      offset: caretPosition.offsetNode === textNode ? caretPosition.offset : 0,
    };
  }

  const caretRange = document.caretRangeFromPoint?.(x, y);
  if (!caretRange?.startContainer) return null;
  const textNode = firstTextDescendant(caretRange.startContainer);
  if (!textNode) return null;
  return {
    node: textNode,
    offset: caretRange.startContainer === textNode ? caretRange.startOffset : 0,
  };
};
