import { useEffect, useRef, useState } from 'react';
import RSVPReader from './components/RSVPReader';
import DocumentEditor from './components/DocumentEditor';
import DocumentLibrary from './components/DocumentLibrary';
import DocumentView from './components/DocumentView';
import ReadingCalibration from './components/ReadingCalibration';
import ReadingSettings from './components/ReadingSettings';
import AppearanceSettings from './components/AppearanceSettings';
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
import {
  completeCalibration,
  dismissRecalibrationPrompts,
  loadCalibrationProfile,
  postponeRecalibration,
  recordReadingActivity,
  saveCalibrationProfile,
  shouldOfferRecalibration,
  skipInitialCalibration,
} from './storage/calibration';
import {
  READING_SETTINGS_STORAGE_KEY,
  loadReadingSettings,
  saveReadingSettings,
} from './storage/readingSettings';
import {
  loadAppearanceSettings,
  saveAppearanceSettings,
} from './storage/appearanceSettings';

const MODE_TRANSITION_DURATION = 800;
const SESSION_WRITE_DEBOUNCE = 1500;
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

const toLibraryRecord = (documentModel, readingSession) => ({
  id: documentModel.id,
  title: documentModel.title,
  source: {
    text: documentModel.source.text,
    format: documentModel.source.format,
    revision: documentModel.source.revision,
  },
  readingPosition: readingSession.position,
  readingSession,
  progress: getDocumentProgress(documentModel, readingSession.position),
});

function App() {
  const [document, setDocument] = useState(createEmptyDocument);
  const [mode, setMode] = useState('loading');
  const [readingPosition, setReadingPosition] = useState(null);
  const [completedChapterIds, setCompletedChapterIds] = useState([]);
  const [calibrationProfile, setCalibrationProfile] = useState(
    loadCalibrationProfile
  );
  const [calibrationMode, setCalibrationMode] = useState(null);
  const [isReadingSettingsOpen, setIsReadingSettingsOpen] = useState(false);
  const [isAppearanceSettingsOpen, setIsAppearanceSettingsOpen] =
    useState(false);
  const [appearanceSettings, setAppearanceSettings] = useState(
    loadAppearanceSettings
  );
  const [readingSettings, setReadingSettings] = useState(() => {
    const loadedSettings = loadReadingSettings();
    try {
      if (
        !window.localStorage.getItem(READING_SETTINGS_STORAGE_KEY) &&
        calibrationProfile.currentRecommendation
      ) {
        return saveReadingSettings({
          ...loadedSettings,
          wpm: calibrationProfile.currentRecommendation,
        });
      }
    } catch {
      // The in-memory settings fallback remains available.
    }
    return loadedSettings;
  });
  const [wpm, setWpm] = useState(() => readingSettings.wpm);
  const [navigationScrollY, setNavigationScrollY] = useState(0);
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
  const sessionWriteTimerRef = useRef(null);
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
    session = {
      position: readingPosition,
      completedChapterIds,
      wpm,
      navigationScrollY,
    }
  ) => {
    if (!documentModel.source.text.trim()) return null;

    try {
      const record = await saveStoredDocument(
        toLibraryRecord(documentModel, session)
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
      window.clearTimeout(sessionWriteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.dataset.theme = appearanceSettings.theme;
    root.dataset.orpAccent = appearanceSettings.orpAccent;
    root.dataset.reducedEffects = String(appearanceSettings.reducedEffects);
  }, [appearanceSettings]);

  useEffect(() => {
    window.clearTimeout(sessionWriteTimerRef.current);
    if (!document.source.text.trim() || !readingPosition) return undefined;

    sessionWriteTimerRef.current = window.setTimeout(() => {
      sessionWriteTimerRef.current = null;
      persistDocument(document, {
        position: readingPosition,
        completedChapterIds,
        wpm,
        navigationScrollY,
      });
    }, SESSION_WRITE_DEBOUNCE);

    return () => window.clearTimeout(sessionWriteTimerRef.current);
    // Persist a quiet snapshot rather than writing on every displayed word.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [document, readingPosition, completedChapterIds, wpm, navigationScrollY]);

  const updateCalibrationProfile = (profile) => {
    const savedProfile = saveCalibrationProfile(profile);
    setCalibrationProfile(savedProfile);
    return savedProfile;
  };

  const updateReadingWpm = (nextWpm) => {
    setWpm(nextWpm);
    setReadingSettings((current) =>
      saveReadingSettings({ ...current, wpm: nextWpm })
    );
  };

  const applyAppearanceSettings = (nextSettings) => {
    const savedSettings = saveAppearanceSettings(nextSettings);
    setAppearanceSettings(savedSettings);
    setIsAppearanceSettingsOpen(false);
  };

  const applyReadingSettings = (nextSettings) => {
    const savedSettings = saveReadingSettings(nextSettings);
    setReadingSettings(savedSettings);
    setWpm(savedSettings.wpm);
    setIsReadingSettingsOpen(false);
    persistDocument(document, {
      position: readingPosition,
      completedChapterIds,
      wpm: savedSettings.wpm,
      navigationScrollY,
    });
  };

  const applyCalibration = (result, acceptedWpm) => {
    const profile = updateCalibrationProfile(
      completeCalibration(calibrationProfile, result, acceptedWpm)
    );
    updateReadingWpm(profile.currentRecommendation ?? wpm);
    setCalibrationMode(null);
  };

  const skipCalibration = () => {
    updateCalibrationProfile(skipInitialCalibration(calibrationProfile));
    setCalibrationMode(null);
  };

  const postponeCalibration = () => {
    updateCalibrationProfile(postponeRecalibration(calibrationProfile));
    setCalibrationMode(null);
  };

  const dismissCalibrationPrompts = () => {
    updateCalibrationProfile(dismissRecalibrationPrompts(calibrationProfile));
    setCalibrationMode(null);
  };

  const recordSessionActivity = (activity) => {
    updateCalibrationProfile(
      recordReadingActivity(calibrationProfile, activity)
    );
  };

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
    setCompletedChapterIds([]);
    setNavigationScrollY(0);
    setReturnContext(null);
    isExitingRef.current = false;
    setMode('document');
    persistDocument(newDocument, {
      position: initialPosition,
      completedChapterIds: [],
      wpm,
      navigationScrollY: 0,
    });
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
      persistDocument(document, {
        position,
        completedChapterIds,
        wpm,
        navigationScrollY,
      });
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
    const savedSession = record.readingSession ?? {};
    const restoredTokenIndex = positionToTokenIndex(
      openedDocument.tokens,
      savedSession.position ?? record.readingPosition
    );
    const restoredPosition = tokenIndexToPosition(
      openedDocument.tokens,
      restoredTokenIndex
    );

    const sectionIds = new Set(
      openedDocument.sections.map((section) => section.id)
    );
    const restoredCompletedChapterIds = (
      savedSession.completedChapterIds ?? []
    ).filter((id) => sectionIds.has(id));
    const restoredWpm = Number.isFinite(savedSession.wpm)
      ? savedSession.wpm
      : 300;
    const restoredScrollY = Number.isFinite(savedSession.navigationScrollY)
      ? Math.max(0, savedSession.navigationScrollY)
      : 0;

    if (restoredScrollY > 0) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`
      );
    }

    setDocument(openedDocument);
    setReadingPosition(restoredPosition);
    setCompletedChapterIds(restoredCompletedChapterIds);
    updateReadingWpm(restoredWpm);
    setNavigationScrollY(restoredScrollY);
    setReturnContext(null);
    setMode('document');
    await persistDocument(openedDocument, {
      position: restoredPosition,
      completedChapterIds: restoredCompletedChapterIds,
      wpm: restoredWpm,
      navigationScrollY: restoredScrollY,
    });
  };

  const createNewDocument = () => {
    setDocument(createEmptyDocument());
    setReadingPosition(null);
    setCompletedChapterIds([]);
    setWpm(readingSettings.wpm);
    setNavigationScrollY(0);
    setReturnContext(null);
    setMode('edit');
  };

  const openLibrary = async () => {
    window.clearTimeout(exitTimerRef.current);
    isExitingRef.current = false;
    await persistDocument(document, {
      position: readingPosition,
      completedChapterIds,
      wpm,
      navigationScrollY,
    });
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
          calibrationOffer={
            calibrationProfile.status === 'new'
              ? 'first-run'
              : shouldOfferRecalibration(calibrationProfile)
                ? 'periodic'
                : null
          }
          currentWpm={wpm}
          appearanceSettings={appearanceSettings}
          onReadingSettings={() => setIsReadingSettingsOpen(true)}
          onAppearanceSettings={() => setIsAppearanceSettingsOpen(true)}
          onCalibrate={() =>
            setCalibrationMode(
              calibrationProfile.status === 'new' ? 'first-run' : 'explicit'
            )
          }
          onSkipCalibration={skipCalibration}
          onPostponeCalibration={postponeCalibration}
          onDismissCalibrationPrompts={dismissCalibrationPrompts}
          navigationScrollY={navigationScrollY}
          onNavigationScrollChange={setNavigationScrollY}
          onLibrary={openLibrary}
          onEdit={() => setMode('edit')}
          onStartReading={startReading}
        />
      )}

      {isAppearanceSettingsOpen && (
        <AppearanceSettings
          settings={appearanceSettings}
          onApply={applyAppearanceSettings}
          onClose={() => setIsAppearanceSettingsOpen(false)}
        />
      )}

      {isReadingSettingsOpen && (
        <ReadingSettings
          settings={{ ...readingSettings, wpm }}
          onApply={applyReadingSettings}
          onClose={() => setIsReadingSettingsOpen(false)}
          onRecalibrate={() => {
            setIsReadingSettingsOpen(false);
            setCalibrationMode('explicit');
          }}
        />
      )}

      {calibrationMode && (
        <ReadingCalibration
          mode={calibrationMode}
          currentWpm={wpm}
          previousRecommendation={calibrationProfile.currentRecommendation}
          onApply={applyCalibration}
          onSkip={skipCalibration}
          onPostpone={postponeCalibration}
          onDismissPrompts={dismissCalibrationPrompts}
          onClose={() => setCalibrationMode(null)}
        />
      )}

      {(mode === 'immersive' || mode === 'returning') && (
        <RSVPReader
          key={readingSessionId}
          document={document}
          onDocumentChange={(newDocument) => {
            setDocument(newDocument);
            setCompletedChapterIds([]);
            setNavigationScrollY(0);
          }}
          readingPosition={readingPosition}
          onReadingPositionChange={setReadingPosition}
          initialWpm={wpm}
          readingSettings={readingSettings}
          appearanceSettings={appearanceSettings}
          onWpmChange={updateReadingWpm}
          completedChapterIds={completedChapterIds}
          onChapterComplete={(chapterId) =>
            setCompletedChapterIds((current) =>
              current.includes(chapterId) ? current : [...current, chapterId]
            )
          }
          onReadingActivity={recordSessionActivity}
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
