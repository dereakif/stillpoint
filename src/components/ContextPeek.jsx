const ContextPeek = ({ context }) => {
  const { sentenceText, highlightRange, interaction } = context;

  return (
    <section
      role="region"
      aria-label="Sentence context"
      aria-live="polite"
      data-testid="context-peek"
      className="absolute inset-0 z-20 flex items-center justify-center bg-base-100/96 px-5 pb-48 pt-24 backdrop-blur-md motion-reduce:backdrop-blur-none"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-base-300 bg-card px-6 py-7 shadow-2xl sm:px-10 sm:py-9">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-base-content/50">
          Sentence context
        </p>
        <p className="text-xl leading-9 text-base-content sm:text-2xl sm:leading-10">
          {sentenceText.slice(0, highlightRange.start)}
          <mark
            data-testid="context-current-word"
            className="rounded-md bg-primary/18 px-1 text-base-content ring-1 ring-primary/45"
          >
            {sentenceText.slice(highlightRange.start, highlightRange.end)}
          </mark>
          {sentenceText.slice(highlightRange.end)}
        </p>
        <p className="mt-5 text-xs text-base-content/55">
          {interaction === 'hold'
            ? 'Release C to return. Your reading position will not move.'
            : 'Select Context again or resume reading to return. Your position will not move.'}
        </p>
      </div>
    </section>
  );
};

export default ContextPeek;
