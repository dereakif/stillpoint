import { useRef, useState, useEffect } from 'react';
import { createDocumentModel, createRSVPPlayer } from '../utils';
import WordDisplay from './WordDisplay';
import Toolbar from './Toolbar';
import ChapterBoundary from './ChapterBoundary';

const RSVPReader = ({
  document,
  onDocumentChange,
  readingPosition,
  onReadingPositionChange,
  isExiting = false,
  onExit,
}) => {
  const engineRef = useRef(null);
  const readerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const playTimerRef = useRef(null);
  const entryFrameRef = useRef(null);

  const [countdown, setCountdown] = useState(3);
  const [isReady, setIsReady] = useState(false);
  const [isEntered, setIsEntered] = useState(false);
  const [chapterBoundary, setChapterBoundary] = useState(null);

  if (engineRef.current === null) {
    engineRef.current = createRSVPPlayer(document, {
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

  const exitImmersiveMode = () => {
    const engine = engineRef.current;
    if (!engine || isExiting) return;

    engine.pause();
    clearCountdownTimers();
    onExit(engine.getState().position);
  };

  const loadClipboard = async () => {
    try {
      const newText = await navigator.clipboard.readText();

      if (!newText.trim()) return;

      const newDocument = createDocumentModel(newText, {
        id: document.id,
        title: document.title,
        sourceFormat: document.source.format,
        revision: document.source.revision + 1,
      });

      onDocumentChange(newDocument);
      setChapterBoundary(null);
      engineRef.current.loadDocument(newDocument);
      startCountdown();
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    const engine = engineRef.current;
    const unsubscribePosition = engine.subscribe(
      'positionChange',
      onReadingPositionChange
    );
    const unsubscribeChapterComplete = engine.subscribe(
      'chapterComplete',
      setChapterBoundary
    );

    return () => {
      unsubscribePosition();
      unsubscribeChapterComplete();
    };
  }, [onReadingPositionChange]);

  useEffect(() => {
    readerRef.current?.focus();
    entryFrameRef.current = window.requestAnimationFrame(() => {
      entryFrameRef.current = null;
      setIsEntered(true);
    });
    startCountdown();

    return () => {
      window.cancelAnimationFrame(entryFrameRef.current);
      clearCountdownTimers();
      engineRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = async (event) => {
      const engine = engineRef.current;
      if (!engine || isExiting) return;

      const target = event.target;
      const isFormControl =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement;

      if (event.key === 'Escape') {
        event.preventDefault();
        exitImmersiveMode();
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
  }, [isReady, isExiting, onExit]);

  return (
    <section
      ref={readerRef}
      tabIndex={-1}
      aria-label="Immersive reading mode"
      aria-hidden={isExiting}
      data-transition-state={
        isExiting ? 'exiting' : isEntered ? 'entered' : 'entering'
      }
      className={`fixed inset-0 z-40 flex min-h-screen flex-col bg-base-100/95 outline-none backdrop-blur-md transition-opacity duration-800 ease-out caret-transparent motion-reduce:backdrop-blur-none motion-reduce:duration-200 ${
        isEntered && !isExiting
          ? 'pointer-events-auto opacity-100'
          : 'pointer-events-none opacity-0'
      }`}
    >
      <button
        type="button"
        className="absolute btn btn-soft right-6 top-6 z-30"
        onClick={exitImmersiveMode}
      >
        Exit
      </button>

      <div
        data-testid="immersive-content"
        className={`flex flex-1 items-center justify-center transition-[opacity,filter,transform] duration-700 motion-reduce:transform-none motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:blur-none ${
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

      {chapterBoundary && (
        <ChapterBoundary
          boundary={chapterBoundary}
          onContinue={() => {
            setChapterBoundary(null);
            engineRef.current.continueToNextChapter();
          }}
          onReturn={exitImmersiveMode}
          onReview={() => {
            setChapterBoundary(null);
            engineRef.current.reviewCompletedChapter();
            startCountdown();
          }}
        />
      )}

      {isReady && !chapterBoundary && <Toolbar engineRef={engineRef} />}
    </section>
  );
};

export default RSVPReader;
