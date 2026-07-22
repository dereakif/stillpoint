import { createDocumentModel, tokenIndexToPosition, tokenize } from '../utils';

const TOKEN_PATTERN = /\S+/gu;
const DEFAULT_WORDS_BEFORE = 40;
const DEFAULT_WORDS_AFTER = 220;

const tokenEntriesFromNode = (node) => {
  const entries = [];
  const text = node?.textContent ?? '';
  TOKEN_PATTERN.lastIndex = 0;
  let match;
  while ((match = TOKEN_PATTERN.exec(text))) {
    entries.push({
      node,
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return entries;
};

const localClickedTokenIndex = (entry, clickedOffset) => {
  const tokens = tokenize(entry.text);
  const relativeOffset = Math.max(0, clickedOffset - entry.start);
  let searchFrom = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    const start = entry.text.indexOf(tokens[index].text, searchFrom);
    const end = start + tokens[index].text.length;
    if (relativeOffset >= start && relativeOffset < end) return index;
    searchFrom = end;
  }
  return 0;
};

export const createSessionFromTokenEntries = (
  entries,
  clickedEntryIndex,
  clickedOffset,
  { title = 'EPUB excerpt', sectionHref = null, sourceCfi = null } = {}
) => {
  if (!entries.length || clickedEntryIndex < 0) return null;

  const text = entries.map((entry) => entry.text).join(' ');
  const document = createDocumentModel(text, {
    id: `epub-session-${Date.now()}`,
    title,
    sourceFormat: 'epub-window',
    revision: 1,
  });
  const tokenCfis = [];
  let initialTokenIndex = 0;

  entries.forEach((entry, entryIndex) => {
    const localTokens = tokenize(entry.text);
    if (entryIndex < clickedEntryIndex) initialTokenIndex += localTokens.length;
    localTokens.forEach(() => tokenCfis.push(entry.cfiRange));
    if (entryIndex === clickedEntryIndex) {
      initialTokenIndex += localClickedTokenIndex(entry, clickedOffset);
    }
  });

  document.tokens.forEach((token, index) => {
    token.epubCfiRange = tokenCfis[index] ?? sourceCfi;
  });

  return {
    document,
    initialPosition: tokenIndexToPosition(document.tokens, initialTokenIndex),
    sourceCfi,
    sectionHref,
    tokenCfis: document.tokens.map((token) => token.epubCfiRange),
  };
};

const canReadTextNode = (node) => {
  const parent = node.parentElement;
  if (!parent || !node.textContent?.trim()) return false;
  return !parent.closest(
    'script, style, noscript, template, svg, math, button, input, textarea, select, option, [aria-hidden="true"]'
  );
};

export const createBoundedEpubSession = (
  contents,
  clickedNode,
  clickedOffset,
  clickedWord,
  {
    title,
    sectionHref = null,
    sourceCfi = null,
    wordsBefore = DEFAULT_WORDS_BEFORE,
    wordsAfter = DEFAULT_WORDS_AFTER,
  } = {}
) => {
  const root = contents?.content ?? contents?.document?.body;
  if (!root?.contains(clickedNode) || !canReadTextNode(clickedNode))
    return null;

  const view = contents.document.defaultView;
  const walker = contents.document.createTreeWalker(
    root,
    view.NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        canReadTextNode(node)
          ? view.NodeFilter.FILTER_ACCEPT
          : view.NodeFilter.FILTER_REJECT,
    }
  );
  const currentEntries = tokenEntriesFromNode(clickedNode);
  const clickedEntryInNode = currentEntries.findIndex(
    (entry) => clickedWord.start >= entry.start && clickedWord.start < entry.end
  );
  if (clickedEntryInNode < 0) return null;

  let before = currentEntries.slice(0, clickedEntryInNode);
  let after = currentEntries.slice(clickedEntryInNode + 1);

  walker.currentNode = clickedNode;
  let previousNode = walker.previousNode();
  while (previousNode && before.length < wordsBefore) {
    const available = tokenEntriesFromNode(previousNode);
    const needed = wordsBefore - before.length;
    before = [...available.slice(-needed), ...before];
    previousNode = walker.previousNode();
  }
  before = before.slice(-wordsBefore);

  walker.currentNode = clickedNode;
  let nextNode = walker.nextNode();
  while (nextNode && after.length < wordsAfter) {
    after.push(...tokenEntriesFromNode(nextNode));
    nextNode = walker.nextNode();
  }
  after = after.slice(0, wordsAfter);

  const entries = [...before, currentEntries[clickedEntryInNode], ...after].map(
    (entry) => {
      const range = contents.document.createRange();
      range.setStart(entry.node, entry.start);
      range.setEnd(entry.node, entry.end);
      return {
        ...entry,
        cfiRange: contents.cfiFromRange(range),
      };
    }
  );

  return createSessionFromTokenEntries(
    entries,
    before.length,
    clickedWord.start,
    { title, sectionHref, sourceCfi }
  );
};
