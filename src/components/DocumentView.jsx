import { Edit3, Play } from 'lucide-react';
import { createDocumentParagraphs } from '../utils';

const DocumentView = ({ text, onEdit, onStartReading }) => {
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
            onClick={onStartReading}
          >
            <Play className="size-4 fill-current" />
            Immerse
          </button>
        </div>
      </header>

      <article
        aria-label="Document content"
        className="space-y-6 text-lg leading-8 text-base-content/90 sm:text-xl sm:leading-9"
      >
        {paragraphs.map((paragraph) => (
          <p
            key={paragraph.id}
            id={paragraph.id}
            className="whitespace-pre-line scroll-mt-8"
          >
            {paragraph.text}
          </p>
        ))}
      </article>
    </section>
  );
};

export default DocumentView;
