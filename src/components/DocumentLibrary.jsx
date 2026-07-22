import {
  BookOpen,
  ClipboardPaste,
  Download,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';

const downloadJson = (filename, value) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const downloadFile = (file, fileName) => {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const formatLastOpened = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));

const DocumentLibrary = ({
  documents,
  onOpen,
  onImportEpub,
  onPasteAndRead,
  onRename,
  onDelete,
}) => {
  const epubInputRef = useRef(null);
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const textDocuments = documents.filter((record) => record.kind !== 'epub');

  const pasteAndRead = async () => {
    if (isReadingClipboard) return;
    setIsReadingClipboard(true);
    try {
      await onPasteAndRead();
    } finally {
      setIsReadingClipboard(false);
    }
  };

  const exportAll = () => {
    downloadJson('stillpoint-library-backup.json', {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      documents: textDocuments,
      omittedEpubs: documents
        .filter((record) => record.kind === 'epub')
        .map(({ id, title, source }) => ({
          id,
          title,
          fileName: source.fileName,
          reason: 'Export the original EPUB separately.',
        })),
    });
  };

  return (
    <section className="min-h-screen bg-base-100">
      <input
        ref={epubInputRef}
        type="file"
        accept=".epub,application/epub+zip"
        aria-label="Choose EPUB to import"
        className="sr-only"
        onChange={async (event) => {
          await onImportEpub(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <header className="border-b border-base-300/80">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-primary">Stillpoint</p>
            <h1 className="text-xl font-semibold tracking-tight">Library</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => epubInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Import EPUB
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!textDocuments.length}
              onClick={exportAll}
            >
              <Download className="size-4" />
              Export backup
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={isReadingClipboard}
              onClick={pasteAndRead}
            >
              {isReadingClipboard ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <ClipboardPaste className="size-4" />
              )}
              Paste and read
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight">
            Books and documents
          </h2>
          <p className="mt-2 text-sm leading-6 text-base-content/60">
            Books, pasted text, reading positions, and progress stay in this
            browser's local storage. Nothing is uploaded by Stillpoint. Export
            anything you need before clearing browser data or moving devices.
          </p>
        </div>

        {documents.length ? (
          <ul className="divide-y divide-base-300 border-y border-base-300">
            {documents.map((documentRecord) => {
              const percentage = Math.round(
                (documentRecord.progress ?? 0) * 100
              );

              return (
                <li
                  key={documentRecord.id}
                  className="group flex flex-col gap-4 py-5 sm:flex-row sm:items-center"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onOpen(documentRecord)}
                  >
                    <span className="flex items-center gap-2">
                      {documentRecord.kind === 'epub' && (
                        <BookOpen className="size-4 shrink-0 text-primary" />
                      )}
                      <span className="block truncate text-lg font-medium group-hover:text-primary">
                        {documentRecord.title}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-base-content/50">
                      {documentRecord.kind === 'epub' &&
                      documentRecord.authors?.length
                        ? `${documentRecord.authors.join(', ')} · `
                        : ''}
                      Last opened{' '}
                      {formatLastOpened(documentRecord.lastOpenedAt)}
                    </span>
                    <span className="mt-3 flex items-center gap-3 text-xs text-base-content/55">
                      <progress
                        aria-label={`${documentRecord.title} progress`}
                        className="progress progress-primary h-1.5 w-full max-w-56"
                        value={percentage}
                        max="100"
                      />
                      {percentage}%
                    </span>
                  </button>

                  <div className="flex shrink-0 gap-1 sm:opacity-60 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100 motion-reduce:transition-none">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label={`Export ${documentRecord.title}`}
                      onClick={() => {
                        if (documentRecord.kind === 'epub') {
                          downloadFile(
                            documentRecord.source.file,
                            documentRecord.source.fileName
                          );
                          return;
                        }
                        downloadJson(
                          `${documentRecord.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'document'}.stillpoint.json`,
                          documentRecord
                        );
                      }}
                    >
                      <Download className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label={`Rename ${documentRecord.title}`}
                      onClick={() => {
                        setRenameTarget(documentRecord);
                        setRenameDraft(documentRecord.title);
                      }}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-error"
                      aria-label={`Delete ${documentRecord.title}`}
                      onClick={() => setDeleteTarget(documentRecord)}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border-y border-base-300 py-14 text-center">
            <p className="text-lg font-medium">No saved documents yet</p>
            <p className="mt-2 text-sm text-base-content/55">
              Import an EPUB or paste text to begin your local reading library.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => epubInputRef.current?.click()}
              >
                <Upload className="size-4" />
                Import EPUB
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={isReadingClipboard}
                onClick={pasteAndRead}
              >
                {isReadingClipboard ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <ClipboardPaste className="size-4" />
                )}
                Paste and read
              </button>
            </div>
          </div>
        )}
      </div>

      {renameTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rename document"
          className="fixed inset-0 z-50 flex items-center justify-center bg-base-300/60 px-4 backdrop-blur-sm"
        >
          <form
            className="w-full max-w-sm rounded-xl border border-base-300 bg-base-100 p-5 shadow-2xl"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!renameDraft.trim()) return;
              await onRename(renameTarget.id, renameDraft.trim());
              setRenameTarget(null);
            }}
          >
            <h2 className="text-lg font-semibold">Rename document</h2>
            <input
              autoFocus
              aria-label="Document title"
              className="input mt-4 w-full"
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!renameDraft.trim()}
              >
                Save title
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Delete document"
          className="fixed inset-0 z-50 flex items-center justify-center bg-base-300/60 px-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-xl border border-base-300 bg-base-100 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold">Delete document?</h2>
            <p className="mt-2 text-sm text-base-content/65">
              “{deleteTarget.title}”, its saved reading position, and any stored
              EPUB file will be removed from this browser. Export it first if
              you need a backup.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                className="btn btn-error"
                onClick={async () => {
                  await onDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default DocumentLibrary;
