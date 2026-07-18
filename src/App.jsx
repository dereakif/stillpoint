import { useEffect, useRef, useState } from 'react';
import RSVPReader from './components/RSVPReader';
import DocumentEditor from './components/DocumentEditor';
import DocumentView from './components/DocumentView';
import { createDocumentModel, tokenIndexToPosition } from './utils';

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

function App() {
  const [document, setDocument] = useState(() =>
    createDocumentModel('', { revision: 0 })
  );
  const [mode, setMode] = useState('edit');
  const [readingPosition, setReadingPosition] = useState(null);
  const [returnContext, setReturnContext] = useState(null);
  const [readingSessionId, setReadingSessionId] = useState(0);
  const [hasStartedImmersive, setHasStartedImmersive] = useState(false);
  const [chapterCompletionBehavior, setChapterCompletionBehavior] = useState(
    getInitialChapterCompletionBehavior
  );
  const returnSequenceRef = useRef(0);
  const exitTimerRef = useRef(null);
  const isExitingRef = useRef(false);

  useEffect(
    () => () => {
      window.clearTimeout(exitTimerRef.current);
    },
    []
  );

  const text = document.source.text;

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
    const newDocument = createDocumentModel(newText, {
      id: document.id,
      title: document.title,
      sourceFormat: document.source.format,
      revision: document.source.revision + 1,
    });

    setDocument(newDocument);
    setReadingPosition(tokenIndexToPosition(newDocument.tokens, 0));
    setReturnContext(null);
    isExitingRef.current = false;
    setMode('document');
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
    }

    setMode('returning');
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      isExitingRef.current = false;
      setMode('document');
    }, MODE_TRANSITION_DURATION);
  };

  return (
    <main className="min-h-screen">
      {mode === 'edit' && (
        <DocumentEditor
          text={text}
          onSave={saveDocument}
          onCancel={text.trim() ? () => setMode('document') : null}
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
