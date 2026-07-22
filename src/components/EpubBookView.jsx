import { ArrowLeft, BookOpen } from 'lucide-react';
import EpubViewerAdapter from './EpubViewerAdapter';

const EpubBookView = ({
  book,
  onBookInfoChange,
  onLibrary,
  onLocationChange,
}) => (
  <section className="flex h-screen min-h-0 flex-col overflow-hidden bg-base-100">
    <header className="shrink-0 border-b border-base-300 bg-base-100">
      <div className="flex min-h-16 w-full items-center gap-3 px-3 py-2 sm:px-5">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onLibrary}
        >
          <ArrowLeft className="size-4" />
          Library
        </button>
        <BookOpen className="hidden size-5 text-primary sm:block" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold sm:text-lg">
            {book.title}
          </h1>
          <p className="truncate text-xs text-base-content/55">
            {book.authors?.length
              ? book.authors.join(', ')
              : book.source.fileName}
          </p>
        </div>
      </div>
    </header>

    <div
      className="relative min-h-0 flex-1"
      aria-label={`${book.title} reader`}
    >
      <EpubViewerAdapter
        file={book.source.file}
        initialCfi={book.reading?.cfi}
        onBookInfoChange={onBookInfoChange}
        onLocationChange={onLocationChange}
      />
    </div>
  </section>
);

export default EpubBookView;
