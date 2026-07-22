import { ArrowLeft, BookOpen, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ReactEpubViewer } from 'react-epub-viewer';

const EpubViewerExperiment = () => {
  const inputRef = useRef(null);
  const viewerRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [bookUrl, setBookUrl] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const releaseBook = () => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  };

  useEffect(
    () => () => {
      releaseBook();
    },
    []
  );

  const openBook = (file) => {
    if (!file) return;
    if (!/\.epub$/i.test(file.name) && file.type !== 'application/epub+zip') {
      setFeedback('Choose an EPUB file.');
      return;
    }

    releaseBook();
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setBookUrl(objectUrl);
    setFileName(file.name);
    setFeedback(null);
  };

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-base-100">
      <input
        ref={inputRef}
        type="file"
        accept=".epub,application/epub+zip"
        aria-label="Choose EPUB for simple viewer"
        className="sr-only"
        onChange={(event) => {
          openBook(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      <header className="shrink-0 border-b border-base-300 bg-base-100">
        <div className="mx-auto flex min-h-16 w-full items-center gap-3 px-4 py-3 sm:px-6">
          <a href="/" className="btn btn-ghost btn-sm" onClick={releaseBook}>
            <ArrowLeft className="size-4" />
            Stillpoint
          </a>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">
              {fileName || 'Simple EPUB viewer'}
            </h1>
            <p className="truncate text-xs text-base-content/55">
              Direct local rendering with react-epub-viewer
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {bookUrl ? 'Open another EPUB' : 'Open EPUB'}
          </button>
        </div>
      </header>

      {feedback && (
        <div
          role="alert"
          className="shrink-0 border-b border-error/30 bg-error/10 px-4 py-2 text-sm"
        >
          {feedback}
        </div>
      )}

      <section
        aria-label="Simple EPUB viewer"
        className="relative min-h-0 flex-1"
      >
        {bookUrl ? (
          <ReactEpubViewer
            key={bookUrl}
            ref={viewerRef}
            url={bookUrl}
            epubFileOptions={{ openAs: 'epub' }}
            viewerOption={{
              flow: 'paginated',
              resizeOnOrientationChange: true,
              spread: 'none',
            }}
            loadingView={
              <div className="flex h-full items-center justify-center gap-3 bg-white text-neutral-700">
                <span className="loading loading-spinner loading-md" />
                Opening EPUB…
              </div>
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md text-center">
              <BookOpen className="mx-auto size-12 text-primary" />
              <h2 className="mt-5 text-2xl font-semibold">Open a local EPUB</h2>
              <p className="mt-2 text-sm leading-6 text-base-content/60">
                This experimental page renders the EPUB directly with Epub.js.
                The file stays in this browser session and is not added to your
                Stillpoint library.
              </p>
              <button
                type="button"
                className="btn btn-primary mt-6"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-4" />
                Choose EPUB
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
};

export default EpubViewerExperiment;
