const ChapterAutoContinue = ({ boundary, countdown, onCancel }) => {
  const nextTitle =
    boundary.nextChapter.title || `Section ${boundary.nextChapter.number}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Continuing to next chapter"
      className="absolute inset-0 z-25 flex items-center justify-center bg-base-100/92 px-6 text-center backdrop-blur-md motion-reduce:backdrop-blur-none"
    >
      <div className="w-full max-w-md">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary/70">
          Up next
        </p>
        <h2
          data-testid="automatic-next-chapter-title"
          className="mt-3 text-3xl font-semibold tracking-tight"
        >
          {nextTitle}
        </h2>
        <p className="mt-6 text-base-content/60" aria-live="polite">
          Continuing in{' '}
          <span
            data-testid="automatic-continue-countdown"
            className="font-mono text-lg text-base-content"
          >
            {countdown}
          </span>
        </p>
        <button
          type="button"
          autoFocus
          className="btn btn-soft mt-6"
          onClick={onCancel}
        >
          Cancel automatic continuation
        </button>
      </div>
    </div>
  );
};

export default ChapterAutoContinue;
