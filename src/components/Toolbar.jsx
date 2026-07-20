import { BookOpen, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  MAX_READING_WPM,
  MIN_READING_WPM,
  READING_WPM_STEP,
} from '../readingSpeed';

const Toolbar = ({ engineRef, isContextVisible, onContextToggle }) => {
  const [wpm, setWpm] = useState(300);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const engine = engineRef.current;

    const unsubscribePlayState = engine.subscribe(
      'playStateChange',
      setIsPlaying
    );
    const unsubscribeWpm = engine.subscribe('wpmChange', setWpm);

    setIsPlaying(engine.isPlaying());
    setWpm(engine.getWpm());

    return () => {
      unsubscribePlayState();
      unsubscribeWpm();
    };
  }, [engineRef]);

  const onChangeWpm = (event) => {
    engineRef.current.setWpm(Number(event.target.value));
  };

  return (
    <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
      <div className="mb-5 flex flex-col items-center">
        <div className="mb-5 flex items-center justify-center gap-3">
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => engineRef.current.previousSentence()}
            aria-label="Previous sentence"
          >
            <SkipBack />
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
            onClick={() => engineRef.current.nextSentence()}
            aria-label="Next sentence"
          >
            <SkipForward />
          </button>

          {!isPlaying && (
            <button
              type="button"
              className={`btn btn-soft ${isContextVisible ? 'btn-primary' : ''}`}
              aria-pressed={isContextVisible}
              onClick={onContextToggle}
            >
              <BookOpen className="size-4" />
              Context
            </button>
          )}
        </div>

        <div className="w-full max-w-xs">
          <input
            type="range"
            min={MIN_READING_WPM}
            max={MAX_READING_WPM}
            step={READING_WPM_STEP}
            value={wpm}
            onChange={onChangeWpm}
            className="range"
            aria-label="Reading speed"
          />

          <div className="mt-2 flex justify-between px-0 text-xs">
            <span>{MIN_READING_WPM}</span>
            <span>{wpm} WPM</span>
            <span>{MAX_READING_WPM}</span>
          </div>
        </div>
      </div>

      <KeyboardHints wpm={wpm} isPlaying={isPlaying} />
    </div>
  );
};

const KeyboardHints = ({ wpm, isPlaying }) => {
  return (
    <div className="pointer-events-none flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl border border-base-300 bg-base-100/80 px-4 py-3 text-xs text-base-content/60 shadow-sm backdrop-blur-md">
      <span className="flex items-center gap-2">
        <kbd className="kbd kbd-sm">←</kbd>
        Previous sentence
      </span>

      <span className="flex items-center gap-2">
        <kbd className="kbd kbd-sm">→</kbd>
        Next sentence
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

      {!isPlaying && (
        <span className="flex items-center gap-2">
          <kbd className="kbd kbd-sm">C</kbd>
          Hold for context
        </span>
      )}

      <span className="font-mono text-base-content/80">{wpm} WPM</span>
    </div>
  );
};

export default Toolbar;
