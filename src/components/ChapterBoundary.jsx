import { ArrowRight } from 'lucide-react';

const ChapterBoundary = ({ boundary, onContinue }) => {
  const completedTitle =
    boundary.completedChapter.title ||
    `Section ${boundary.completedChapter.number}`;
  const nextTitle =
    boundary.nextChapter.title || `Section ${boundary.nextChapter.number}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chapter complete"
      className="absolute inset-0 z-25 flex items-center justify-center bg-base-100/92 px-6 text-center backdrop-blur-md motion-reduce:backdrop-blur-none"
    >
      <div className="w-full max-w-lg">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary/70">
          Chapter complete
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {completedTitle}
        </h2>

        <div className="mx-auto my-8 h-px w-16 bg-base-300" />

        <p className="text-sm text-base-content/55">Up next</p>
        <p
          data-testid="next-chapter-title"
          className="mt-2 text-xl font-medium"
        >
          {nextTitle}
        </p>

        <button
          type="button"
          autoFocus
          className="btn btn-primary mt-8"
          onClick={onContinue}
        >
          Continue to next chapter
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
};

export default ChapterBoundary;
