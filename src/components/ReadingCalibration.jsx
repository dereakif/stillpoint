import { useEffect, useRef, useState } from 'react';
import { Gauge, Pause, Play, RotateCcw, X } from 'lucide-react';
import WordDisplay from './WordDisplay';
import { CALIBRATION_PASSAGES } from '../calibrationPassages';
import { createRSVPPlayer } from '../utils';
import { calculateCalibrationRecommendation } from '../storage/calibration';
import {
  MAX_READING_WPM,
  MIN_READING_WPM,
  READING_WPM_STEP,
} from '../readingSpeed';

const ReadingCalibration = ({
  mode = 'first-run',
  currentWpm = 300,
  previousRecommendation = null,
  onApply,
  onSkip,
  onPostpone,
  onDismissPrompts,
  onClose,
}) => {
  const [step, setStep] = useState('intro');
  const [passageIndex, setPassageIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [comfort, setComfort] = useState('');
  const [result, setResult] = useState(null);
  const [adjustedWpm, setAdjustedWpm] = useState(currentWpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [isHoldingFirstWord, setIsHoldingFirstWord] = useState(false);
  const startedAtRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const firstWordTimerRef = useRef(null);
  const engineRef = useRef(null);
  const dialogRef = useRef(null);
  const activePassage = CALIBRATION_PASSAGES[passageIndex];

  useEffect(() => {
    dialogRef.current?.focus();
  }, [step]);

  const startPassage = (useNextPassage = false) => {
    const nextPassageIndex = useNextPassage
      ? (passageIndex + 1) % CALIBRATION_PASSAGES.length
      : passageIndex;
    const selectedPassage = CALIBRATION_PASSAGES[nextPassageIndex];

    engineRef.current?.pause();
    engineRef.current = createRSVPPlayer(selectedPassage.text, {
      baseWpm: currentWpm,
    });
    setPassageIndex(nextPassageIndex);
    startedAtRef.current = null;
    setCountdown(3);
    setIsHoldingFirstWord(false);
    setAnswer('');
    setComfort('');
    setResult(null);
    setStep('reading');
  };

  useEffect(() => {
    if (step !== 'reading' || !engineRef.current) return undefined;

    const engine = engineRef.current;
    const unsubscribePlayState = engine.subscribe(
      'playStateChange',
      setIsPlaying
    );
    const unsubscribeComplete = engine.subscribe('complete', () => {
      setResult({
        elapsedMs: Math.max(0, performance.now() - startedAtRef.current),
        testedWpm: engine.getWpm(),
        passageId: activePassage.id,
        passageVersion: activePassage.version,
      });
      setStep('questions');
    });

    engine.preview();
    let remaining = 3;
    setCountdown(remaining);
    countdownTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining === 0) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        setCountdown(null);
        setIsHoldingFirstWord(true);
        firstWordTimerRef.current = window.setTimeout(() => {
          firstWordTimerRef.current = null;
          setIsHoldingFirstWord(false);
          startedAtRef.current = performance.now();
          engine.play();
        }, 1200);
        return;
      }
      setCountdown(remaining);
    }, 1000);

    return () => {
      window.clearInterval(countdownTimerRef.current);
      window.clearTimeout(firstWordTimerRef.current);
      countdownTimerRef.current = null;
      firstWordTimerRef.current = null;
      unsubscribePlayState();
      unsubscribeComplete();
      engine.pause();
    };
  }, [step, activePassage.id, activePassage.version]);

  const calculateResult = (event) => {
    event.preventDefault();
    const completedResult = {
      ...result,
      comprehensionCorrect: answer === activePassage.question.answer,
      comfort,
    };
    const recommendation = calculateCalibrationRecommendation(completedResult);
    setResult({ ...completedResult, recommendation });
    setAdjustedWpm(recommendation);
    setStep('result');
  };

  const secondaryAction = () => {
    if (mode === 'periodic') {
      onPostpone();
      return;
    }
    if (mode === 'first-run') {
      onSkip();
      return;
    }
    onClose();
  };

  const secondaryLabel =
    mode === 'periodic'
      ? 'Remind me next week'
      : mode === 'first-run'
        ? 'Skip for now'
        : 'Close';

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-base-300/70 p-4 backdrop-blur-sm motion-reduce:backdrop-blur-none">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="calibration-title"
        tabIndex={-1}
        className="max-h-[min(48rem,calc(100vh-2rem))] w-full max-w-3xl overflow-y-auto rounded-2xl border border-base-300 bg-base-100 shadow-2xl outline-none"
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-base-300 bg-base-100/95 px-5 py-4 backdrop-blur-md">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
            <Gauge className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="calibration-title" className="font-semibold">
              {mode === 'periodic'
                ? 'Check in with your reading pace'
                : 'Find a comfortable reading pace'}
            </h2>
            <p className="text-xs text-base-content/60">
              A local, optional recommendation—not a clinical measurement
            </p>
          </div>
          {mode === 'explicit' && (
            <button
              type="button"
              className="btn btn-circle btn-ghost btn-sm"
              aria-label="Close calibration"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          )}
        </header>

        <div className="p-5 sm:p-8">
          {step === 'intro' && (
            <div className="mx-auto max-w-xl space-y-6 text-center">
              <div className="space-y-3">
                <p className="text-lg leading-8">
                  Read a short passage, then answer one quick question.
                </p>
                <p className="text-sm text-base-content/65">
                  Find a quiet moment and avoid distractions. You’ll start at{' '}
                  {currentWpm} WPM after a short countdown.
                </p>
              </div>

              {mode === 'periodic' && previousRecommendation && (
                <p className="rounded-xl bg-base-200/60 px-4 py-3 text-sm">
                  Your currently accepted pace is {previousRecommendation} WPM.
                  This check-in is optional, and faster is not inherently
                  better.
                </p>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => startPassage()}
                >
                  Start calibration
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={secondaryAction}
                >
                  {secondaryLabel}
                </button>
              </div>

              {mode === 'periodic' && (
                <button
                  type="button"
                  className="btn btn-link btn-sm text-base-content/60"
                  onClick={onDismissPrompts}
                >
                  Don’t suggest recalibration again
                </button>
              )}
            </div>
          )}

          {step === 'reading' && (
            <div className="space-y-4" data-testid="calibration-passage">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-base-content/65">
                <p>
                  Reading at <strong>{currentWpm} WPM</strong>. Keep your eyes
                  on the highlighted letter and let the passage advance
                  automatically.
                </p>
                <button
                  type="button"
                  data-testid="calibration-playback-control"
                  className="btn btn-ghost btn-sm"
                  disabled={countdown !== null || isHoldingFirstWord}
                  onClick={() => engineRef.current?.playToggle()}
                >
                  {isPlaying ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  {countdown !== null
                    ? `Starting in ${countdown}`
                    : isHoldingFirstWord
                      ? 'Starting…'
                      : isPlaying
                        ? 'Pause'
                        : 'Resume'}
                </button>
              </div>
              <div className="relative">
                <div
                  data-testid="calibration-word-display"
                  className={`transition-[opacity,filter,transform] duration-300 motion-reduce:transform-none motion-reduce:transition-opacity motion-reduce:duration-150 ${
                    countdown !== null
                      ? 'scale-95 opacity-15 blur-sm'
                      : 'scale-100 opacity-100 blur-0'
                  }`}
                >
                  <WordDisplay
                    engineRef={engineRef}
                    showChapterProgress={false}
                  />
                </div>
                {countdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-base-100/65 backdrop-blur-sm motion-reduce:bg-base-100/90 motion-reduce:backdrop-blur-none">
                    <div
                      className="text-center"
                      aria-live="assertive"
                      aria-atomic="true"
                    >
                      <p className="text-sm font-medium text-base-content/65">
                        Get ready
                      </p>
                      <p
                        key={countdown}
                        data-testid="calibration-countdown"
                        className="mt-1 text-6xl font-semibold text-primary"
                      >
                        {countdown}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <p
                className="text-center text-xs text-base-content/55"
                aria-live="polite"
              >
                {isHoldingFirstWord
                  ? 'Take a moment to register the first word.'
                  : 'The comprehension question will appear when the passage finishes.'}
              </p>
            </div>
          )}

          {step === 'questions' && (
            <form
              className="mx-auto max-w-xl space-y-8"
              onSubmit={calculateResult}
            >
              <fieldset className="space-y-3">
                <legend className="font-medium">
                  {activePassage.question.prompt}
                </legend>
                {activePassage.question.options.map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-base-300 px-4 py-3 hover:bg-base-200/40"
                  >
                    <input
                      type="radio"
                      name="comprehension"
                      value={value}
                      checked={answer === value}
                      onChange={(event) => setAnswer(event.target.value)}
                      className="radio radio-primary radio-sm mt-0.5"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>

              <div className="flex flex-col gap-3 rounded-xl bg-base-200/55 px-4 py-3 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 text-sm text-base-content/70">
                  Got distracted? No problem—try again with a different passage.
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm shrink-0"
                  onClick={() => startPassage(true)}
                >
                  <RotateCcw className="size-4" />
                  Give it another try
                </button>
              </div>

              <fieldset className="space-y-3">
                <legend className="font-medium">How did that pace feel?</legend>
                {[
                  ['too-slow', 'I could comfortably read faster'],
                  ['comfortable', 'Comfortable and natural'],
                  ['too-fast', 'Rushed or difficult to follow'],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-base-300 px-4 py-3 hover:bg-base-200/40"
                  >
                    <input
                      type="radio"
                      name="comfort"
                      value={value}
                      checked={comfort === value}
                      onChange={(event) => setComfort(event.target.value)}
                      className="radio radio-primary radio-sm mt-0.5"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>

              <p className="text-sm text-base-content/60">
                Passage familiarity, language fluency, and content difficulty
                can all affect a result. Treat this as a starting point, not a
                score.
              </p>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={!answer || !comfort}
              >
                See recommendation
              </button>
            </form>
          )}

          {step === 'result' && result && (
            <div className="mx-auto max-w-xl space-y-7 text-center">
              <div>
                <p className="text-sm text-base-content/60">Suggested pace</p>
                <p className="mt-1 text-5xl font-semibold tracking-tight text-primary">
                  {adjustedWpm}
                  <span className="ml-2 text-lg font-normal text-base-content/60">
                    WPM
                  </span>
                </p>
              </div>

              <p className="text-base-content/75">
                This starts from the {result.testedWpm} WPM pace you just tried,
                then makes a modest adjustment using comprehension and comfort.
                Adjust it until it feels like a useful starting point.
              </p>

              {previousRecommendation && (
                <p className="rounded-xl bg-base-200/60 px-4 py-3 text-sm">
                  Previous accepted pace: {previousRecommendation} WPM. Changes
                  are context, not a streak or performance score.
                </p>
              )}

              <div className="mx-auto max-w-sm">
                <input
                  type="range"
                  min={MIN_READING_WPM}
                  max={MAX_READING_WPM}
                  step={READING_WPM_STEP}
                  value={adjustedWpm}
                  aria-label="Adjust recommended reading speed"
                  className="range range-primary"
                  onChange={(event) =>
                    setAdjustedWpm(Number(event.target.value))
                  }
                />
                <div className="mt-2 flex justify-between text-xs text-base-content/55">
                  <span>{MIN_READING_WPM}</span>
                  <span>{MAX_READING_WPM} WPM</span>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onApply(result, adjustedWpm)}
                >
                  Use {adjustedWpm} WPM
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onApply(result, currentWpm)}
                >
                  Keep {currentWpm} WPM
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => startPassage(true)}
                >
                  <RotateCcw className="size-4" />
                  Retry with another passage
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ReadingCalibration;
