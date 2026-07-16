import { FastForward, Pause, Play, Rewind } from 'lucide-react';
import { useEffect, useState } from 'react';

const Toolbar = ({ engineRef }) => {
  const [wpm, setWpm] = useState(300);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const engine = engineRef.current;

    engine.onPlayStateChange = setIsPlaying;
    engine.onChangeWpm = setWpm;

    setIsPlaying(engine.isPlaying());
    setWpm(engine.getWpm());

    return () => {
      engine.onPlayStateChange = null;
      engine.onChangeWpm = null;
    };
  }, [engineRef]);

  const onChangeWpm = (event) => {
    engineRef.current.setWpm(Number(event.target.value));
  };

  return (
    <>
      <div className="pb-20 flex flex-col items-center">
        <div className="mb-5 flex items-center justify-center gap-3">
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => engineRef.current.rewind()}
            aria-label="Rewind"
          >
            <Rewind />
          </button>

          <button
            type="button"
            className="btn btn-soft btn-primary"
            onClick={() => engineRef.current.playToggle()}
          >
            {isPlaying ? <Pause /> : <Play />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            type="button"
            className="btn btn-soft"
            onClick={() => engineRef.current.skipForward()}
            aria-label="Skip forward"
          >
            <FastForward />
          </button>
        </div>

        <div className="w-full max-w-xs">
          <input
            type="range"
            min="100"
            max="800"
            step="10"
            value={wpm}
            onChange={onChangeWpm}
            className="range"
            aria-label="Reading speed"
          />

          <div className="mt-2 flex justify-between px-0 text-xs">
            <span>100</span>
            <span>{wpm} WPM</span>
            <span>800</span>
          </div>
        </div>
      </div>

      <KeyboardHints wpm={wpm} />
    </>
  );
};

const KeyboardHints = ({ wpm }) => {
  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl border border-base-300 bg-base-100/80 px-4 py-3 text-xs text-base-content/60 shadow-sm backdrop-blur-md">
        <span className="flex items-center gap-2">
          <kbd className="kbd kbd-sm">←</kbd>
          Rewind
        </span>

        <span className="flex items-center gap-2">
          <kbd className="kbd kbd-sm">→</kbd>
          Forward
        </span>

        <span className="flex items-center gap-2">
          <kbd className="kbd kbd-sm">↑</kbd>
          Faster
        </span>

        <span className="flex items-center gap-2">
          <kbd className="kbd kbd-sm">↓</kbd>
          Slower
        </span>

        <span className="flex items-center gap-2">
          <kbd className="kbd kbd-sm">Esc</kbd>
          Exit
        </span>

        <span className="flex items-center gap-2">
          <kbd className="kbd kbd-sm">C</kbd>
          Continue
        </span>

        <span className="font-mono text-base-content/80">{wpm} WPM</span>
      </div>
    </div>
  );
};

export default Toolbar;
