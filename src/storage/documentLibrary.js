import { clampReadingWpm } from '../readingSpeed';

const DATABASE_NAME = 'stillpoint-library';
const DATABASE_VERSION = 1;
const DOCUMENT_STORE = 'documents';
export const DOCUMENT_SCHEMA_VERSION = 3;

const DEFAULT_READING_SESSION = Object.freeze({
  position: null,
  completedChapterIds: [],
  wpm: 300,
  navigationScrollY: 0,
});

export class DocumentStorageError extends Error {
  constructor(message, code = 'unknown', cause) {
    super(message, { cause });
    this.name = 'DocumentStorageError';
    this.code = code;
  }
}

export const toDocumentStorageError = (error) => {
  if (error instanceof DocumentStorageError) return error;

  const code =
    error?.name === 'QuotaExceededError'
      ? 'quota-exceeded'
      : error?.name === 'SecurityError' || error?.name === 'NotAllowedError'
        ? 'unavailable'
        : 'unknown';
  const message =
    code === 'quota-exceeded'
      ? 'Browser storage is full. Export a backup or remove documents before saving again.'
      : code === 'unavailable'
        ? 'Local document storage is unavailable in this browser context.'
        : 'Stillpoint could not access the local document library.';

  return new DocumentStorageError(message, code, error);
};

const requestResult = (request) =>
  new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      'error',
      () => reject(toDocumentStorageError(request.error)),
      { once: true }
    );
  });

const transactionComplete = (transaction) =>
  new Promise((resolve, reject) => {
    transaction.addEventListener('complete', resolve, { once: true });
    transaction.addEventListener(
      'abort',
      () => reject(toDocumentStorageError(transaction.error)),
      { once: true }
    );
    transaction.addEventListener(
      'error',
      () => reject(toDocumentStorageError(transaction.error)),
      { once: true }
    );
  });

const openDatabase = () => {
  if (!globalThis.indexedDB) {
    return Promise.reject(
      new DocumentStorageError(
        'Local document storage is unavailable in this browser context.',
        'unavailable'
      )
    );
  }

  return new Promise((resolve, reject) => {
    let request;

    try {
      request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(toDocumentStorageError(error));
      return;
    }

    request.addEventListener(
      'upgradeneeded',
      () => {
        const database = request.result;
        if (database.objectStoreNames.contains(DOCUMENT_STORE)) return;

        const store = database.createObjectStore(DOCUMENT_STORE, {
          keyPath: 'id',
        });
        store.createIndex('lastOpenedAt', 'lastOpenedAt');
      },
      { once: true }
    );
    request.addEventListener('success', () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      'error',
      () => reject(toDocumentStorageError(request.error)),
      { once: true }
    );
    request.addEventListener(
      'blocked',
      () =>
        reject(
          new DocumentStorageError(
            'Another Stillpoint tab is blocking a local-library upgrade.',
            'blocked'
          )
        ),
      { once: true }
    );
  });
};

const withStore = async (mode, operation) => {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(DOCUMENT_STORE, mode);
    const store = transaction.objectStore(DOCUMENT_STORE);
    const result = await operation(store);
    await transactionComplete(transaction);
    return result;
  } catch (error) {
    throw toDocumentStorageError(error);
  } finally {
    database.close();
  }
};

const normalizeOptionalString = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const normalizeEpubRecord = (record) => {
  const source = record.source ?? {};
  const file = source.file ?? record.file ?? null;
  const fileName =
    normalizeOptionalString(source.fileName) ??
    normalizeOptionalString(file?.name) ??
    'Untitled.epub';
  const mediaType =
    normalizeOptionalString(source.mediaType) ??
    normalizeOptionalString(file?.type) ??
    'application/epub+zip';
  const authors = Array.isArray(record.authors)
    ? [...new Set(record.authors.map(normalizeOptionalString).filter(Boolean))]
    : [];
  const savedReading = record.reading ?? {};
  const savedPercentage = Number(
    savedReading.percentage ?? record.progress ?? 0
  );
  const percentage = Number.isFinite(savedPercentage)
    ? Math.min(1, Math.max(0, savedPercentage))
    : 0;
  const epubRecord = { ...record };
  delete epubRecord.file;
  delete epubRecord.fileName;
  delete epubRecord.mediaType;
  delete epubRecord.readingPosition;
  delete epubRecord.readingSession;

  return {
    ...epubRecord,
    kind: 'epub',
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    source: {
      ...source,
      file,
      fileName,
      mediaType,
    },
    authors,
    reading: {
      cfi: normalizeOptionalString(savedReading.cfi),
      percentage,
      chapterLabel: normalizeOptionalString(savedReading.chapterLabel),
    },
    progress: percentage,
  };
};

const normalizeTextRecord = (record) => {
  const savedSession = record.readingSession ?? {};
  const completedChapterIds = Array.isArray(savedSession.completedChapterIds)
    ? [...new Set(savedSession.completedChapterIds.filter(Boolean))]
    : [];
  const wpm = Number(savedSession.wpm);
  const navigationScrollY = Number(savedSession.navigationScrollY);
  const readingSession = {
    ...DEFAULT_READING_SESSION,
    ...savedSession,
    position: savedSession.position ?? record.readingPosition ?? null,
    completedChapterIds,
    wpm: clampReadingWpm(wpm),
    navigationScrollY:
      Number.isFinite(navigationScrollY) && navigationScrollY > 0
        ? navigationScrollY
        : 0,
  };

  return {
    ...record,
    kind: 'text',
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    readingPosition: readingSession.position,
    readingSession,
  };
};

export const normalizeDocumentRecord = (record) => {
  if (!record) return record;
  return record.kind === 'epub'
    ? normalizeEpubRecord(record)
    : normalizeTextRecord(record);
};

export const listDocuments = async () => {
  const documents = await withStore('readonly', (store) =>
    requestResult(store.getAll())
  );

  return documents
    .map(normalizeDocumentRecord)
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt);
};

export const getDocument = async (id) =>
  normalizeDocumentRecord(
    await withStore('readonly', (store) => requestResult(store.get(id)))
  );

export const saveDocument = async (documentRecord) => {
  const existing = await getDocument(documentRecord.id);
  const now = Date.now();
  const record = normalizeDocumentRecord({
    ...existing,
    ...documentRecord,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastOpenedAt: documentRecord.lastOpenedAt ?? now,
  });

  await withStore('readwrite', (store) => requestResult(store.put(record)));
  return record;
};

export const renameDocument = async (id, title) => {
  const existing = await getDocument(id);
  if (!existing) {
    throw new DocumentStorageError(
      'The document no longer exists.',
      'not-found'
    );
  }

  return saveDocument({ ...existing, title: title.trim() });
};

export const deleteDocument = (id) =>
  withStore('readwrite', (store) => requestResult(store.delete(id)));

export const createDocumentId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `document-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isBlob = (value) =>
  value != null &&
  typeof value.arrayBuffer === 'function' &&
  typeof value.size === 'number' &&
  typeof value.type === 'string';

const titleFromFileName = (fileName) =>
  fileName.replace(/\.epub$/i, '').trim() || 'Untitled';

export const createEpubDocumentRecord = (file, overrides = {}) => {
  if (!isBlob(file)) {
    throw new TypeError('An EPUB Blob or File is required.');
  }

  const overrideSource = overrides.source ?? {};
  const fileName =
    normalizeOptionalString(overrideSource.fileName) ??
    normalizeOptionalString(overrides.fileName) ??
    normalizeOptionalString(file.name);
  const mediaType =
    normalizeOptionalString(overrideSource.mediaType) ??
    normalizeOptionalString(file.type);

  if (!fileName) {
    throw new TypeError('An EPUB filename is required.');
  }
  if (!/\.epub$/i.test(fileName) && mediaType !== 'application/epub+zip') {
    throw new TypeError('The selected file is not an EPUB.');
  }

  return normalizeDocumentRecord({
    ...overrides,
    id: overrides.id ?? createDocumentId(),
    kind: 'epub',
    title:
      normalizeOptionalString(overrides.title) ?? titleFromFileName(fileName),
    source: {
      ...overrideSource,
      file,
      fileName,
      mediaType: mediaType ?? 'application/epub+zip',
    },
  });
};

export const saveEpubDocument = (file, overrides) =>
  saveDocument(createEpubDocumentRecord(file, overrides));

export const updateEpubReading = async (id, reading) => {
  const existing = await getDocument(id);
  if (!existing) {
    throw new DocumentStorageError(
      'The document no longer exists.',
      'not-found'
    );
  }
  if (existing.kind !== 'epub') {
    throw new DocumentStorageError(
      'The document is not an EPUB.',
      'invalid-kind'
    );
  }

  return saveDocument({
    ...existing,
    reading: { ...existing.reading, ...reading },
  });
};
