import { useEffect, useRef, useState } from 'react';
import { Gauge, RotateCcw, X } from 'lucide-react';
import {
  CALIBRATION_PASSAGE,
  CALIBRATION_PASSAGE_WORD_COUNT,
  calculateCalibrationRecommendation,
} from '../storage/calibration';

const COMPREHENSION_QUESTION = {
  prompt: 'Why did Maya decide to take the longer route again?',
  options: [
    ['save-time', 'It saved time on the trip.'],
    ['notice-more', 'It gave her new things to notice.'],
    ['avoid-market', 'It let her avoid the market.'],
  ],
  answer: 'notice-more',
};

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
  const [answer, setAnswer] = useState('');
  const [comfort, setComfort] = useState('');
  const [result, setResult] = useState(null);
  const [adjustedWpm, setAdjustedWpm] = useState(currentWpm);
  const startedAtRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, [step]);

  const startPassage = () => {
    startedAtRef.current = performance.now();
    setAnswer('');
    setComfort('');
    setResult(null);
    setStep('reading');
  };

  const finishPassage = () => {
    const elapsedMs = Math.max(1000, performance.now() - startedAtRef.current);
    setResult({ elapsedMs });
    setStep('questions');
  };

  const calculateResult = (event) => {
    event.preventDefault();
    const completedResult = {
      ...result,
      comprehensionCorrect: answer === COMPREHENSION_QUESTION.answer,
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
                  Read a short passage at a natural pace, then answer one
                  context question and tell us how the pace felt.
                </p>
                <p className="text-sm text-base-content/65">
                  It usually takes about 30 seconds. Your timing and result stay
                  in this browser, and you can always adjust or ignore the
                  recommendation.
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
                  onClick={startPassage}
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
            <div className="mx-auto max-w-2xl space-y-7">
              <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-wider text-base-content/55">
                <span>Calibration passage</span>
                <span>{CALIBRATION_PASSAGE_WORD_COUNT} words</span>
              </div>
              <p
                className="select-text text-xl leading-9 sm:text-2xl sm:leading-10"
                data-testid="calibration-passage"
              >
                {CALIBRATION_PASSAGE}
              </p>
              <div className="flex justify-center">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={finishPassage}
                >
                  I finished the passage
                </button>
              </div>
            </div>
          )}

          {step === 'questions' && (
            <form
              className="mx-auto max-w-xl space-y-8"
              onSubmit={calculateResult}
            >
              <fieldset className="space-y-3">
                <legend className="font-medium">
                  {COMPREHENSION_QUESTION.prompt}
                </legend>
                {COMPREHENSION_QUESTION.options.map(([value, label]) => (
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
                This combines your reading time, context answer, and comfort
                feedback. Adjust it until it feels like a useful starting point.
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
                  min="100"
                  max="800"
                  step="10"
                  value={adjustedWpm}
                  aria-label="Adjust recommended reading speed"
                  className="range range-primary"
                  onChange={(event) =>
                    setAdjustedWpm(Number(event.target.value))
                  }
                />
                <div className="mt-2 flex justify-between text-xs text-base-content/55">
                  <span>100</span>
                  <span>800 WPM</span>
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
                  onClick={startPassage}
                >
                  <RotateCcw className="size-4" />
                  Retry
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
