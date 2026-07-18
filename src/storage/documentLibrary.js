const DATABASE_NAME = 'stillpoint-library';
const DATABASE_VERSION = 1;
const DOCUMENT_STORE = 'documents';
export const DOCUMENT_SCHEMA_VERSION = 2;

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

export const normalizeDocumentRecord = (record) => {
  if (!record) return record;

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
    wpm: Number.isFinite(wpm) ? Math.max(100, Math.min(800, wpm)) : 300,
    navigationScrollY:
      Number.isFinite(navigationScrollY) && navigationScrollY > 0
        ? navigationScrollY
        : 0,
  };

  return {
    ...record,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    readingPosition: readingSession.position,
    readingSession,
  };
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
