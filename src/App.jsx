import { useEffect, useRef, useState } from 'react';
import RSVPReader from './components/RSVPReader';
import DocumentEditor from './components/DocumentEditor';
import DocumentLibrary from './components/DocumentLibrary';
import DocumentView from './components/DocumentView';
import {
  createDocumentModel,
  positionToTokenIndex,
  tokenIndexToPosition,
} from './utils';
import {
  createDocumentId,
  deleteDocument as deleteStoredDocument,
  listDocuments,
  renameDocument as renameStoredDocument,
  saveDocument as saveStoredDocument,
} from './storage/documentLibrary';

const MODE_TRANSITION_DURATION = 800;
const CHAPTER_COMPLETION_STORAGE_KEY = 'stillpoint.chapterCompletionBehavior';
const CHAPTER_COMPLETION_BEHAVIORS = new Set(['ask', 'continue', 'return']);

const getInitialChapterCompletionBehavior = () => {
  try {
    const savedBehavior = window.localStorage.getItem(
      CHAPTER_COMPLETION_STORAGE_KEY
    );
    return CHAPTER_COMPLETION_BEHAVIORS.has(savedBehavior)
      ? savedBehavior
      : 'ask';
  } catch {
    return 'ask';
  }
};

const createEmptyDocument = () =>
  createDocumentModel('', { id: createDocumentId(), revision: 0 });

const getDocumentProgress = (documentModel, readingPosition) => {
  if (!documentModel.tokens.length) return 0;
  const tokenIndex = positionToTokenIndex(
    documentModel.tokens,
    readingPosition
  );
  return (tokenIndex + 1) / documentModel.tokens.length;
};

const toLibraryRecord = (documentModel, readingPosition) => ({
  id: documentModel.id,
  title: documentModel.title,
  source: {
    text: documentModel.source.text,
    format: documentModel.source.format,
    revision: documentModel.source.revision,
  },
  readingPosition,
  progress: getDocumentProgress(documentModel, readingPosition),
});

function App() {
  const [document, setDocument] = useState(createEmptyDocument);
  const [mode, setMode] = useState('loading');
  const [readingPosition, setReadingPosition] = useState(null);
  const [returnContext, setReturnContext] = useState(null);
  const [readingSessionId, setReadingSessionId] = useState(0);
  const [hasStartedImmersive, setHasStartedImmersive] = useState(false);
  const [chapterCompletionBehavior, setChapterCompletionBehavior] = useState(
    getInitialChapterCompletionBehavior
  );
  const [libraryDocuments, setLibraryDocuments] = useState([]);
  const [storageError, setStorageError] = useState(null);
  const returnSequenceRef = useRef(0);
  const exitTimerRef = useRef(null);
  const isExitingRef = useRef(false);

  const text = document.source.text;

  const refreshLibrary = async () => {
    const documents = await listDocuments();
    setLibraryDocuments(documents);
    return documents;
  };

  const reportStorageError = (error) => {
    setStorageError(
      error?.message || 'The local document library is unavailable.'
    );
  };

  const persistDocument = async (
    documentModel = document,
    position = readingPosition
  ) => {
    if (!documentModel.source.text.trim()) return null;

    try {
      const record = await saveStoredDocument(
        toLibraryRecord(documentModel, position)
      );
      await refreshLibrary();
      setStorageError(null);
      return record;
    } catch (error) {
      reportStorageError(error);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadLibrary = async () => {
      try {
        const documents = await listDocuments();
        if (cancelled) return;
        setLibraryDocuments(documents);
        setMode(documents.length ? 'library' : 'edit');
      } catch (error) {
        if (cancelled) return;
        reportStorageError(error);
        setMode('edit');
      }
    };

    loadLibrary();

    return () => {
      cancelled = true;
      window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  const updateChapterCompletionBehavior = (behavior) => {
    if (!CHAPTER_COMPLETION_BEHAVIORS.has(behavior)) return;
    setChapterCompletionBehavior(behavior);

    try {
      window.localStorage.setItem(CHAPTER_COMPLETION_STORAGE_KEY, behavior);
    } catch {
      // The setting remains active for this session if storage is unavailable.
    }
  };

  const saveDocument = (newText) => {
    let newDocument = createDocumentModel(newText, {
      id: document.id,
      title: document.title,
      sourceFormat: document.source.format,
      revision: document.source.revision + 1,
    });
    const inferredTitle = newDocument.sections.find(
      (section) => section.title
    )?.title;

    if (newDocument.title === 'Untitled document' && inferredTitle) {
      newDocument = { ...newDocument, title: inferredTitle };
    }

    const initialPosition = tokenIndexToPosition(newDocument.tokens, 0);
    setDocument(newDocument);
    setReadingPosition(initialPosition);
    setReturnContext(null);
    isExitingRef.current = false;
    setMode('document');
    persistDocument(newDocument, initialPosition);
  };

  const startReading = (position = readingPosition) => {
    if (!text.trim()) return;
    window.clearTimeout(exitTimerRef.current);
    isExitingRef.current = false;
    if (position) setReadingPosition(position);
    setReturnContext(null);
    setHasStartedImmersive(true);
    setReadingSessionId((sessionId) => sessionId + 1);
    setMode('immersive');
  };

  const exitReading = (position) => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;

    if (position) {
      setReadingPosition(position);
      returnSequenceRef.current += 1;
      setReturnContext({ id: returnSequenceRef.current, position });
      persistDocument(document, position);
    }

    setMode('returning');
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      isExitingRef.current = false;
      setMode('document');
    }, MODE_TRANSITION_DURATION);
  };

  const openLibraryDocument = async (record) => {
    const openedDocument = createDocumentModel(record.source.text, {
      id: record.id,
      title: record.title,
      sourceFormat: record.source.format,
      revision: record.source.revision,
    });
    const restoredTokenIndex = positionToTokenIndex(
      openedDocument.tokens,
      record.readingPosition
    );
    const restoredPosition = tokenIndexToPosition(
      openedDocument.tokens,
      restoredTokenIndex
    );

    setDocument(openedDocument);
    setReadingPosition(restoredPosition);
    setReturnContext(null);
    setMode('document');
    await persistDocument(openedDocument, restoredPosition);
  };

  const createNewDocument = () => {
    setDocument(createEmptyDocument());
    setReadingPosition(null);
    setReturnContext(null);
    setMode('edit');
  };

  const openLibrary = async () => {
    window.clearTimeout(exitTimerRef.current);
    isExitingRef.current = false;
    await persistDocument();
    setMode('library');
  };

  const renameLibraryDocument = async (id, title) => {
    try {
      await renameStoredDocument(id, title);
      if (document.id === id) setDocument((current) => ({ ...current, title }));
      await refreshLibrary();
      setStorageError(null);
    } catch (error) {
      reportStorageError(error);
    }
  };

  const deleteLibraryDocument = async (id) => {
    try {
      await deleteStoredDocument(id);
      const documents = await refreshLibrary();
      if (!documents.length) setDocument(createEmptyDocument());
      setStorageError(null);
    } catch (error) {
      reportStorageError(error);
    }
  };

  return (
    <main className="min-h-screen">
      {storageError && (
        <div
          role="alert"
          className="fixed inset-x-4 top-4 z-60 mx-auto flex max-w-2xl items-start justify-between gap-4 rounded-lg border border-error/40 bg-error/12 px-4 py-3 text-sm shadow-lg backdrop-blur-md"
        >
          <span>{storageError}</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setStorageError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {mode === 'loading' && (
        <section
          aria-label="Loading document library"
          className="flex min-h-screen items-center justify-center"
        >
          <span className="loading loading-spinner loading-lg text-primary" />
        </section>
      )}

      {mode === 'library' && (
        <DocumentLibrary
          documents={libraryDocuments}
          onOpen={openLibraryDocument}
          onCreate={createNewDocument}
          onRename={renameLibraryDocument}
          onDelete={deleteLibraryDocument}
        />
      )}

      {mode === 'edit' && (
        <DocumentEditor
          text={text}
          onSave={saveDocument}
          onCancel={
            text.trim()
              ? () => setMode('document')
              : libraryDocuments.length
                ? () => setMode('library')
                : null
          }
        />
      )}

      {(mode === 'document' ||
        mode === 'immersive' ||
        mode === 'returning') && (
        <DocumentView
          document={document}
          readingPosition={readingPosition}
          returnContext={returnContext}
          isImmersive={mode === 'immersive'}
          showEntryHint={!hasStartedImmersive}
          chapterCompletionBehavior={chapterCompletionBehavior}
          onChapterCompletionBehaviorChange={updateChapterCompletionBehavior}
          onLibrary={openLibrary}
          onEdit={() => setMode('edit')}
          onStartReading={startReading}
        />
      )}

      {(mode === 'immersive' || mode === 'returning') && (
        <RSVPReader
          key={readingSessionId}
          document={document}
          onDocumentChange={setDocument}
          readingPosition={readingPosition}
          onReadingPositionChange={setReadingPosition}
          chapterCompletionBehavior={chapterCompletionBehavior}
          onChapterCompletionBehaviorChange={updateChapterCompletionBehavior}
          isExiting={mode === 'returning'}
          onExit={exitReading}
        />
      )}
    </main>
  );
}

export default App;
