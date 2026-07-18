import { Edit3, Play } from 'lucide-react';
import { createDocumentParagraphs } from '../utils';

const DocumentView = ({ text, readingPosition, onEdit, onStartReading }) => {
  const paragraphs = createDocumentParagraphs(text);

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
    <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-12 sm:px-8">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-base-300 pb-5">
        <div>
          <p className="text-sm font-medium text-primary">Stillpoint</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Document</h1>
        </div>

        <div className="flex gap-3">
          <button type="button" className="btn btn-soft" onClick={onEdit}>
            <Edit3 className="size-4" />
            Edit document
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onStartReading()}
          >
            <Play className="size-4 fill-current" />
            Resume reading
          </button>
        </div>
      </header>

      <article
        aria-label="Document content"
        className="space-y-6 text-lg leading-8 text-base-content/90 sm:text-xl sm:leading-9"
      >
        {paragraphs.map((paragraph, index) => {
          const isCurrent = paragraph.id === readingPosition?.blockId;

          return (
            <div key={paragraph.id} className="group relative">
              <p
                id={paragraph.id}
                aria-current={isCurrent ? 'location' : undefined}
                data-token-offset={
                  isCurrent ? readingPosition.tokenOffset : undefined
                }
                className={`scroll-mt-8 whitespace-pre-line rounded-lg p-4 pr-16 transition-colors motion-reduce:transition-none ${
                  isCurrent ? 'bg-primary/5 ring-1 ring-primary/20' : ''
                }`}
              >
                {paragraph.text}
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
