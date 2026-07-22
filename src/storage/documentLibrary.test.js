import { describe, expect, test } from 'bun:test';
import {
  DOCUMENT_SCHEMA_VERSION,
  DocumentStorageError,
  createDocumentId,
  createEpubDocumentRecord,
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

    expect(DOCUMENT_SCHEMA_VERSION).toBe(3);
    expect(record.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
    expect(record.kind).toBe('text');
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
    expect(record.readingSession.wpm).toBe(600);
    expect(record.readingSession.navigationScrollY).toBe(0);
  });

  test('normalizes and sanitizes EPUB-specific fields', () => {
    const file = new Blob(['book'], { type: 'application/epub+zip' });
    const record = normalizeDocumentRecord({
      id: 'epub-1',
      kind: 'epub',
      source: {
        file,
        fileName: '  example.epub  ',
        mediaType: ' application/epub+zip ',
      },
      authors: [' Ursula Le Guin ', '', 'Ursula Le Guin', 42],
      reading: {
        cfi: '  epubcfi(/6/2)  ',
        percentage: 4,
        chapterLabel: 12,
      },
      readingPosition: { blockId: 'legacy' },
      readingSession: { wpm: 500 },
    });

    expect(record.source).toEqual({
      file,
      fileName: 'example.epub',
      mediaType: 'application/epub+zip',
    });
    expect(record.source.file).toBe(file);
    expect(record.authors).toEqual(['Ursula Le Guin']);
    expect(record.reading).toEqual({
      cfi: 'epubcfi(/6/2)',
      percentage: 1,
      chapterLabel: null,
    });
    expect(record.progress).toBe(1);
    expect(record.readingSession).toBeUndefined();
    expect(record.readingPosition).toBeUndefined();
  });
});

describe('EPUB records', () => {
  test('constructs a versioned record with a filename-derived title', () => {
    const file = new Blob(['book'], { type: 'application/epub+zip' });
    const record = createEpubDocumentRecord(file, {
      source: { fileName: 'A Wizard of Earthsea.epub' },
    });

    expect(record.id).toBeString();
    expect(record.title).toBe('A Wizard of Earthsea');
    expect(record.kind).toBe('epub');
    expect(record.schemaVersion).toBe(3);
    expect(record.source).toEqual({
      file,
      fileName: 'A Wizard of Earthsea.epub',
      mediaType: 'application/epub+zip',
    });
    expect(record.authors).toEqual([]);
    expect(record.reading).toEqual({
      cfi: null,
      percentage: 0,
      chapterLabel: null,
    });
    expect(record.progress).toBe(0);
  });

  test('preserves the source Blob when applying a normalized reading update', () => {
    const file = new Blob(['book'], { type: 'application/epub+zip' });
    const original = createEpubDocumentRecord(file, {
      source: { fileName: 'book.epub' },
    });
    const updated = normalizeDocumentRecord({
      ...original,
      reading: {
        cfi: 'epubcfi(/6/4)',
        percentage: 0.42,
        chapterLabel: 'Chapter 2',
      },
    });

    expect(updated.source.file).toBe(file);
    expect(updated.reading.percentage).toBe(0.42);
    expect(updated.progress).toBe(0.42);
  });
});

describe('createDocumentId', () => {
  test('creates distinct document IDs', () => {
    expect(createDocumentId()).not.toBe(createDocumentId());
  });
});
