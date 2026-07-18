import { useEffect, useState } from 'react';
import { Edit3, Play } from 'lucide-react';
import { getParagraphTokenRange, getReadingPositionSummary } from '../utils';

const RETURN_HIGHLIGHT_DURATION = 2400;

const DocumentView = ({
  document: documentModel,
  readingPosition,
  returnContext,
  isImmersive = false,
  onEdit,
  onStartReading,
}) => {
  const text = documentModel.source.text;
  const paragraphs = documentModel.sections.flatMap(
    (section) => section.blocks
  );
  const positionSummary = getReadingPositionSummary(text, readingPosition);
  const [showReturnHighlight, setShowReturnHighlight] = useState(
    Boolean(returnContext)
  );

  useEffect(() => {
    if (!returnContext) return undefined;

    const currentParagraph = document.getElementById(
      returnContext.position.blockId
    );
    currentParagraph?.scrollIntoView({ block: 'center', behavior: 'instant' });
    currentParagraph?.focus({ preventScroll: true });
    setShowReturnHighlight(true);

    const highlightTimer = window.setTimeout(() => {
      setShowReturnHighlight(false);
    }, RETURN_HIGHLIGHT_DURATION);

    return () => window.clearTimeout(highlightTimer);
  }, [returnContext]);

  if (!paragraphs.length) {
    return (
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">No document yet</h1>
        <p className="text-base-content/70">
          Import some text before entering the reading view.
        </p>
        <button type="button" className="btn btn-primary" onClick={onEdit}>
          <Edit3 className="size-4" />
          Add document
        </button>
      </section>
    );
  }

  return (
    <section
      data-testid="document-view"
      inert={isImmersive}
      aria-hidden={isImmersive}
      className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-8 sm:py-12"
    >
      <header
        className={`mb-10 flex flex-col gap-5 border-b border-base-300 pb-6 transition-[opacity,filter,transform] duration-800 ease-out motion-reduce:transform-none motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:blur-none ${
          isImmersive
            ? '-translate-y-2 opacity-15 blur-sm'
            : 'translate-y-0 opacity-100 blur-0'
        }`}
      >
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-primary">Stillpoint</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Document</h1>
          </div>

          <button
            type="button"
            className="btn btn-soft min-h-11 w-full whitespace-normal sm:w-auto"
            onClick={onEdit}
          >
            <Edit3 className="size-4 shrink-0" />
            Edit document
          </button>
        </div>

        <div className="rounded-box border border-base-300 bg-base-200/40 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p
                id="current-position-status"
                data-testid="current-position-status"
                aria-live="polite"
                className="font-medium text-base-content"
              >
                {positionSummary
                  ? `Paragraph ${positionSummary.paragraphNumber} of ${positionSummary.paragraphCount} · Word ${positionSummary.wordNumber} of ${positionSummary.wordCount}`
                  : 'No readable words'}
              </p>
              <p className="mt-1 text-sm text-base-content/65">
                {positionSummary
                  ? `Word ${positionSummary.documentWordNumber} of ${positionSummary.documentWordCount} overall`
                  : 'Add readable text in the document editor.'}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary min-h-12 w-full justify-start whitespace-normal sm:w-auto sm:min-w-48"
              aria-describedby="current-position-status"
              disabled={!positionSummary}
              onClick={() => onStartReading()}
            >
              <Play className="size-4 shrink-0 fill-current" />
              <span className="flex flex-col items-start leading-tight">
                <span>Resume reading</span>
                {positionSummary && (
                  <span className="text-xs font-normal opacity-80">
                    Paragraph {positionSummary.paragraphNumber} ·{' '}
                    {positionSummary.percentage}%
                  </span>
                )}
              </span>
            </button>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between gap-3 text-xs text-base-content/65">
              <span>Document progress</span>
              <span data-testid="document-progress-value">
                {positionSummary?.percentage ?? 0}%
              </span>
            </div>
            <progress
              aria-label="Document progress"
              className="progress progress-primary block h-2 w-full"
              value={positionSummary?.percentage ?? 0}
              max="100"
            />
          </div>
        </div>
      </header>

      <article
        aria-label="Document content"
        className="space-y-6 text-lg leading-8 text-base-content/90 sm:text-xl sm:leading-9"
      >
        {paragraphs.map((paragraph, index) => {
          const isCurrent = paragraph.id === readingPosition?.blockId;
          const isReturnTarget =
            showReturnHighlight &&
            paragraph.id === returnContext?.position.blockId;
          const tokenRange = isReturnTarget
            ? getParagraphTokenRange(
                paragraph.text,
                returnContext.position.tokenOffset
              )
            : null;

          return (
            <div
              key={paragraph.id}
              className={`group relative transition-[opacity,filter,transform] duration-800 ease-out motion-reduce:transform-none motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:blur-none ${
                isImmersive
                  ? isCurrent
                    ? 'scale-[0.99] opacity-70 blur-0'
                    : 'scale-[0.985] opacity-10 blur-[2px]'
                  : 'scale-100 opacity-100 blur-0'
              }`}
            >
              <p
                id={paragraph.id}
                data-block-type={paragraph.type}
                data-section-id={paragraph.sectionId}
                tabIndex={isCurrent ? -1 : undefined}
                aria-current={isCurrent ? 'location' : undefined}
                data-token-offset={
                  isCurrent ? readingPosition.tokenOffset : undefined
                }
                className={`scroll-mt-8 whitespace-pre-line rounded-lg border-l-2 p-4 pr-16 transition-colors motion-reduce:transition-none ${
                  isCurrent
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-transparent'
                }`}
              >
                {tokenRange ? (
                  <>
                    {paragraph.text.slice(0, tokenRange.start)}
                    <mark
                      data-testid="return-word-highlight"
                      className="return-word-highlight"
                    >
                      {paragraph.text.slice(tokenRange.start, tokenRange.end)}
                    </mark>
                    {paragraph.text.slice(tokenRange.end)}
                  </>
                ) : (
                  paragraph.text
                )}
              </p>

              <button
                type="button"
                aria-label={`Immerse from paragraph ${index + 1}`}
                className="btn btn-circle btn-ghost btn-sm absolute right-3 top-3 opacity-70 transition-opacity motion-reduce:transition-none hover:opacity-100 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                onClick={() =>
                  onStartReading({ blockId: paragraph.id, tokenOffset: 0 })
                }
              >
                <Play className="size-4 fill-current" />
              </button>
            </div>
          );
        })}
      </article>
    </section>
  );
};

export default DocumentView;
