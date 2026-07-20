import { useRef, useState, useEffect } from 'react';
import { createRSVPPlayer } from '../utils';
import { getSentenceContext } from '../utils/sentenceContext';
import WordDisplay from './WordDisplay';
import ContextPeek from './ContextPeek';
import Toolbar from './Toolbar';
import ChapterBoundary from './ChapterBoundary';
import ChapterAutoContinue from './ChapterAutoContinue';
import { toEngineTimingOptions } from '../storage/readingSettings';

const RSVPReader = ({
  document,
  readingPosition,
  onReadingPositionChange,
  initialWpm = 300,
  readingSettings,
  appearanceSettings,
  onWpmChange,
  completedChapterIds = [],
  onChapterComplete,
  onReadingActivity,
  chapterCompletionBehavior = 'ask',
  onChapterCompletionBehaviorChange,
  isExiting = false,
  onExit,
}) => {
  const engineRef = useRef(null);
  const readerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const playTimerRef = useRef(null);
  const entryFrameRef = useRef(null);
  const automaticContinueTimerRef = useRef(null);
  const contextPeekRef = useRef(null);
  const readingActivityRef = useRef({
    wordsRead: 0,
    readingTimeMs: 0,
    startedAt: null,
  });
  const chapterCompletionBehaviorRef = useRef(chapterCompletionBehavior);
  const onChapterCompleteRef = useRef(onChapterComplete);
  const onReadingActivityRef = useRef(onReadingActivity);
  const onExitRef = useRef(onExit);
  chapterCompletionBehaviorRef.current = chapterCompletionBehavior;
  onChapterCompleteRef.current = onChapterComplete;
  onReadingActivityRef.current = onReadingActivity;
  onExitRef.current = onExit;

  const [countdown, setCountdown] = useState(() => {
    const seconds = readingSettings?.countdownSeconds ?? 3;
    return seconds > 0 ? seconds : null;
  });
  const [isReady, setIsReady] = useState(false);
  const [isEntered, setIsEntered] = useState(false);
  const [chapterBoundary, setChapterBoundary] = useState(null);
  const [automaticContinuation, setAutomaticContinuation] = useState(null);
  const [contextPeek, setContextPeek] = useState(null);
  contextPeekRef.current = contextPeek;

  if (engineRef.current === null) {
    engineRef.current = createRSVPPlayer(document, {
      baseWpm: initialWpm,
      initialPosition: readingPosition,
      completedChapterIds,
      timingOptions: toEngineTimingOptions(readingSettings),
      rewindWords: readingSettings?.rewindWords,
    });
  }

  const clearAutomaticContinuation = () => {
    window.clearInterval(automaticContinueTimerRef.current);
    automaticContinueTimerRef.current = null;
  };

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

    const countdownSeconds = readingSettings?.countdownSeconds ?? 3;
    if (countdownSeconds === 0) {
      setCountdown(null);
      setIsReady(true);
      playTimerRef.current = window.setTimeout(() => {
        playTimerRef.current = null;
        engine.play();
      }, 700);
      return;
    }

    setIsReady(false);
    setCountdown(countdownSeconds);

    let currentCount = countdownSeconds;

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

  const flushReadingActivity = () => {
    const activity = readingActivityRef.current;
    if (activity.startedAt !== null) {
      activity.readingTimeMs += performance.now() - activity.startedAt;
      activity.startedAt = null;
    }
    if (!activity.wordsRead && !activity.readingTimeMs) return;

    onReadingActivityRef.current?.({
      wordsRead: activity.wordsRead,
      readingTimeMs: Math.round(activity.readingTimeMs),
    });
    readingActivityRef.current = {
      wordsRead: 0,
      readingTimeMs: 0,
      startedAt: null,
    };
  };

  const exitImmersiveMode = () => {
    const engine = engineRef.current;
    if (!engine || isExiting) return;

    engine.pause();
    clearCountdownTimers();
    clearAutomaticContinuation();
    flushReadingActivity();
    onExit(engine.getState().position);
  };

  const beginAutomaticContinuation = (boundary) => {
    setContextPeek(null);
    clearAutomaticContinuation();
    let remaining = 3;
    setAutomaticContinuation({ boundary, countdown: remaining });

    automaticContinueTimerRef.current = window.setInterval(() => {
      remaining -= 1;

      if (remaining === 0) {
        clearAutomaticContinuation();
        setAutomaticContinuation(null);
        engineRef.current.continueToNextChapter();
        return;
      }

      setAutomaticContinuation({ boundary, countdown: remaining });
    }, 1000);
  };

  const createContextPeek = (interaction) => {
    const engine = engineRef.current;
    if (
      !isReady ||
      engine.isPlaying() ||
      chapterBoundary ||
      automaticContinuation ||
      isExiting
    ) {
      return null;
    }

    const context = getSentenceContext(
      document,
      engine.getState().currentIndex
    );
    return context ? { ...context, interaction } : null;
  };

  const toggleContextPeek = () => {
    setContextPeek((current) =>
      current?.interaction === 'toggle' ? null : createContextPeek('toggle')
    );
  };

  useEffect(() => {
    const engine = engineRef.current;
    const unsubscribePosition = engine.subscribe(
      'positionChange',
      (position) => {
        setContextPeek(null);
        onReadingPositionChange(position);
      }
    );
    const unsubscribeWpm = onWpmChange
      ? engine.subscribe('wpmChange', onWpmChange)
      : () => {};
    const unsubscribeWordRead = engine.subscribe('wordRead', () => {
      readingActivityRef.current.wordsRead += 1;
    });
    const unsubscribePlayState = engine.subscribe(
      'playStateChange',
      (isPlaying) => {
        const activity = readingActivityRef.current;
        if (isPlaying) setContextPeek(null);
        if (isPlaying && activity.startedAt === null) {
          activity.startedAt = performance.now();
        } else if (!isPlaying && activity.startedAt !== null) {
          activity.readingTimeMs += performance.now() - activity.startedAt;
          activity.startedAt = null;
        }
      }
    );
    const unsubscribeChapterComplete = engine.subscribe(
      'chapterComplete',
      (boundary) => {
        setContextPeek(null);
        onChapterCompleteRef.current?.(boundary.completedChapter.id);
        if (chapterCompletionBehaviorRef.current === 'continue') {
          beginAutomaticContinuation(boundary);
          return;
        }
        if (chapterCompletionBehaviorRef.current === 'return') {
          onExitRef.current(engine.getState().position);
          return;
        }
        setChapterBoundary(boundary);
      }
    );

    return () => {
      unsubscribePosition();
      unsubscribeWpm();
      unsubscribeWordRead();
      unsubscribePlayState();
      unsubscribeChapterComplete();
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
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
      clearAutomaticContinuation();
      engineRef.current?.pause();
      flushReadingActivity();
    };
    // The reader is remounted for each immersive session.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
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
        if (contextPeekRef.current) {
          setContextPeek(null);
        } else {
          exitImmersiveMode();
        }
        return;
      }

      if (!isReady || isFormControl) return;

      if (event.key === 'c' || event.key === 'C') {
        if (event.repeat || engine.isPlaying()) return;
        event.preventDefault();
        if (contextPeekRef.current?.interaction !== 'toggle') {
          setContextPeek(createContextPeek('hold'));
        }
        return;
      }

      switch (event.key) {
        case ' ':
          event.preventDefault();
          engine.playToggle();
          break;

        case 'ArrowLeft':
          event.preventDefault();
          setContextPeek(null);
          engine.rewind();
          break;

        case 'ArrowRight':
          event.preventDefault();
          setContextPeek(null);
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

        default:
          break;
      }
    };

    const handleKeyUp = (event) => {
      if (event.key !== 'c' && event.key !== 'C') return;
      setContextPeek((current) =>
        current?.interaction === 'hold' ? null : current
      );
    };

    const closeContextPeek = () => setContextPeek(null);
    const handleVisibilityChange = () => {
      if (window.document.visibilityState === 'hidden') closeContextPeek();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', closeContextPeek);
    window.document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', closeContextPeek);
      window.document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
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

      {contextPeek && <ContextPeek context={contextPeek} />}

      <div
        data-testid="immersive-content"
        className={`flex flex-1 items-center justify-center transition-[opacity,filter,transform] duration-700 motion-reduce:transform-none motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:blur-none ${
          isReady
            ? 'scale-100 opacity-100 blur-0'
            : 'scale-95 opacity-30 blur-sm'
        }`}
      >
        <WordDisplay
          engineRef={engineRef}
          wordSize={appearanceSettings?.immersiveWordSize}
        />
      </div>

      {countdown !== null && (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/30 backdrop-blur-[2px]"
          aria-live="assertive"
        >
          <span
            key={countdown}
            data-testid="immersive-countdown"
            className="text-7xl font-medium text-primary/70"
          >
            {countdown}
          </span>
        </div>
      )}

      {automaticContinuation && (
        <ChapterAutoContinue
          boundary={automaticContinuation.boundary}
          countdown={automaticContinuation.countdown}
          onCancel={() => {
            const pendingBoundary = automaticContinuation.boundary;
            clearAutomaticContinuation();
            setAutomaticContinuation(null);
            setChapterBoundary(pendingBoundary);
          }}
        />
      )}

      {chapterBoundary && (
        <ChapterBoundary
          boundary={chapterBoundary}
          onContinue={() => {
            setChapterBoundary(null);
            engineRef.current.continueToNextChapter();
          }}
          onReturn={exitImmersiveMode}
          chapterCompletionBehavior={chapterCompletionBehavior}
          onChapterCompletionBehaviorChange={onChapterCompletionBehaviorChange}
          onReview={() => {
            setChapterBoundary(null);
            engineRef.current.reviewCompletedChapter();
            startCountdown();
          }}
        />
      )}

      {isReady && !chapterBoundary && !automaticContinuation && (
        <Toolbar
          engineRef={engineRef}
          isContextVisible={Boolean(contextPeek)}
          onContextToggle={toggleContextPeek}
        />
      )}
    </section>
  );
};

export default RSVPReader;
