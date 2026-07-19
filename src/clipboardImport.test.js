import { describe, expect, test } from 'bun:test';
import { createDocumentModel } from './utils';
import {
  ClipboardImportError,
  createDocumentFromClipboard,
  readDocumentFromClipboard,
} from './clipboardImport';

const currentDocument = createDocumentModel('Original document text.', {
  id: 'clipboard-test',
  title: 'Clipboard test',
  sourceFormat: 'markdown',
  revision: 4,
});

const expectClipboardError = async (promise, code, message) => {
  try {
    await promise;
    throw new Error('Expected clipboard import to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(ClipboardImportError);
    expect(error.code).toBe(code);
    expect(error.message).toContain(message);
  }
};

describe('clipboard document import', () => {
  test('creates a replacement only after validating readable text', () => {
    const replacement = createDocumentFromClipboard(
      '# New text\n\nReadable clipboard words.',
      currentDocument
    );

    expect(replacement.id).toBe(currentDocument.id);
    expect(replacement.title).toBe(currentDocument.title);
    expect(replacement.source.revision).toBe(5);
    expect(replacement.source.text).toContain('Readable clipboard words.');
    expect(currentDocument.source.text).toBe('Original document text.');
  });

  test('rejects empty clipboard content', async () => {
    await expectClipboardError(
      Promise.resolve().then(() =>
        createDocumentFromClipboard('  \n ', currentDocument)
      ),
      'empty',
      'clipboard is empty'
    );
  });

  test('rejects clipboard content without readable words', async () => {
    await expectClipboardError(
      Promise.resolve().then(() =>
        createDocumentFromClipboard('---\n\n***', currentDocument)
      ),
      'unreadable',
      'does not contain readable words'
    );
  });

  test('explains that insecure pages cannot access the clipboard', async () => {
    await expectClipboardError(
      readDocumentFromClipboard(currentDocument, {
        clipboard: { readText: async () => 'replacement' },
        isSecureContext: false,
      }),
      'insecure',
      'HTTPS or on localhost'
    );
  });

  test('reports an unavailable clipboard API', async () => {
    await expectClipboardError(
      readDocumentFromClipboard(currentDocument, {
        clipboard: null,
        isSecureContext: true,
      }),
      'unavailable',
      'document editor'
    );
  });

  test('distinguishes denied clipboard permission', async () => {
    const denied = new Error('denied');
    denied.name = 'NotAllowedError';

    await expectClipboardError(
      readDocumentFromClipboard(currentDocument, {
        clipboard: { readText: async () => Promise.reject(denied) },
        isSecureContext: true,
      }),
      'permission-denied',
      'permission was denied'
    );
  });

  test('uses generic feedback for unexpected read failures', async () => {
    await expectClipboardError(
      readDocumentFromClipboard(currentDocument, {
        clipboard: {
          readText: async () => Promise.reject(new Error('device failure')),
        },
        isSecureContext: true,
      }),
      'read-failed',
      'could not read the clipboard'
    );
  });
});
