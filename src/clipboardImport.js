import { createDocumentModel } from './utils';

export class ClipboardImportError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'ClipboardImportError';
    this.code = code;
  }
}

const messages = {
  insecure:
    'Clipboard access requires a secure connection. Open Stillpoint over HTTPS or on localhost, then try again.',
  unavailable:
    'This browser cannot read clipboard text here. Paste the text into the document editor instead.',
  'permission-denied':
    'Clipboard permission was denied. Allow clipboard access in your browser, or paste the text into the document editor.',
  empty: 'The clipboard is empty. Your editor text was left unchanged.',
  unreadable:
    'The clipboard does not contain readable words. Your editor text was left unchanged.',
  'read-failed':
    'Stillpoint could not read the clipboard. Your editor text was left unchanged.',
};

const clipboardError = (code, cause) =>
  new ClipboardImportError(code, messages[code], cause);

export const createDocumentFromClipboard = (text, currentDocument) => {
  if (typeof text !== 'string' || !text.trim()) {
    throw clipboardError('empty');
  }

  const documentModel = createDocumentModel(text, {
    id: currentDocument.id,
    title: currentDocument.title,
    sourceFormat: currentDocument.source.format,
    revision: currentDocument.source.revision + 1,
  });

  if (!documentModel.tokens.length) {
    throw clipboardError('unreadable');
  }

  return documentModel;
};

export const readDocumentFromClipboard = async (
  currentDocument,
  {
    clipboard = globalThis.navigator?.clipboard,
    isSecureContext = globalThis.isSecureContext,
  } = {}
) => {
  if (isSecureContext === false) throw clipboardError('insecure');
  if (!clipboard || typeof clipboard.readText !== 'function') {
    throw clipboardError('unavailable');
  }

  let text;
  try {
    text = await clipboard.readText();
  } catch (error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
      throw clipboardError('permission-denied', error);
    }
    throw clipboardError('read-failed', error);
  }

  return createDocumentFromClipboard(text, currentDocument);
};
