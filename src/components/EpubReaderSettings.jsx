import { RotateCcw, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

const RangeSetting = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  disabled = false,
  onChange,
}) => (
  <label className={`block ${disabled ? 'opacity-45' : ''}`}>
    <span className="flex items-center justify-between gap-4 text-sm font-medium">
      {label}
      <output className="text-xs tabular-nums text-base-content/55">
        {value}
        {unit}
      </output>
    </span>
    <input
      type="range"
      className="range range-primary range-sm mt-3 w-full"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </label>
);

const EpubReaderSettings = ({ settings, onChange, onClose, onReset }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const containDialogFocus = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', containDialogFocus);
    return () => window.removeEventListener('keydown', containDialogFocus);
  }, [onClose]);

  const update = (property, value) =>
    onChange({ ...settings, [property]: value });
  const isPaginated = settings.flow === 'paginated';

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Dismiss reader settings"
        className="absolute inset-0 bg-base-300/55 backdrop-blur-xs"
        onClick={onClose}
      />
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Reader settings"
        className="absolute inset-y-0 right-0 flex w-[min(25rem,94vw)] flex-col border-l border-base-300 bg-base-100 shadow-2xl"
      >
        <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-base-300 px-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              EPUB
            </p>
            <h2 className="text-lg font-semibold">Reader settings</h2>
          </div>
          <button
            type="button"
            autoFocus
            className="btn btn-circle btn-ghost btn-sm"
            aria-label="Close reader settings"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-6">
          <label className="block text-sm font-medium">
            Font
            <select
              className="select mt-2 w-full"
              aria-label="EPUB font"
              value={settings.fontFamily}
              onChange={(event) => update('fontFamily', event.target.value)}
            >
              <option value="publisher">Publisher original</option>
              <option value="serif">Serif</option>
              <option value="sans">Sans serif</option>
              <option value="system">System</option>
            </select>
          </label>

          <RangeSetting
            label="Font size"
            value={settings.fontSize}
            min={12}
            max={32}
            unit="px"
            onChange={(value) => update('fontSize', value)}
          />
          <RangeSetting
            label="Line height"
            value={settings.lineHeight}
            min={1.1}
            max={2.4}
            step={0.1}
            onChange={(value) => update('lineHeight', value)}
          />
          <RangeSetting
            label="Horizontal margin"
            value={settings.marginHorizontal}
            min={0}
            max={64}
            unit="px"
            onChange={(value) => update('marginHorizontal', value)}
          />
          <RangeSetting
            label="Vertical margin"
            value={settings.marginVertical}
            min={0}
            max={48}
            unit="px"
            disabled={!isPaginated}
            onChange={(value) => update('marginVertical', value)}
          />

          <div className="grid gap-5 border-t border-base-300 pt-6">
            <label className="block text-sm font-medium">
              Reading mode
              <select
                className="select mt-2 w-full"
                aria-label="EPUB reading mode"
                value={settings.flow}
                onChange={(event) => update('flow', event.target.value)}
              >
                <option value="paginated">Paginated</option>
                <option value="scrolled-doc">Scrolling</option>
              </select>
            </label>

            <label
              className={`block text-sm font-medium ${!isPaginated ? 'opacity-45' : ''}`}
            >
              Page spread
              <select
                className="select mt-2 w-full"
                aria-label="EPUB page spread"
                value={settings.spread}
                disabled={!isPaginated}
                onChange={(event) => update('spread', event.target.value)}
              >
                <option value="none">Single page</option>
                <option value="auto">Automatic spread</option>
              </select>
            </label>
          </div>
        </div>

        <footer className="shrink-0 border-t border-base-300 p-4">
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={onReset}
          >
            <RotateCcw className="size-4" />
            Restore reader defaults
          </button>
        </footer>
      </aside>
    </div>
  );
};

export default EpubReaderSettings;
