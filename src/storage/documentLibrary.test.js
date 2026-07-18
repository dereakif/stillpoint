import { describe, expect, test } from 'bun:test';
import {
  DOCUMENT_SCHEMA_VERSION,
  DocumentStorageError,
  createDocumentId,
  normalizeDocumentRecord,
  toDocumentStorageError,
} from './documentLibrary';

describe('document library errors', () => {
  test('classifies quota errors with actionable feedback', () => {
    const error = toDocumentStorageError({ name: 'QuotaExceededError' });

    expect(error).toBeInstanceOf(DocumentStorageError);
    expect(error.code).toBe('quota-exceeded');
    expect(error.message).toContain('storage is full');
  });

  test('classifies unavailable browser storage', () => {
    const error = toDocumentStorageError({ name: 'SecurityError' });

    expect(error.code).toBe('unavailable');
    expect(error.message).toContain('unavailable');
  });

  test('preserves existing storage errors', () => {
    const original = new DocumentStorageError('Blocked', 'blocked');
    expect(toDocumentStorageError(original)).toBe(original);
  });
});

describe('document record migrations', () => {
  test('migrates a legacy reading position into a versioned session', () => {
    const readingPosition = { blockId: 'paragraph-2', tokenOffset: 3 };
    const record = normalizeDocumentRecord({
      id: 'document-1',
      schemaVersion: 1,
      readingPosition,
    });

    expect(record.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
    expect(record.readingSession).toEqual({
      position: readingPosition,
      completedChapterIds: [],
      wpm: 300,
      navigationScrollY: 0,
    });
  });

  test('sanitizes invalid session values and removes duplicate chapters', () => {
    const record = normalizeDocumentRecord({
      id: 'document-1',
      readingSession: {
        position: { blockId: 'missing', tokenOffset: 99 },
        completedChapterIds: ['section-1', '', 'section-1'],
        wpm: 5000,
        navigationScrollY: -20,
      },
    });

    expect(record.readingSession.completedChapterIds).toEqual(['section-1']);
    expect(record.readingSession.wpm).toBe(800);
    expect(record.readingSession.navigationScrollY).toBe(0);
  });
});

describe('createDocumentId', () => {
  test('creates distinct document IDs', () => {
    expect(createDocumentId()).not.toBe(createDocumentId());
  });
});
