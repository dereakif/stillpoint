import { describe, expect, test } from 'bun:test';
import {
  DocumentStorageError,
  createDocumentId,
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

describe('createDocumentId', () => {
  test('creates distinct document IDs', () => {
    expect(createDocumentId()).not.toBe(createDocumentId());
  });
});
