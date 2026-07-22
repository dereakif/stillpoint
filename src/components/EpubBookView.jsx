import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import EpubViewerAdapter from './EpubViewerAdapter';

const initialPageInfo = (book) => ({
  chapterName: book.reading?.chapterLabel || '',
  currentPage: 0,
  totalPage: 0,
});

const EpubBookView = ({
  book,
  onBookInfoChange,
  onLibrary,
  onLocationChange,
}) => {
  const viewerRef = useRef(null);
  const contentsButtonRef = useRef(null);
  const contentsDialogRef = useRef(null);
  const [toc, setToc] = useState([]);
  const [isContentsOpen, setIsContentsOpen] = useState(false);
  const [pageInfo, setPageInfo] = useState(() => initialPageInfo(book));

  const closeContents = useCallback(() => {
    setIsContentsOpen(false);
    window.requestAnimationFrame(() => contentsButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isContentsOpen) return undefined;

    const containDialogFocus = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeContents();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = contentsDialogRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  }, [closeContents, isContentsOpen]);

  const currentPage = Number(pageInfo.currentPage);
  const totalPage = Number(pageInfo.totalPage);
  const hasLocation =
    Number.isFinite(currentPage) && Number.isFinite(totalPage) && totalPage > 0;
  const displayedPage = hasLocation
    ? Math.min(totalPage, Math.max(1, currentPage + 1))
    : null;

  return (
    <section className="flex h-screen min-h-0 flex-col overflow-hidden bg-base-100">
      <header className="shrink-0 border-b border-base-300 bg-base-100">
        <div className="flex min-h-16 w-full items-center gap-2 px-3 py-2 sm:gap-3 sm:px-5">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Library"
            onClick={onLibrary}
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Library</span>
          </button>
          <button
            ref={contentsButtonRef}
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Open contents"
            aria-expanded={isContentsOpen}
            onClick={() => setIsContentsOpen(true)}
          >
            <List className="size-4" />
            <span className="hidden sm:inline">Contents</span>
          </button>
          <BookOpen className="hidden size-5 text-primary md:block" />
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
          ref={viewerRef}
          file={book.source.file}
          initialCfi={book.reading?.cfi}
          onBookInfoChange={onBookInfoChange}
          onLocationChange={onLocationChange}
          onPageChange={setPageInfo}
          onTocChange={setToc}
        />
      </div>

      <nav
        aria-label="Book pagination"
        className="grid min-h-14 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-base-300 bg-base-100 px-2 py-2 sm:px-4"
      >
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label="Previous page"
          onClick={() => viewerRef.current?.prevPage()}
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <div className="min-w-0 text-center" aria-live="polite">
          <p className="truncate text-xs font-medium text-base-content/75">
            {pageInfo.chapterName || 'Reading'}
          </p>
          <p className="text-[0.6875rem] text-base-content/50">
            {hasLocation
              ? `Page ${displayedPage} of ${totalPage}`
              : 'Finding location…'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label="Next page"
          onClick={() => viewerRef.current?.nextPage()}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </button>
      </nav>

      {isContentsOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Dismiss contents"
            className="absolute inset-0 bg-base-300/55 backdrop-blur-xs"
            onClick={closeContents}
          />
          <aside
            ref={contentsDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Table of contents"
            className="absolute inset-y-0 left-0 flex w-[min(24rem,92vw)] flex-col border-r border-base-300 bg-base-100 shadow-2xl"
          >
            <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-base-300 px-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {book.title}
                </p>
                <h2 className="text-lg font-semibold">Contents</h2>
              </div>
              <button
                type="button"
                autoFocus
                className="btn btn-circle btn-ghost btn-sm"
                aria-label="Close contents"
                onClick={closeContents}
              >
                <X className="size-4" />
              </button>
            </header>
            <nav
              aria-label="EPUB contents"
              className="min-h-0 flex-1 overflow-y-auto p-3"
            >
              {toc.length ? (
                <ol className="space-y-1">
                  {toc.map((entry, index) => (
                    <li key={`${entry.href}-${index}`}>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2.5 text-left text-sm leading-5 transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        onClick={() => {
                          viewerRef.current?.setLocation(entry.href);
                          closeContents();
                        }}
                      >
                        {entry.label?.trim() || `Section ${index + 1}`}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-3 py-8 text-center text-sm text-base-content/55">
                  This EPUB does not provide a table of contents.
                </p>
              )}
            </nav>
          </aside>
        </div>
      )}
    </section>
  );
};

export default EpubBookView;
