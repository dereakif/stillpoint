import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EpubViewer } from 'react-epub-viewer';

const clampPercentage = (value) => Math.min(1, Math.max(0, value));

const EpubViewerAdapter = ({
  file,
  initialCfi,
  onBookInfoChange,
  onLocationChange,
}) => {
  const viewerRef = useRef(null);
  const renditionRef = useRef(null);
  const relocatedHandlerRef = useRef(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const [bookUrl, setBookUrl] = useState(null);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    if (!file) {
      setBookUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setBookUrl(objectUrl);

    return () => {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    };
  }, [file]);

  useEffect(
    () => () => {
      if (renditionRef.current && relocatedHandlerRef.current) {
        renditionRef.current.off('relocated', relocatedHandlerRef.current);
      }
    },
    []
  );

  const handleRenditionChanged = (rendition) => {
    if (renditionRef.current && relocatedHandlerRef.current) {
      renditionRef.current.off('relocated', relocatedHandlerRef.current);
    }

    const handleRelocated = (location) => {
      const cfi = location?.start?.cfi;
      const percentage = Number(location?.start?.percentage);
      if (!cfi) return;

      onLocationChangeRef.current?.({
        cfi,
        percentage: Number.isFinite(percentage)
          ? clampPercentage(percentage)
          : 0,
      });
    };

    renditionRef.current = rendition;
    relocatedHandlerRef.current = handleRelocated;
    rendition.on('relocated', handleRelocated);

    if (initialCfi) rendition.display(initialCfi);
  };

  if (!bookUrl) {
    return (
      <div className="flex h-full items-center justify-center gap-3 bg-white text-neutral-700">
        <span className="loading loading-spinner loading-md" />
        Preparing EPUB…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="min-h-0 flex-1">
        <EpubViewer
          key={bookUrl}
          ref={viewerRef}
          url={bookUrl}
          epubFileOptions={{ openAs: 'epub' }}
          epubOptions={{
            allowScriptedContent: false,
            flow: 'paginated',
            resizeOnOrientationChange: true,
            spread: 'none',
          }}
          style={{ height: '100%', width: '100%' }}
          bookChanged={(book) => {
            book.loaded.metadata
              .then((metadata) => {
                onBookInfoChange?.({
                  title: metadata.title,
                  author: metadata.creator,
                  language: metadata.language,
                });
              })
              .catch(() => {
                // Metadata is optional; rendering can continue without it.
              });
          }}
          rendtionChanged={handleRenditionChanged}
          pageChanged={(page) => {
            if (!page.chapterName) return;
            onLocationChangeRef.current?.({
              cfi: page.startCfi,
              percentage:
                page.totalPage > 0
                  ? clampPercentage(page.currentPage / page.totalPage)
                  : 0,
              chapterLabel: page.chapterName,
            });
          }}
          loadingView={
            <div className="flex h-full items-center justify-center gap-3 bg-white text-neutral-700">
              <span className="loading loading-spinner loading-md" />
              Opening EPUB…
            </div>
          }
        />
      </div>
      <nav
        aria-label="Book pagination"
        className="flex h-13 shrink-0 items-center justify-center gap-3 border-t border-neutral-200 bg-white px-4 text-neutral-800"
      >
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label="Previous page"
          onClick={() => viewerRef.current?.prevPage?.()}
        >
          <ChevronLeft className="size-4" />
          Previous
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label="Next page"
          onClick={() => viewerRef.current?.nextPage?.()}
        >
          Next
          <ChevronRight className="size-4" />
        </button>
      </nav>
    </div>
  );
};

export default EpubViewerAdapter;
