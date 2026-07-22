import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { EpubViewer } from 'react-epub-viewer';

const clampPercentage = (value) => Math.min(1, Math.max(0, value));

const EpubViewerAdapter = forwardRef(
  (
    {
      file,
      initialCfi,
      onBookInfoChange,
      onLocationChange,
      onPageChange,
      onTocChange,
    },
    ref
  ) => {
    const viewerRef = useRef(null);
    const renditionRef = useRef(null);
    const relocatedHandlerRef = useRef(null);
    const onLocationChangeRef = useRef(onLocationChange);
    const onPageChangeRef = useRef(onPageChange);
    const [bookUrl, setBookUrl] = useState(null);

    useEffect(() => {
      onLocationChangeRef.current = onLocationChange;
      onPageChangeRef.current = onPageChange;
    }, [onLocationChange, onPageChange]);

    useImperativeHandle(
      ref,
      () => ({
        nextPage: () => viewerRef.current?.nextPage?.(),
        prevPage: () => viewerRef.current?.prevPage?.(),
        setLocation: (location) => viewerRef.current?.setLocation?.(location),
      }),
      []
    );

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

        const displayedPage = Number(location?.start?.displayed?.page);
        const displayedTotal = Number(location?.start?.displayed?.total);
        const locationHref = location?.start?.href;
        const navigationItem = locationHref
          ? rendition.book.navigation.get(locationHref)
          : null;
        onPageChangeRef.current?.({
          chapterName: navigationItem?.label?.trim() || '',
          currentPage:
            Number.isFinite(displayedPage) && displayedPage > 0
              ? displayedPage - 1
              : 0,
          totalPage:
            Number.isFinite(displayedTotal) && displayedTotal > 0
              ? displayedTotal
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
        tocChanged={(toc) => onTocChange?.(toc)}
        pageChanged={(page) => {
          onLocationChangeRef.current?.({
            cfi: page.startCfi,
            percentage:
              page.totalPage > 0
                ? clampPercentage(page.currentPage / page.totalPage)
                : 0,
            chapterLabel: page.chapterName || null,
          });
        }}
        loadingView={
          <div className="flex h-full items-center justify-center gap-3 bg-white text-neutral-700">
            <span className="loading loading-spinner loading-md" />
            Opening EPUB…
          </div>
        }
      />
    );
  }
);

EpubViewerAdapter.displayName = 'EpubViewerAdapter';

export default EpubViewerAdapter;
