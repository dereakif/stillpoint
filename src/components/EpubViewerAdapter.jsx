import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { EpubViewer } from 'react-epub-viewer';
import { DEFAULT_EPUB_READER_SETTINGS } from '../storage/epubReaderSettings';
import { createBoundedEpubSession } from '../epub/boundedSession';
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
      onInitialLocationRestored,
      onLocationChange,
      onPageChange,
      onTocChange,
      onWordClick,
      reduceEffects = false,
      returnCfi,
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
    const restoringInitialCfiRef = useRef(false);
    const initialRestoreKeyRef = useRef(null);
    const returnMarkerRef = useRef(null);
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

    const clearReturnMarker = () => {
      const marker = returnMarkerRef.current;
      if (!marker) return;
      marker.rendition.annotations.remove(marker.cfi, 'highlight');
      returnMarkerRef.current = null;
    };

    const showReturnMarker = (rendition, cfi) => {
      if (!cfi || !rendition?.annotations) return;
      clearReturnMarker();
      rendition.annotations.highlight(
        cfi,
        { stillpointReturnPosition: true },
        undefined,
        'stillpoint-return-position',
        {
          fill: '#facc15',
          'fill-opacity': '0.45',
          'mix-blend-mode': 'normal',
        }
      );
      returnMarkerRef.current = { rendition, cfi };
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
        clearReturnMarker();
        detachRenditionHooks(renditionRef.current);
      },
      []
    );

    const handleRenditionChanged = (rendition) => {
      detachRenditionHooks(renditionRef.current);
      restoringInitialCfiRef.current = Boolean(initialCfi);

      const handleRelocated = (location) => {
        const cfi = location?.start?.cfi;
        const percentage = Number(location?.start?.percentage);
        if (!cfi) return;

        if (!restoringInitialCfiRef.current) {
          onLocationChangeRef.current?.({
            cfi,
            percentage: Number.isFinite(percentage)
              ? clampPercentage(percentage)
              : 0,
          });
        }

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

        let hoveredCfi = null;
        let hoverAnimationFrame = null;
        let hoverPulseFrame = null;
        let hoverGlassDefinition = null;
        const cursorElement = contents.document.documentElement;
        const originalCursor = cursorElement.style.getPropertyValue('cursor');
        const originalCursorPriority =
          cursorElement.style.getPropertyPriority('cursor');

        const setWordCursor = (isInteractive) => {
          if (isInteractive) {
            cursorElement.style.setProperty('cursor', 'pointer', 'important');
          } else if (originalCursor) {
            cursorElement.style.setProperty(
              'cursor',
              originalCursor,
              originalCursorPriority
            );
          } else {
            cursorElement.style.removeProperty('cursor');
          }
        };

        const clearHoveredWord = () => {
          if (hoverAnimationFrame !== null) {
            window.cancelAnimationFrame(hoverAnimationFrame);
            hoverAnimationFrame = null;
          }
          if (hoverPulseFrame !== null) {
            window.cancelAnimationFrame(hoverPulseFrame);
            hoverPulseFrame = null;
          }
          hoverGlassDefinition?.remove();
          hoverGlassDefinition = null;
          setWordCursor(false);
          if (!hoveredCfi) return;
          rendition.annotations.remove(hoveredCfi, 'underline');
          hoveredCfi = null;
        };

        const animateHoveredWord = (annotation) => {
          const element = annotation?.mark?.element;
          const svg = element?.ownerSVGElement;
          if (!element || !svg) return;
          element.style.pointerEvents = 'none';
          element.querySelectorAll('line').forEach((line) => line.remove());

          const namespace = 'http://www.w3.org/2000/svg';
          const definitions = svg.ownerDocument.createElementNS(
            namespace,
            'defs'
          );
          const gradient = svg.ownerDocument.createElementNS(
            namespace,
            'linearGradient'
          );
          const gradientId = `stillpoint-glass-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2)}`;
          gradient.id = gradientId;
          gradient.setAttribute('x1', '-100%');
          gradient.setAttribute('x2', '0%');
          gradient.setAttribute('y1', '0%');
          gradient.setAttribute('y2', '100%');

          [
            ['0%', '#ffffff', '0.08'],
            ['28%', '#f5f5f4', '0.18'],
            ['48%', '#ffffff', '0.88'],
            ['66%', '#e7e5e4', '0.14'],
            ['100%', '#ffffff', '0.06'],
          ].forEach(([offset, color, opacity]) => {
            const stop = svg.ownerDocument.createElementNS(namespace, 'stop');
            stop.setAttribute('offset', offset);
            stop.setAttribute('stop-color', color);
            stop.setAttribute('stop-opacity', opacity);
            gradient.appendChild(stop);
          });
          definitions.appendChild(gradient);
          svg.prepend(definitions);
          hoverGlassDefinition = definitions;

          const rectangles = [...element.querySelectorAll('rect')];
          rectangles.forEach((rectangle) => {
            rectangle.setAttribute('fill', `url(#${gradientId})`);
            rectangle.setAttribute('fill-opacity', '0.5');
            rectangle.setAttribute('stroke', '#ffffff');
            rectangle.setAttribute('stroke-opacity', '0.9');
            rectangle.setAttribute('stroke-width', '1.15');
            rectangle.setAttribute('rx', '5');
            rectangle.style.filter =
              'drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.22)) drop-shadow(0 -1px 1px rgba(255, 255, 255, 0.9))';
            rectangle.style.transformBox = 'fill-box';
            rectangle.style.transformOrigin = 'center';
          });

          if (reduceEffects) return;

          const startedAt = window.performance.now();
          const renderGlassFrame = (timestamp) => {
            if (!hoveredCfi) return;
            const elapsed = timestamp - startedAt;
            const wave = (Math.sin((elapsed / 1400) * Math.PI * 2) + 1) / 2;
            const sweep =
              (Math.sin((elapsed / 2600) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
            gradient.setAttribute('x1', `${-120 + sweep * 220}%`);
            gradient.setAttribute('x2', `${-20 + sweep * 220}%`);
            rectangles.forEach((rectangle) => {
              rectangle.setAttribute('fill-opacity', String(0.3 + wave * 0.32));
              rectangle.setAttribute(
                'stroke-opacity',
                String(0.28 + wave * 0.26)
              );
              rectangle.style.transform = `scale(${0.985 + wave * 0.05}, ${
                0.93 + wave * 0.14
              })`;
            });
            hoverPulseFrame = window.requestAnimationFrame(renderGlassFrame);
          };
          hoverPulseFrame = window.requestAnimationFrame(renderGlassFrame);
        };

        const resolveEventWord = (event) => {
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
            return null;
          }

          const selection = contents.window?.getSelection?.();
          if (
            selection &&
            !selection.isCollapsed &&
            selection.toString().trim()
          ) {
            return null;
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
          if (!caret?.node || !word) return null;

          const range = contents.document.createRange();
          range.setStart(caret.node, word.start);
          range.setEnd(caret.node, word.end);
          return {
            caret,
            word,
            cfiRange: contents.cfiFromRange(range),
          };
        };

        const handleMouseMove = (event) => {
          if (!onWordClickRef.current) {
            clearHoveredWord();
            return;
          }

          if (hoverAnimationFrame !== null) {
            window.cancelAnimationFrame(hoverAnimationFrame);
          }
          hoverAnimationFrame = window.requestAnimationFrame(() => {
            hoverAnimationFrame = null;
            const resolvedWord = resolveEventWord(event);
            if (!resolvedWord) {
              clearHoveredWord();
              return;
            }

            if (hoveredCfi === resolvedWord.cfiRange) {
              setWordCursor(true);
              return;
            }
            clearHoveredWord();
            setWordCursor(true);
            const annotation = rendition.annotations.underline(
              resolvedWord.cfiRange,
              { stillpointWordHover: true },
              undefined,
              'stillpoint-word-hover'
            );
            hoveredCfi = resolvedWord.cfiRange;
            animateHoveredWord(annotation);
          });
        };

        const handleClick = (event) => {
          const resolvedWord = resolveEventWord(event);
          if (!resolvedWord) return;
          const { caret, word, cfiRange } = resolvedWord;
          const section = rendition.book.spine.get(contents.sectionIndex);
          const navigationItem = section?.href
            ? rendition.book.navigation.get(section.href)
            : null;

          const sectionHref = section?.href || null;
          const chapterLabel = navigationItem?.label?.trim() || null;
          const session = createBoundedEpubSession(
            contents,
            caret.node,
            caret.offset,
            word,
            {
              title: chapterLabel || 'EPUB excerpt',
              sectionHref,
              sourceCfi: cfiRange,
            }
          );
          if (!session) return;

          onWordClickRef.current?.({
            text: word.text,
            cfiRange,
            sectionHref,
            chapterLabel,
            startOffset: word.start,
            endOffset: word.end,
            session,
          });
        };

        contents.document.addEventListener('click', handleClick);
        contents.document.addEventListener('mousemove', handleMouseMove);
        contents.document.addEventListener('mouseleave', clearHoveredWord);
        contentCleanupRef.current.set(contents, () => {
          clearHoveredWord();
          contents.document.removeEventListener('click', handleClick);
          contents.document.removeEventListener('mousemove', handleMouseMove);
          contents.document.removeEventListener('mouseleave', clearHoveredWord);
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

      if (initialCfi) {
        rendition.display(initialCfi).finally(() => {
          restoringInitialCfiRef.current = false;
          if (returnCfi === initialCfi) showReturnMarker(rendition, returnCfi);
          onInitialLocationRestored?.(initialCfi);
        });
      }
    };

    if (initialRestoreKeyRef.current !== bookUrl) {
      initialRestoreKeyRef.current = bookUrl;
      restoringInitialCfiRef.current = Boolean(bookUrl && initialCfi);
    }

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
              if (restoringInitialCfiRef.current) return;
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
