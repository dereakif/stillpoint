import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Gauge, Play, RotateCcw, X } from 'lucide-react';
import WordDisplay from './WordDisplay';
import { createRSVPPlayer } from '../utils';
import {
  MAX_READING_WPM,
  MIN_READING_WPM,
  READING_WPM_STEP,
} from '../readingSpeed';
import {
  applyPacingPreset,
  toEngineTimingOptions,
} from '../storage/readingSettings';

const PRESET_DETAILS = {
  smooth: {
    label: 'Smooth',
    description:
      'Shorter pauses, subtle long-word holds, and quicker common words.',
  },
  natural: {
    label: 'Natural',
    description:
      'Balanced pauses and long-word holds with quicker common words.',
  },
  deliberate: {
    label: 'Deliberate',
    description: 'Longer pauses and holds, with full time for common words.',
  },
};

const PREVIEW_TEXT =
  'A thoughtful reader pauses, notices punctuation, and recognizes extraordinarily long words.';

const TimingPreview = ({ settings, previewId }) => {
  const engineRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);

  if (engineRef.current === null) {
    engineRef.current = createRSVPPlayer(PREVIEW_TEXT, {
      baseWpm: settings.wpm,
      timingOptions: toEngineTimingOptions(settings),
    });
  }

  useEffect(() => {
    const engine = engineRef.current;
    const unsubscribePlayState = engine.subscribe(
      'playStateChange',
      setIsPlaying
    );
    const previewFrame = window.requestAnimationFrame(() => engine.play());

    return () => {
      window.cancelAnimationFrame(previewFrame);
      unsubscribePlayState();
      engine.pause();
    };
  }, [previewId]);

  return (
    <div className="rounded-xl border border-base-300 bg-base-200/25 p-3">
      <div className="flex items-center justify-between gap-3 px-1 text-xs text-base-content/60">
        <span>Previewing draft settings</span>
        <span>{isPlaying ? 'Playing' : 'Finished'}</span>
      </div>
      <div className="-my-8 scale-75 sm:-my-12">
        <WordDisplay engineRef={engineRef} showChapterProgress={false} />
      </div>
    </div>
  );
};

const ReadingSettings = ({
  settings,
  navigationSettings,
  onApply,
  onClose,
  onRecalibrate,
}) => {
  const [draft, setDraft] = useState(settings);
  const [navigationDraft, setNavigationDraft] = useState(navigationSettings);
  const [preview, setPreview] = useState(null);
  const [previewId, setPreviewId] = useState(0);
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const updateDraft = (changes) => {
    setDraft((current) => ({ ...current, ...changes }));
  };

  const updateAdvancedTiming = (changes) => {
    setDraft((current) => ({ ...current, ...changes, preset: 'custom' }));
  };

  const previewDraft = () => {
    setPreview({ ...draft });
    setPreviewId((current) => current + 1);
  };

  return (
    <div className="fixed inset-0 z-65 flex items-center justify-center bg-base-300/70 p-4 backdrop-blur-sm motion-reduce:backdrop-blur-none">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-settings-title"
        tabIndex={-1}
        className="flex max-h-[min(52rem,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl outline-none"
      >
        <header className="flex items-center gap-3 border-b border-base-300 px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
            <Gauge className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="reading-settings-title" className="font-semibold">
              Reading settings
            </h2>
            <p className="text-xs text-base-content/60">
              Tune the pace, then preview before applying
            </p>
          </div>
          <button
            type="button"
            className="btn btn-circle btn-ghost btn-sm"
            aria-label="Close reading settings"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-5 sm:p-7">
          <section
            aria-labelledby="basic-reading-settings"
            className="space-y-5"
          >
            <div>
              <h3 id="basic-reading-settings" className="font-medium">
                Speed and controls
              </h3>
              <p className="text-sm text-base-content/60">
                Speed controls how quickly words appear. These values are
                separate from the reading rhythm below.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="flex items-center justify-between gap-3 text-sm">
                <span>Reading speed</span>
                <strong>{draft.wpm} WPM</strong>
              </span>
              <input
                type="range"
                min={MIN_READING_WPM}
                max={MAX_READING_WPM}
                step={READING_WPM_STEP}
                value={draft.wpm}
                aria-label="Settings reading speed"
                className="range range-primary w-full"
                onChange={(event) =>
                  updateDraft({ wpm: Number(event.target.value) })
                }
              />
              <span className="flex justify-between text-xs text-base-content/50">
                <span>{MIN_READING_WPM}</span>
                <span>{MAX_READING_WPM} WPM</span>
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-control gap-2">
                <span className="text-sm">Countdown before reading</span>
                <select
                  className="select w-full"
                  aria-label="Countdown duration"
                  value={draft.countdownSeconds}
                  onChange={(event) =>
                    updateDraft({
                      countdownSeconds: Number(event.target.value),
                    })
                  }
                >
                  <option value="0">No countdown</option>
                  {[1, 2, 3, 4, 5].map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds} {seconds === 1 ? 'second' : 'seconds'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control gap-2">
                <span className="text-sm">Rewind distance</span>
                <select
                  className="select w-full"
                  aria-label="Rewind distance"
                  value={draft.rewindWords}
                  onChange={(event) =>
                    updateDraft({ rewindWords: Number(event.target.value) })
                  }
                >
                  {Array.from({ length: 15 }, (_, index) => index + 1).map(
                    (words) => (
                      <option key={words} value={words}>
                        {words} words
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>
          </section>

          <section aria-labelledby="reading-rhythm-title" className="space-y-4">
            <div>
              <h3 id="reading-rhythm-title" className="font-medium">
                Reading rhythm
              </h3>
              <p className="text-sm text-base-content/60">
                Rhythm changes pauses around punctuation, long words, and common
                words. It does not change your {draft.wpm} WPM reading speed.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(PRESET_DETAILS).map(([value, detail]) => {
                const selected = draft.preset === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-primary/10'
                        : 'border-base-300 hover:bg-base-200/40'
                    }`}
                    onClick={() =>
                      setDraft((current) => applyPacingPreset(current, value))
                    }
                  >
                    <span className="font-medium">{detail.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-base-content/60">
                      {detail.description}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              role="status"
              className={`rounded-lg px-3 py-2 text-sm ${
                draft.preset === 'custom'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-base-200/45 text-base-content/70'
              }`}
            >
              <strong>
                Current rhythm:{' '}
                {draft.preset === 'custom'
                  ? 'Custom'
                  : PRESET_DETAILS[draft.preset].label}
              </strong>{' '}
              <span>
                {draft.preset === 'custom'
                  ? 'Your fine-tuned values below are what will be applied.'
                  : 'The fine-tune controls below show exactly what this preset changes.'}
              </span>
            </div>

            <details className="group rounded-xl border border-base-300">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium">
                Fine-tune reading rhythm
                <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="space-y-5 border-t border-base-300 px-4 py-4">
                <p className="text-sm text-base-content/60">
                  These controls are the selected rhythm’s actual settings.
                  Changing any one of them creates a Custom rhythm.
                </p>

                <label className="form-control gap-2">
                  <span className="text-sm">Punctuation pauses</span>
                  <select
                    className="select w-full"
                    aria-label="Punctuation pause strength"
                    value={draft.punctuationPause}
                    onChange={(event) =>
                      updateAdvancedTiming({
                        punctuationPause: event.target.value,
                      })
                    }
                  >
                    <option value="light">Light</option>
                    <option value="normal">Normal</option>
                    <option value="strong">Strong</option>
                  </select>
                </label>

                <label className="form-control gap-2">
                  <span className="text-sm">Long-word holds</span>
                  <select
                    className="select w-full"
                    aria-label="Long-word timing"
                    value={draft.longWordTiming}
                    onChange={(event) =>
                      updateAdvancedTiming({
                        longWordTiming: event.target.value,
                      })
                    }
                  >
                    <option value="subtle">Subtle</option>
                    <option value="balanced">Balanced</option>
                    <option value="generous">Generous</option>
                  </select>
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg bg-base-200/40 px-3 py-3">
                  <span>
                    <span className="block text-sm">Quicker common words</span>
                    <span className="block text-xs text-base-content/55">
                      Give words like “the” and “and” slightly less time.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    aria-label="Accelerate common function words"
                    checked={draft.accelerateFunctionWords}
                    onChange={(event) =>
                      updateAdvancedTiming({
                        accelerateFunctionWords: event.target.checked,
                      })
                    }
                  />
                </label>
              </div>
            </details>
          </section>

          <section
            aria-labelledby="navigation-behavior-title"
            className="space-y-4"
          >
            <div>
              <h3 id="navigation-behavior-title" className="font-medium">
                Navigation and resume
              </h3>
              <p className="text-sm text-base-content/60">
                Choose what Stillpoint remembers when moving between the
                document and immersive reading.
              </p>
            </div>

            <div className="divide-y divide-base-300 rounded-xl border border-base-300">
              {[
                [
                  'centerTokenOnExit',
                  'Center the current word after exit',
                  'Bring the exact return position near the middle of the screen.',
                ],
                [
                  'autoResumeOnOpen',
                  'Resume immersively when opening a document',
                  'Open saved documents directly in immersive reading mode.',
                ],
                [
                  'rememberScrollPosition',
                  'Remember document scroll position',
                  'Return to the same navigation-mode scroll position later.',
                ],
              ].map(([property, label, description]) => (
                <label
                  key={property}
                  className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3"
                >
                  <span>
                    <span className="block text-sm">{label}</span>
                    <span className="block text-xs text-base-content/55">
                      {description}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary shrink-0"
                    aria-label={label}
                    checked={navigationDraft[property]}
                    onChange={(event) =>
                      setNavigationDraft((current) => ({
                        ...current,
                        [property]: event.target.checked,
                      }))
                    }
                  />
                </label>
              ))}

              <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                <span>
                  <span className="block text-sm">
                    Show immersive-entry hint
                  </span>
                  <span className="block text-xs text-base-content/55">
                    Turning this off remembers that the hint was dismissed.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary shrink-0"
                  aria-label="Show immersive-entry hint"
                  checked={!navigationDraft.entryHintDismissed}
                  onChange={(event) =>
                    setNavigationDraft((current) => ({
                      ...current,
                      entryHintDismissed: !event.target.checked,
                    }))
                  }
                />
              </label>
            </div>
          </section>

          <section aria-labelledby="timing-preview-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 id="timing-preview-title" className="font-medium">
                  Timing preview
                </h3>
                <p className="text-sm text-base-content/60">
                  Preview uses your draft. Nothing changes globally until Apply.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                onClick={previewDraft}
              >
                {preview ? (
                  <RotateCcw className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
                {preview ? 'Replay preview' : 'Preview timing'}
              </button>
            </div>
            {preview ? (
              <TimingPreview
                key={previewId}
                settings={preview}
                previewId={previewId}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-base-300 px-4 py-8 text-center text-sm text-base-content/55">
                Adjust settings, then preview the rhythm here.
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-xl bg-base-200/45 px-4 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium">Not sure where to start?</h3>
              <p className="text-xs text-base-content/60">
                Recalibrate with a short passage and comprehension check.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onRecalibrate}
            >
              Recalibrate
            </button>
          </section>
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-base-300 bg-base-100 px-5 py-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onApply(draft, navigationDraft)}
          >
            Apply settings
          </button>
        </footer>
      </section>
    </div>
  );
};

export default ReadingSettings;
