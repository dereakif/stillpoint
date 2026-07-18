import { ArrowRight } from 'lucide-react';

const ChapterBoundary = ({
  boundary,
  onContinue,
  onReturn,
  onReview,
  chapterCompletionBehavior,
  onChapterCompletionBehaviorChange,
}) => {
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

        <p
          data-testid="chapter-session-summary"
          className="mt-3 text-sm text-base-content/55"
        >
          {boundary.completedChapter.wordsRead}{' '}
          {boundary.completedChapter.wordsRead === 1 ? 'word' : 'words'} read in
          this chapter
        </p>

        <div className="mx-auto my-8 h-px w-16 bg-base-300" />

        <p className="text-sm text-base-content/55">Up next</p>
        <p
          data-testid="next-chapter-title"
          className="mt-2 text-xl font-medium"
        >
          {nextTitle}
        </p>

        <label className="mx-auto mt-7 block max-w-xs text-left text-xs text-base-content/55">
          At future chapter endings
          <select
            aria-label="Chapter completion behavior"
            className="select select-sm mt-2 w-full"
            value={chapterCompletionBehavior}
            onChange={(event) =>
              onChapterCompletionBehaviorChange(event.target.value)
            }
          >
            <option value="ask">Ask what to do</option>
            <option value="continue">Continue automatically</option>
            <option value="return">Return to document</option>
          </select>
        </label>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <button type="button" className="btn btn-ghost" onClick={onReview}>
            Review chapter
          </button>
          <button type="button" className="btn btn-soft" onClick={onReturn}>
            Return to document
          </button>
          <button
            type="button"
            autoFocus
            className="btn btn-primary"
            onClick={onContinue}
          >
            Continue to next chapter
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChapterBoundary;
