import { useEffect, useRef, useState } from 'react';
import { Palette, X } from 'lucide-react';
import { APPEARANCE_THEMES } from '../appearanceThemes';

const THEME_DETAILS = {
  dark: { label: 'Dark', description: 'Low-light focused reading.' },
  light: { label: 'Light', description: 'Crisp paper-like contrast.' },
  sepia: { label: 'Sepia', description: 'Warm, softer page tones.' },
};

const FONT_DETAILS = {
  serif: { label: 'Serif', sample: 'A calm printed page' },
  sans: { label: 'Sans', sample: 'A clean modern page' },
  system: { label: 'System', sample: 'Familiar device text' },
};

const FONT_CLASSES = {
  serif: 'document-font-serif',
  sans: 'document-font-sans',
  system: 'document-font-system',
};

const WIDTH_CLASSES = {
  narrow: 'max-w-sm',
  comfortable: 'max-w-md',
  wide: 'max-w-xl',
};

const LINE_HEIGHT_CLASSES = {
  compact: 'leading-6',
  comfortable: 'leading-7',
  relaxed: 'leading-8',
};

const WORD_SIZE_CLASSES = {
  small: 'text-3xl',
  medium: 'text-5xl',
  large: 'text-6xl',
};

const AppearanceSettings = ({ settings, onApply, onClose }) => {
  const [draft, setDraft] = useState(settings);
  const dialogRef = useRef(null);
  const palette = APPEARANCE_THEMES[draft.theme];

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const updateDraft = (changes) => {
    setDraft((current) => ({ ...current, ...changes }));
  };

  return (
    <div className="fixed inset-0 z-65 flex items-center justify-center bg-base-300/70 p-4 backdrop-blur-sm motion-reduce:backdrop-blur-none">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-settings-title"
        tabIndex={-1}
        className="flex max-h-[min(52rem,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl outline-none"
      >
        <header className="flex items-center gap-3 border-b border-base-300 px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
            <Palette className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="appearance-settings-title" className="font-semibold">
              Appearance settings
            </h2>
            <p className="text-xs text-base-content/60">
              Shape the document and immersive reading surface
            </p>
          </div>
          <button
            type="button"
            className="btn btn-circle btn-ghost btn-sm"
            aria-label="Close appearance settings"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]">
          <div className="space-y-8 p-5 sm:p-7">
            <section aria-labelledby="theme-title" className="space-y-3">
              <div>
                <h3 id="theme-title" className="font-medium">
                  Theme
                </h3>
                <p className="text-sm text-base-content/60">
                  Every option uses contrast-checked text and ORP colors.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(THEME_DETAILS).map(([value, detail]) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${detail.label} theme`}
                    aria-pressed={draft.theme === value}
                    className={`rounded-xl border p-3 text-left ${
                      draft.theme === value
                        ? 'border-primary bg-primary/10'
                        : 'border-base-300 hover:bg-base-200/40'
                    }`}
                    onClick={() => updateDraft({ theme: value })}
                  >
                    <span
                      aria-hidden="true"
                      className="mb-3 block h-8 rounded-lg border"
                      style={{
                        background: `linear-gradient(90deg, ${APPEARANCE_THEMES[value].base100} 0 55%, ${APPEARANCE_THEMES[value].primary} 55%)`,
                        borderColor: APPEARANCE_THEMES[value].base300,
                      }}
                    />
                    <span className="font-medium">{detail.label}</span>
                    <span className="mt-1 block text-xs text-base-content/55">
                      {detail.description}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section
              aria-labelledby="document-type-title"
              className="space-y-4"
            >
              <h3 id="document-type-title" className="font-medium">
                Document typography
              </h3>

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm">Font</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {Object.entries(FONT_DETAILS).map(([value, detail]) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`${detail.label} document font`}
                      aria-pressed={draft.documentFont === value}
                      className={`rounded-lg border px-3 py-3 text-left ${FONT_CLASSES[value]} ${
                        draft.documentFont === value
                          ? 'border-primary bg-primary/10'
                          : 'border-base-300'
                      }`}
                      onClick={() => updateDraft({ documentFont: value })}
                    >
                      <span className="block text-sm font-medium">
                        {detail.label}
                      </span>
                      <span className="mt-1 block text-xs text-base-content/55">
                        {detail.sample}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-control gap-2">
                  <span className="text-sm">Document width</span>
                  <select
                    className="select w-full"
                    aria-label="Document width"
                    value={draft.documentWidth}
                    onChange={(event) =>
                      updateDraft({ documentWidth: event.target.value })
                    }
                  >
                    <option value="narrow">Narrow</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="wide">Wide</option>
                  </select>
                </label>

                <label className="form-control gap-2">
                  <span className="text-sm">Line spacing</span>
                  <select
                    className="select w-full"
                    aria-label="Document line height"
                    value={draft.lineHeight}
                    onChange={(event) =>
                      updateDraft({ lineHeight: event.target.value })
                    }
                  >
                    <option value="compact">Compact</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="relaxed">Relaxed</option>
                  </select>
                </label>
              </div>
            </section>

            <section
              aria-labelledby="immersive-appearance-title"
              className="space-y-4"
            >
              <h3 id="immersive-appearance-title" className="font-medium">
                Immersive display
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="form-control gap-2">
                  <span className="text-sm">Word size</span>
                  <select
                    className="select w-full"
                    aria-label="Immersive word size"
                    value={draft.immersiveWordSize}
                    onChange={(event) =>
                      updateDraft({ immersiveWordSize: event.target.value })
                    }
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </label>

                <label className="form-control gap-2">
                  <span className="text-sm">Focus letter color</span>
                  <select
                    className="select w-full"
                    aria-label="ORP accent color"
                    value={draft.orpAccent}
                    onChange={(event) =>
                      updateDraft({ orpAccent: event.target.value })
                    }
                  >
                    <option value="violet">Violet</option>
                    <option value="cyan">Cyan</option>
                    <option value="amber">Amber</option>
                    <option value="rose">Rose</option>
                  </select>
                </label>
              </div>
            </section>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-base-200/45 px-4 py-4">
              <span>
                <span className="block text-sm font-medium">
                  Reduce effects
                </span>
                <span className="block text-xs text-base-content/55">
                  Minimize transitions, blur, and animated highlights beyond
                  your system motion preference.
                </span>
              </span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                aria-label="Reduce visual effects"
                checked={draft.reducedEffects}
                onChange={(event) =>
                  updateDraft({ reducedEffects: event.target.checked })
                }
              />
            </label>
          </div>

          <aside
            aria-label="Appearance preview"
            className="border-t border-base-300 p-5 lg:sticky lg:top-0 lg:h-fit lg:border-l lg:border-t-0 lg:p-7"
          >
            <div
              data-testid="appearance-preview"
              className="overflow-hidden rounded-2xl border shadow-lg"
              style={{
                backgroundColor: palette.base100,
                borderColor: palette.base300,
                color: palette.baseContent,
              }}
            >
              <div
                className="border-b px-4 py-3 text-xs font-medium"
                style={{ borderColor: palette.base300 }}
              >
                Document preview
              </div>
              <div className="px-4 py-6">
                <div
                  className={`mx-auto ${WIDTH_CLASSES[draft.documentWidth]} ${FONT_CLASSES[draft.documentFont]} ${LINE_HEIGHT_CLASSES[draft.lineHeight]}`}
                >
                  <h4 className="text-lg font-semibold">
                    A quiet reading space
                  </h4>
                  <p className="mt-3 text-sm">
                    Comfortable typography lets the page recede while the
                    meaning remains clear. Width and spacing should support
                    attention, not compete for it.
                  </p>
                </div>

                <div
                  className="mt-7 rounded-xl px-3 py-6 text-center font-mono font-bold"
                  style={{ backgroundColor: palette.base200 }}
                >
                  <span className={WORD_SIZE_CLASSES[draft.immersiveWordSize]}>
                    fo
                    <span style={{ color: palette[draft.orpAccent] }}>c</span>
                    us
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-base-300 bg-base-100 px-5 py-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onApply(draft)}
          >
            Apply appearance
          </button>
        </footer>
      </section>
    </div>
  );
};

export default AppearanceSettings;
