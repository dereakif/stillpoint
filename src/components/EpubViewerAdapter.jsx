import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { EpubViewer } from 'react-epub-viewer';
import { DEFAULT_EPUB_READER_SETTINGS } from '../storage/epubReaderSettings';
import {
  caretPositionFromPoint,
  findWordAtOffset,
} from '../epub/wordSelection';

const FONT_STACKS = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: 'Arial, Helvetica, sans-serif',
  system:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const applyTypography = (rendition, settings) => {
  if (!rendition) return;

  const body = {
    'font-size': `${settings.fontSize}px !important`,
    'line-height': `${settings.lineHeight} !important`,
  };
  const fontFamily = FONT_STACKS[settings.fontFamily];
  if (fontFamily) body['font-family'] = `${fontFamily} !important`;

  rendition.themes.register('stillpoint-reader', {
    body,
    p: {
      'font-size': 'inherit !important',
      'line-height': 'inherit !important',
    },
  });
  rendition.themes.select('stillpoint-reader');
};

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
      onWordClick,
      settings = DEFAULT_EPUB_READER_SETTINGS,
    },
    ref
  ) => {
    const viewerRef = useRef(null);
    const renditionRef = useRef(null);
    const relocatedHandlerRef = useRef(null);
    const contentHookRef = useRef(null);
    const unloadedHookRef = useRef(null);
    const contentCleanupRef = useRef(new Map());
    const onLocationChangeRef = useRef(onLocationChange);
    const onPageChangeRef = useRef(onPageChange);
    const onWordClickRef = useRef(onWordClick);
    const [bookUrl, setBookUrl] = useState(null);

    useEffect(() => {
      onLocationChangeRef.current = onLocationChange;
      onPageChangeRef.current = onPageChange;
      onWordClickRef.current = onWordClick;
    }, [onLocationChange, onPageChange, onWordClick]);

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

    useEffect(() => {
      applyTypography(renditionRef.current, settings);
    }, [settings]);

    const detachContentListeners = () => {
      contentCleanupRef.current.forEach((cleanup) => cleanup());
      contentCleanupRef.current.clear();
    };

    const detachRenditionHooks = (rendition) => {
      if (!rendition) return;
      if (relocatedHandlerRef.current) {
        rendition.off('relocated', relocatedHandlerRef.current);
      }
      if (contentHookRef.current) {
        rendition.hooks.content.deregister(contentHookRef.current);
      }
      if (unloadedHookRef.current) {
        rendition.hooks.unloaded.deregister(unloadedHookRef.current);
      }
      detachContentListeners();
    };

    useEffect(
      () => () => {
        detachRenditionHooks(renditionRef.current);
      },
      []
    );

    const handleRenditionChanged = (rendition) => {
      detachRenditionHooks(renditionRef.current);

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

      const attachContentListener = (contents) => {
        if (!contents?.document || contentCleanupRef.current.has(contents))
          return;

        const handleClick = (event) => {
          const target =
            event.target?.nodeType === 1
              ? event.target
              : event.target?.parentElement;
          if (
            !target ||
            target.closest(
              'a, button, input, textarea, select, option, label, img, svg, video, audio, [role="button"], [contenteditable="true"]'
            )
          ) {
            return;
          }

          const selection = contents.window?.getSelection?.();
          if (
            selection &&
            !selection.isCollapsed &&
            selection.toString().trim()
          ) {
            return;
          }

          const caret = caretPositionFromPoint(
            contents.document,
            event.clientX,
            event.clientY
          );
          const text = caret?.node?.textContent;
          const word = findWordAtOffset(
            text,
            caret?.offset,
            contents.document.documentElement?.lang || undefined
          );
          if (!caret?.node || !word) return;

          const range = contents.document.createRange();
          range.setStart(caret.node, word.start);
          range.setEnd(caret.node, word.end);
          const cfiRange = contents.cfiFromRange(range);
          const section = rendition.book.spine.get(contents.sectionIndex);
          const navigationItem = section?.href
            ? rendition.book.navigation.get(section.href)
            : null;

          onWordClickRef.current?.({
            text: word.text,
            cfiRange,
            sectionHref: section?.href || null,
            chapterLabel: navigationItem?.label?.trim() || null,
            startOffset: word.start,
            endOffset: word.end,
          });
        };

        contents.document.addEventListener('click', handleClick);
        contentCleanupRef.current.set(contents, () => {
          contents.document.removeEventListener('click', handleClick);
        });
      };

      const detachContentListener = (view) => {
        const contents = view?.contents;
        const cleanup = contentCleanupRef.current.get(contents);
        cleanup?.();
        contentCleanupRef.current.delete(contents);
      };

      renditionRef.current = rendition;
      relocatedHandlerRef.current = handleRelocated;
      contentHookRef.current = attachContentListener;
      unloadedHookRef.current = detachContentListener;
      applyTypography(rendition, settings);
      rendition.on('relocated', handleRelocated);
      rendition.hooks.content.register(attachContentListener);
      rendition.hooks.unloaded.register(detachContentListener);

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

    const verticalMargin =
      settings.flow === 'paginated' ? settings.marginVertical : 0;

    return (
      <div
        data-testid="epub-viewer-frame"
        data-flow={settings.flow}
        data-spread={settings.spread}
        className="flex h-full min-h-0 bg-white"
        style={{
          padding: `${verticalMargin}px ${settings.marginHorizontal}px`,
        }}
      >
        <div className="min-h-0 min-w-0 flex-1">
          <EpubViewer
            key={bookUrl}
            ref={viewerRef}
            url={bookUrl}
            epubFileOptions={{ openAs: 'epub' }}
            epubOptions={{
              allowScriptedContent: false,
              flow: settings.flow,
              resizeOnOrientationChange: true,
              spread: settings.spread,
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
        </div>
      </div>
    );
  }
);

EpubViewerAdapter.displayName = 'EpubViewerAdapter';

export default EpubViewerAdapter;
