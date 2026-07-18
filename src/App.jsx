import { useEffect, useRef, useState } from 'react';
import RSVPReader from './components/RSVPReader';
import DocumentEditor from './components/DocumentEditor';
import DocumentView from './components/DocumentView';

const MODE_TRANSITION_DURATION = 800;

function App() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('edit');
  const [readingPosition, setReadingPosition] = useState(null);
  const [returnContext, setReturnContext] = useState(null);
  const [readingSessionId, setReadingSessionId] = useState(0);
  const returnSequenceRef = useRef(0);
  const exitTimerRef = useRef(null);
  const isExitingRef = useRef(false);

  useEffect(
    () => () => {
      window.clearTimeout(exitTimerRef.current);
    },
    []
  );

  const saveDocument = (newText) => {
    setText(newText);
    setReadingPosition({ blockId: 'paragraph-1', tokenOffset: 0 });
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
          text={text}
          readingPosition={readingPosition}
          returnContext={returnContext}
          isImmersive={mode === 'immersive'}
          onEdit={() => setMode('edit')}
          onStartReading={startReading}
        />
      )}

      {(mode === 'immersive' || mode === 'returning') && (
        <RSVPReader
          key={readingSessionId}
          text={text}
          setText={setText}
          readingPosition={readingPosition}
          onReadingPositionChange={setReadingPosition}
          isExiting={mode === 'returning'}
          onExit={exitReading}
        />
      )}
    </main>
  );
}

export default App;
