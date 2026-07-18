import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3, Menu, Play, X } from 'lucide-react';
import { getReadingPositionSummary } from '../utils';
import TableOfContents from './TableOfContents';

const RETURN_HIGHLIGHT_DURATION = 1100;

const DocumentView = ({
  document: documentModel,
  readingPosition,
  returnContext,
  isImmersive = false,
  onEdit,
  onStartReading,
}) => {
  const paragraphs = documentModel.sections.flatMap(
    (section) => section.blocks
  );
  const positionSummary = getReadingPositionSummary(
    documentModel,
    readingPosition
  );
  const readingSection = documentModel.sections.find((section) =>
    section.blockIds.includes(readingPosition?.blockId)
  );
  const displayTitle =
    documentModel.title === 'Untitled document'
      ? (documentModel.sections.find((section) => section.title)?.title ??
        'Document')
      : documentModel.title;

  const [showReturnHighlight, setShowReturnHighlight] = useState(
    Boolean(returnContext)
  );
  const [activeSectionId, setActiveSectionId] = useState(
    readingSection?.id ?? documentModel.sections[0]?.id ?? null
  );
  const [isContentsCollapsed, setIsContentsCollapsed] = useState(false);
  const [isContentsDrawerOpen, setIsContentsDrawerOpen] = useState(false);
  const [keyboardTokenId, setKeyboardTokenId] = useState(() => {
    const token = documentModel.tokens.find(
      (candidate) =>
        candidate.blockId === readingPosition?.blockId &&
        candidate.tokenOffset === readingPosition?.tokenOffset
    );
    return token?.id ?? documentModel.tokens[0]?.id ?? null;
  });
  const contentsButtonRef = useRef(null);
  const drawerCloseButtonRef = useRef(null);

  useEffect(() => {
    if (!returnContext) return undefined;

    const currentToken = document.querySelector(
      `[data-block-id="${returnContext.position.blockId}"][data-token-offset="${returnContext.position.tokenOffset}"]`
    );
    const currentParagraph = document.getElementById(
      returnContext.position.blockId
    );
    const returnTarget = currentToken ?? currentParagraph;

    returnTarget?.scrollIntoView({ block: 'center', behavior: 'instant' });
    returnTarget?.focus({ preventScroll: true });
    setShowReturnHighlight(true);

    const highlightTimer = window.setTimeout(() => {
      setShowReturnHighlight(false);
    }, RETURN_HIGHLIGHT_DURATION);

    return () => window.clearTimeout(highlightTimer);
  }, [returnContext]);

  useEffect(() => {
    if (readingSection) setActiveSectionId(readingSection.id);
  }, [readingSection]);

  useEffect(() => {
    const token = documentModel.tokens.find(
      (candidate) =>
        candidate.blockId === readingPosition?.blockId &&
        candidate.tokenOffset === readingPosition?.tokenOffset
    );
    if (token) setKeyboardTokenId(token.id);
  }, [documentModel, readingPosition]);

  useEffect(() => {
    if (isImmersive) return undefined;

    let animationFrame = null;
    const updateVisibleSection = () => {
      animationFrame = null;
      const threshold = window.innerHeight * 0.3;
      let visibleSection = documentModel.sections[0];

      documentModel.sections.forEach((section) => {
        const anchor = document.getElementById(section.blockIds[0]);
        if (anchor && anchor.getBoundingClientRect().top <= threshold) {
          visibleSection = section;
        }
      });

      if (visibleSection) setActiveSectionId(visibleSection.id);
    };

    const handleScroll = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(updateVisibleSection);
    };

    updateVisibleSection();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [documentModel, isImmersive]);

  useEffect(() => {
    const requestedSectionId = decodeURIComponent(
      window.location.hash.slice(1)
    );
    const requestedSection = documentModel.sections.find(
      (section) => section.id === requestedSectionId
    );
    if (!requestedSection) return undefined;

    setActiveSectionId(requestedSection.id);
    const navigationFrame = window.requestAnimationFrame(() => {
      document
        .getElementById(requestedSection.blockIds[0])
        ?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });

    return () => window.cancelAnimationFrame(navigationFrame);
  }, [documentModel]);

  useEffect(() => {
    if (!activeSectionId) return;
    window.history.replaceState(null, '', `#${activeSectionId}`);
  }, [activeSectionId]);

  useEffect(() => {
    if (!isContentsDrawerOpen) return undefined;

    drawerCloseButtonRef.current?.focus();
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      setIsContentsDrawerOpen(false);
      contentsButtonRef.current?.focus();
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isContentsDrawerOpen]);

  const navigateToSection = (section) => {
    const anchor = document.getElementById(section.blockIds[0]);
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    setActiveSectionId(section.id);
    anchor?.scrollIntoView({
      block: 'start',
      behavior: reduceMotion ? 'instant' : 'smooth',
    });
    anchor?.focus({ preventScroll: true });
    setIsContentsDrawerOpen(false);
  };

  const hasDocumentSelection = () => {
    const selection = window.getSelection();
    return Boolean(
      selection && !selection.isCollapsed && selection.toString().trim()
    );
  };

  const startFromDelegatedTarget = (target) => {
    const blockElement = target.closest('[data-readable-block="true"]');
    if (!blockElement) return false;

    const entryBlockId = blockElement.dataset.entryBlockId;
    const tokenElement = target.closest('[data-token-id]');
    const blockType = blockElement.dataset.blockType;

    if (tokenElement && blockType !== 'heading') {
      onStartReading({
        blockId: tokenElement.dataset.blockId,
        tokenOffset: Number(tokenElement.dataset.tokenOffset),
      });
      return true;
    }

    if (entryBlockId) {
      onStartReading({ blockId: entryBlockId, tokenOffset: 0 });
      return true;
    }

    return false;
  };

  const handleDocumentClick = (event) => {
    if (event.target.closest('button, a, input, textarea, select')) return;
    if (hasDocumentSelection()) return;
    startFromDelegatedTarget(event.target);
  };

  const handleDocumentFocus = (event) => {
    const tokenElement = event.target.closest('[data-token-id]');
    if (tokenElement) setKeyboardTokenId(tokenElement.dataset.tokenId);
  };

  const handleDocumentKeyDown = (event) => {
    const tokenElement = event.target.closest('[data-token-id]');
    if (!tokenElement) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      startFromDelegatedTarget(tokenElement);
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    event.preventDefault();
    const currentIndex = documentModel.tokens.findIndex(
      (token) => token.id === tokenElement.dataset.tokenId
    );
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const nextToken =
      documentModel.tokens[
        Math.max(
          0,
          Math.min(documentModel.tokens.length - 1, currentIndex + direction)
        )
      ];
    if (!nextToken) return;

    setKeyboardTokenId(nextToken.id);
    window.requestAnimationFrame(() => {
      document
        .querySelector(`[data-token-id="${nextToken.id}"]`)
        ?.focus({ preventScroll: true });
    });
  };

  const renderBlockText = (block, isReturnTarget) => {
    if (!block.tokens.length) return block.text;

    const renderedContent = [];
    let sourceOffset = 0;

    block.tokens.forEach((token) => {
      const tokenStart = block.text.indexOf(token.text, sourceOffset);
      if (tokenStart === -1) return;

      if (tokenStart > sourceOffset) {
        renderedContent.push(block.text.slice(sourceOffset, tokenStart));
      }

      const isKeyboardToken = token.id === keyboardTokenId;
      const isReturnToken =
        isReturnTarget &&
        token.tokenOffset === returnContext.position.tokenOffset;

      renderedContent.push(
        <span
          key={token.id}
          role={isKeyboardToken ? 'button' : undefined}
          tabIndex={isKeyboardToken ? 0 : -1}
          aria-label={
            isKeyboardToken ? `Immerse from word ${token.text}` : undefined
          }
          data-token-id={token.id}
          data-block-id={token.blockId}
          data-token-offset={token.tokenOffset}
          data-highlight-kind={isReturnToken ? 'return-position' : undefined}
          data-testid={isReturnToken ? 'return-word-highlight' : undefined}
          className={`document-token cursor-pointer rounded-[0.2em] outline-none transition-colors motion-reduce:transition-none hover:bg-primary/12 focus:bg-primary/15 focus:ring-1 focus:ring-primary/40 ${
            isReturnToken ? 'return-word-highlight' : ''
          }`}
        >
          {token.text}
        </span>
      );
      sourceOffset = tokenStart + token.text.length;
    });

    if (sourceOffset < block.text.length) {
      renderedContent.push(block.text.slice(sourceOffset));
    }

    return renderedContent;
  };

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

  const shellTransition = isImmersive
    ? '-translate-y-2 opacity-15 blur-sm'
    : 'translate-y-0 opacity-100 blur-0';

  return (
    <section
      data-testid="document-view"
      inert={isImmersive}
      aria-hidden={isImmersive}
      className="min-h-screen w-full overflow-x-clip bg-base-100"
    >
      <header
        data-testid="document-top-bar"
        className={`sticky top-0 z-30 border-b border-base-300/80 bg-base-100/90 backdrop-blur-md transition-[opacity,filter,transform] duration-800 ease-out motion-reduce:transform-none motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:backdrop-blur-none motion-reduce:blur-none ${shellTransition}`}
      >
        <div className="mx-auto flex min-h-14 w-full max-w-360 items-center gap-3 px-4 sm:px-6">
          <button
            ref={contentsButtonRef}
            type="button"
            className="btn btn-ghost btn-sm lg:hidden"
            aria-expanded={isContentsDrawerOpen}
            aria-controls="mobile-contents-drawer"
            onClick={() => setIsContentsDrawerOpen(true)}
          >
            <Menu className="size-4" />
            Contents
          </button>

          <p className="hidden shrink-0 text-sm font-semibold text-primary sm:block">
            Stillpoint
          </p>
          <span
            aria-hidden="true"
            className="hidden h-4 w-px bg-base-300 sm:block"
          />
          <h1 className="min-w-0 flex-1 truncate text-center text-sm font-medium sm:text-left">
            {displayTitle}
          </h1>

          <button
            type="button"
            className="btn btn-ghost btn-sm shrink-0"
            aria-label="Edit document"
            onClick={onEdit}
          >
            <Edit3 className="size-4" />
            <span className="hidden sm:inline">Edit document</span>
            <span className="sm:hidden">Edit</span>
          </button>
        </div>
      </header>

      <div
        className={`mx-auto grid w-full max-w-360 transition-[grid-template-columns] duration-300 motion-reduce:transition-none ${
          isContentsCollapsed
            ? 'lg:grid-cols-[4.5rem_minmax(0,1fr)]'
            : 'lg:grid-cols-[15rem_minmax(0,1fr)]'
        }`}
      >
        <aside
          data-testid="desktop-table-of-contents"
          className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] min-w-0 self-start border-r border-base-300/70 bg-base-100 px-3 py-6 transition-[opacity,filter,transform] duration-800 ease-out motion-reduce:transform-none motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:blur-none lg:block ${shellTransition}`}
        >
          <div
            className={`mb-4 flex items-center ${
              isContentsCollapsed ? 'justify-center' : 'justify-between px-2'
            }`}
          >
            {!isContentsCollapsed && (
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/50">
                Contents
              </h2>
            )}
            <button
              type="button"
              className="btn btn-circle btn-ghost btn-sm"
              aria-label={
                isContentsCollapsed ? 'Expand contents' : 'Collapse contents'
              }
              aria-expanded={!isContentsCollapsed}
              onClick={() => setIsContentsCollapsed((collapsed) => !collapsed)}
            >
              {isContentsCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
            </button>
          </div>

          <TableOfContents
            sections={documentModel.sections}
            activeSectionId={activeSectionId}
            compact={isContentsCollapsed}
            onNavigate={navigateToSection}
            onStartReading={onStartReading}
          />
        </aside>

        <main className="min-w-0">
          <article
            aria-label="Document content"
            className="mx-auto max-w-3xl space-y-6 px-4 pb-36 pt-10 text-lg leading-8 text-base-content/90 sm:px-8 sm:pt-14 sm:text-xl sm:leading-9"
            onClick={handleDocumentClick}
            onFocusCapture={handleDocumentFocus}
            onKeyDown={handleDocumentKeyDown}
          >
            {paragraphs.map((paragraph, index) => {
              const isCurrent = paragraph.id === readingPosition?.blockId;
              const isReturnTarget =
                showReturnHighlight &&
                paragraph.id === returnContext?.position.blockId;
              const immersiveEntryBlock =
                paragraph.type === 'heading'
                  ? paragraphs
                      .slice(index + 1)
                      .find(
                        (candidate) =>
                          candidate.type !== 'heading' &&
                          candidate.tokens.length
                      )
                  : paragraph.tokens.length
                    ? paragraph
                    : null;
              const blockTypeClass =
                paragraph.type === 'heading'
                  ? 'mt-12 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl'
                  : paragraph.type === 'quote'
                    ? 'italic text-base-content/75'
                    : paragraph.type === 'list'
                      ? 'pl-7'
                      : '';

              if (paragraph.type === 'separator') {
                return (
                  <hr
                    key={paragraph.id}
                    id={paragraph.id}
                    data-block-type={paragraph.type}
                    data-section-id={paragraph.sectionId}
                    tabIndex={-1}
                    className="my-12 scroll-mt-24 border-base-300"
                  />
                );
              }

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
                    data-readable-block="true"
                    data-entry-block-id={immersiveEntryBlock?.id}
                    data-block-type={paragraph.type}
                    data-section-id={paragraph.sectionId}
                    tabIndex={-1}
                    aria-current={isCurrent ? 'location' : undefined}
                    data-position-marker={
                      isCurrent ? 'current-block' : undefined
                    }
                    data-token-offset={
                      isCurrent ? readingPosition.tokenOffset : undefined
                    }
                    className={`scroll-mt-24 whitespace-pre-line border-l-2 py-2 pl-4 pr-12 transition-colors hover:bg-base-200/20 focus-within:bg-base-200/20 motion-reduce:transition-none ${blockTypeClass} ${
                      isCurrent
                        ? 'border-primary bg-linear-to-r from-primary/7 to-transparent'
                        : 'border-transparent'
                    }`}
                  >
                    {renderBlockText(paragraph, isReturnTarget)}
                  </p>

                  {immersiveEntryBlock && (
                    <button
                      type="button"
                      aria-label={
                        paragraph.type === 'heading'
                          ? `Immerse after heading ${paragraph.text}`
                          : `Immerse from paragraph ${index + 1}`
                      }
                      className="btn btn-circle btn-ghost btn-sm absolute right-1 top-2 opacity-60 transition-opacity motion-reduce:transition-none hover:opacity-100 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      onClick={() =>
                        onStartReading({
                          blockId: immersiveEntryBlock.id,
                          tokenOffset: 0,
                        })
                      }
                    >
                      <Play className="size-4 fill-current" />
                    </button>
                  )}
                </div>
              );
            })}
          </article>
        </main>
      </div>

      <footer
        data-testid="document-status-bar"
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-base-300/80 bg-base-100/92 backdrop-blur-md transition-[opacity,filter,transform] duration-800 ease-out motion-reduce:transform-none motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:backdrop-blur-none motion-reduce:blur-none ${shellTransition}`}
      >
        <progress
          aria-label="Document progress"
          className="progress progress-primary absolute inset-x-0 top-0 h-0.5 w-full rounded-none"
          value={positionSummary?.percentage ?? 0}
          max="100"
        />
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-3 px-4 py-2 sm:px-8">
          <div className="min-w-0 flex-1">
            <p
              id="current-position-status"
              data-testid="current-position-status"
              aria-live="polite"
              className="truncate text-sm font-medium"
            >
              {positionSummary
                ? `Paragraph ${positionSummary.paragraphNumber} of ${positionSummary.paragraphCount} · Word ${positionSummary.wordNumber} of ${positionSummary.wordCount}`
                : 'No readable words'}
            </p>
            <p className="text-xs text-base-content/55">
              <span data-testid="document-progress-value">
                {positionSummary?.percentage ?? 0}%
              </span>{' '}
              of document
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm shrink-0"
            aria-describedby="current-position-status"
            disabled={!positionSummary}
            onClick={() => onStartReading()}
          >
            <Play className="size-3.5 fill-current" />
            Resume
            {positionSummary && (
              <span className="sr-only">
                {' '}
                reading Paragraph {positionSummary.paragraphNumber} ·{' '}
                {positionSummary.percentage}%
              </span>
            )}
          </button>
        </div>
      </footer>

      {isContentsDrawerOpen && (
        <div
          id="mobile-contents-drawer"
          className="fixed inset-0 z-35 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Document contents"
        >
          <button
            type="button"
            aria-label="Dismiss contents"
            tabIndex={-1}
            className="absolute inset-0 bg-base-300/55 backdrop-blur-xs"
            onClick={() => setIsContentsDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(20rem,88vw)] overflow-y-auto border-r border-base-300 bg-base-100 px-4 py-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Contents</h2>
              <button
                ref={drawerCloseButtonRef}
                type="button"
                className="btn btn-circle btn-ghost btn-sm"
                aria-label="Close contents"
                onClick={() => {
                  setIsContentsDrawerOpen(false);
                  contentsButtonRef.current?.focus();
                }}
              >
                <X className="size-4" />
              </button>
            </div>
            <TableOfContents
              sections={documentModel.sections}
              activeSectionId={activeSectionId}
              onNavigate={navigateToSection}
              onStartReading={(position) => {
                setIsContentsDrawerOpen(false);
                onStartReading(position);
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default DocumentView;
