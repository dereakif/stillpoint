import { Download, FilePlus2, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

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

const formatLastOpened = (timestamp) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));

const DocumentLibrary = ({
  documents,
  onOpen,
  onCreate,
  onRename,
  onDelete,
}) => {
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const exportAll = () => {
    downloadJson('stillpoint-library-backup.json', {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      documents,
    });
  };

  return (
    <section className="min-h-screen bg-base-100">
      <header className="border-b border-base-300/80">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-primary">Stillpoint</p>
            <h1 className="text-xl font-semibold tracking-tight">Library</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!documents.length}
              onClick={exportAll}
            >
              <Download className="size-4" />
              Export backup
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onCreate}
            >
              <FilePlus2 className="size-4" />
              New document
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight">
            Your documents
          </h2>
          <p className="mt-2 text-sm leading-6 text-base-content/60">
            Documents, reading positions, and progress stay in this browser's
            local storage. Nothing is uploaded by Stillpoint. Export a backup
            before clearing browser data or moving to another device.
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
                    <span className="block truncate text-lg font-medium group-hover:text-primary">
                      {documentRecord.title}
                    </span>
                    <span className="mt-1 block text-xs text-base-content/50">
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
                      onClick={() =>
                        downloadJson(
                          `${documentRecord.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'document'}.stillpoint.json`,
                          documentRecord
                        )
                      }
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
              Create a document to begin your local reading library.
            </p>
            <button
              type="button"
              className="btn btn-primary mt-5"
              onClick={onCreate}
            >
              <FilePlus2 className="size-4" />
              Create document
            </button>
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
              “{deleteTarget.title}” and its saved reading position will be
              removed from this browser. Export it first if you need a backup.
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
