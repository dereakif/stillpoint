import { useRef, useState, useEffect } from 'react';
import { createRSVPPlayer } from '../utils';
import WordDisplay from './WordDisplay';
import Toolbar from './Toolbar';

const RSVPReader = ({
  text,
  setText,
  readingPosition,
  onReadingPositionChange,
  onExit,
}) => {
  const engineRef = useRef(null);
  const readerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const playTimerRef = useRef(null);

  const [countdown, setCountdown] = useState(3);
  const [isReady, setIsReady] = useState(false);

  if (engineRef.current === null) {
    engineRef.current = createRSVPPlayer(text, {
      baseWpm: 300,
      initialPosition: readingPosition,
    });
  }

  const clearCountdownTimers = () => {
    window.clearInterval(countdownTimerRef.current);
    window.clearTimeout(playTimerRef.current);
    countdownTimerRef.current = null;
    playTimerRef.current = null;
  };

  const startCountdown = ({ skipCountdown = false } = {}) => {
    const engine = engineRef.current;
    if (!engine) return;

    clearCountdownTimers();
    engine.pause();
    engine.preview();

    if (skipCountdown) {
      playTimerRef.current = window.setTimeout(() => {
        playTimerRef.current = null;
        engine.play();
      }, 700);
      return;
    }

    setIsReady(false);
    setCountdown(3);

    let currentCount = 3;

    countdownTimerRef.current = window.setInterval(() => {
      currentCount -= 1;

      if (currentCount === 0) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;

        setCountdown(null);
        setIsReady(true);

        playTimerRef.current = window.setTimeout(() => {
          playTimerRef.current = null;
          engine.play();
        }, 700);

        return;
      }

      setCountdown(currentCount);
    }, 1000);
  };

  const loadClipboard = async () => {
    try {
      const newText = await navigator.clipboard.readText();

      if (!newText.trim()) return;

      setText(newText);

      engineRef.current.loadText(newText);
      startCountdown();
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    const engine = engineRef.current;
    return engine.subscribe('positionChange', onReadingPositionChange);
  }, [onReadingPositionChange]);

  useEffect(() => {
    readerRef.current?.focus();
    startCountdown();

    return () => {
      clearCountdownTimers();
      engineRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = async (event) => {
      const engine = engineRef.current;
      if (!engine) return;

      const target = event.target;
      const isFormControl =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (event.key === 'Escape') {
        event.preventDefault();
        engine.pause();
        onExit();
        return;
      }

      if (!isReady || isFormControl) return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          engine.playToggle();
          break;

        case 'ArrowLeft':
          event.preventDefault();
          engine.rewind();
          break;

        case 'ArrowRight':
          event.preventDefault();
          engine.skipForward();
          break;

        case 'ArrowUp':
          event.preventDefault();
          engine.setWpm(engine.getWpm() + 10);
          break;

        case 'ArrowDown':
          event.preventDefault();
          engine.setWpm(engine.getWpm() - 10);
          break;

        case 'c':
        case 'C':
          event.preventDefault();
          await loadClipboard();
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, onExit]);

  return (
    <section
      ref={readerRef}
      tabIndex={-1}
      aria-label="Immersive reading mode"
      className="relative flex min-h-screen flex-col outline-none caret-transparent"
    >
      <button
        type="button"
        className="absolute btn btn-soft right-6 top-6 z-30"
        onClick={onExit}
      >
        Exit
      </button>

      <div
        data-testid="immersive-content"
        className={`flex flex-1 items-center justify-center transition-all duration-700 motion-reduce:transition-none ${
          isReady
            ? 'scale-100 opacity-100 blur-0'
            : 'scale-95 opacity-30 blur-sm'
        }`}
      >
        <WordDisplay engineRef={engineRef} />
      </div>

      {countdown !== null && (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/30 backdrop-blur-[2px]"
          aria-live="assertive"
        >
          <span
            key={countdown}
            className="text-7xl font-medium text-primary/70"
          >
            {countdown}
          </span>
        </div>
      )}

      {isReady && <Toolbar engineRef={engineRef} />}
    </section>
  );
};

export default RSVPReader;
