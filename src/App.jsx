import { useState } from 'react';
import RSVPReader from './components/RSVPReader';
import DocumentView from './components/DocumentView';

function App() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('document');

  const startReading = () => {
    if (!text.trim()) return;
    setMode('immersive');
  };

  const exitReading = () => {
    setMode('document');
  };

  return (
    <main className="min-h-screen">
      {mode === 'document' && (
        <DocumentView
          text={text}
          setText={setText}
          onStartReading={startReading}
        />
      )}

      {mode === 'immersive' && (
        <RSVPReader
          text={text}
          setText={setText}
          onStartReading={startReading}
          onExit={exitReading}
        />
      )}
    </main>
  );
}

export default App;
