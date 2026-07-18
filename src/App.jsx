import { useRef, useState } from 'react';
import RSVPReader from './components/RSVPReader';
import DocumentEditor from './components/DocumentEditor';
import DocumentView from './components/DocumentView';

function App() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('edit');
  const [readingPosition, setReadingPosition] = useState(null);
  const [returnContext, setReturnContext] = useState(null);
  const returnSequenceRef = useRef(0);

  const saveDocument = (newText) => {
    setText(newText);
    setReadingPosition({ blockId: 'paragraph-1', tokenOffset: 0 });
    setReturnContext(null);
    setMode('document');
  };

  const startReading = (position = readingPosition) => {
    if (!text.trim()) return;
    if (position) setReadingPosition(position);
    setReturnContext(null);
    setMode('immersive');
  };

  const exitReading = (position) => {
    if (position) {
      setReadingPosition(position);
      returnSequenceRef.current += 1;
      setReturnContext({ id: returnSequenceRef.current, position });
    }
    setMode('document');
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

      {mode === 'document' && (
        <DocumentView
          text={text}
          readingPosition={readingPosition}
          returnContext={returnContext}
          onEdit={() => setMode('edit')}
          onStartReading={startReading}
        />
      )}

      {mode === 'immersive' && (
        <RSVPReader
          text={text}
          setText={setText}
          readingPosition={readingPosition}
          onReadingPositionChange={setReadingPosition}
          onExit={exitReading}
        />
      )}
    </main>
  );
}

export default App;
