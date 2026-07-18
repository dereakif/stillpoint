import { useState } from 'react';
import RSVPReader from './components/RSVPReader';
import DocumentEditor from './components/DocumentEditor';
import DocumentView from './components/DocumentView';

function App() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('edit');

  const saveDocument = (newText) => {
    setText(newText);
    setMode('document');
  };

  const startReading = () => {
    if (!text.trim()) return;
    setMode('immersive');
  };

  const exitReading = () => {
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
          onEdit={() => setMode('edit')}
          onStartReading={startReading}
        />
      )}

      {mode === 'immersive' && (
        <RSVPReader text={text} setText={setText} onExit={exitReading} />
      )}
    </main>
  );
}

export default App;
