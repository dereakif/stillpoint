import { ClipboardPaste, FileText, ListTree, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createDocumentModel } from '../utils';
import {
  ClipboardImportError,
  readDocumentFromClipboard,
} from '../clipboardImport';

const DocumentEditor = ({ text, onSave, onCancel }) => {
  const [draft, setDraft] = useState(text);
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);
  const [pendingClipboardText, setPendingClipboardText] = useState(null);
  const [clipboardFeedback, setClipboardFeedback] = useState(null);
  const previewDocument = useMemo(
    () => createDocumentModel(draft, { sourceFormat: 'markdown' }),
    [draft]
  );

  const applyClipboardText = (clipboardText) => {
    setDraft(clipboardText);
    setPendingClipboardText(null);
    setClipboardFeedback({
      tone: 'success',
      message:
        'Clipboard text is ready to review. Select Read document when you’re ready.',
    });
  };

  const pasteFromClipboard = async () => {
    setClipboardFeedback(null);
    setIsReadingClipboard(true);

    try {
      const clipboardDocument =
        await readDocumentFromClipboard(previewDocument);
      if (draft.trim()) {
        setPendingClipboardText(clipboardDocument.source.text);
      } else {
        applyClipboardText(clipboardDocument.source.text);
      }
    } catch (error) {
      setClipboardFeedback({
        tone: 'error',
        message:
          error instanceof ClipboardImportError
            ? error.message
            : 'Stillpoint could not read the clipboard. Your editor text was left unchanged.',
      });
    } finally {
      setIsReadingClipboard(false);
    }
  };

  const replaceSourceRange = (range, replacement) => {
    const normalizedDraft = draft.replace(/\r\n?/g, '\n');
    setDraft(
      normalizedDraft.slice(0, range.start) +
        replacement +
        normalizedDraft.slice(range.end)
    );
  };

  const updateSectionTitle = (section, newTitle) => {
    const heading = section.blocks.find(
      (block) => block.id === section.headingBlockId
    );
    if (!heading) return;

    replaceSourceRange(
      heading.source,
      `${'#'.repeat(heading.headingLevel ?? 2)} ${newTitle}`
    );
  };

  const startSectionAt = (block) => {
    replaceSourceRange(
      { start: block.source.start, end: block.source.start },
      '## New section\n\n'
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 overflow-x-clip px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stillpoint</h1>

        <p className="mt-2 text-muted-foreground">
          Import or edit the text you want to read.
        </p>
      </div>

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <FileText className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Markdown document</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm ml-auto"
              disabled={isReadingClipboard}
              onClick={pasteFromClipboard}
            >
              {isReadingClipboard ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <ClipboardPaste className="size-4" />
              )}
              {isReadingClipboard
                ? 'Reading clipboard…'
                : 'Paste from clipboard'}
            </button>
          </div>

          {clipboardFeedback && (
            <div
              role={clipboardFeedback.tone === 'error' ? 'alert' : 'status'}
              data-testid="clipboard-feedback"
              className={`flex items-start gap-3 border-b px-5 py-3 text-sm ${
                clipboardFeedback.tone === 'error'
                  ? 'border-error/30 bg-error/10'
                  : 'border-success/30 bg-success/10'
              }`}
            >
              <p className="min-w-0 flex-1">{clipboardFeedback.message}</p>
              <button
                type="button"
                className="btn btn-ghost btn-xs shrink-0"
                aria-label="Dismiss clipboard message"
                onClick={() => setClipboardFeedback(null)}
              >
                Dismiss
              </button>
            </div>
          )}

          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Paste your text here..."
            aria-describedby="markdown-format-help"
            className="min-h-100 w-full resize-y bg-transparent p-5 leading-8 text-foreground outline-none placeholder:text-muted-foreground"
          />
          <p
            id="markdown-format-help"
            className="border-t border-border px-5 py-3 text-sm text-base-content/65"
          >
            Use Markdown headings such as <code># Chapter title</code> to create
            sections. Labels such as <code>Chapter 1</code> are also detected;
            other short standalone lines remain paragraphs.
          </p>
        </div>

        <aside
          aria-label="Detected document structure"
          className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <ListTree className="size-4 text-primary" />
            <h2 className="font-semibold">Structure preview</h2>
          </div>
          <p className="mt-1 text-sm text-base-content/65">
            {previewDocument.sections.length}{' '}
            {previewDocument.sections.length === 1 ? 'section' : 'sections'} ·{' '}
            {previewDocument.sections.reduce(
              (count, section) => count + section.blocks.length,
              0
            )}{' '}
            blocks
          </p>

          <ol className="mt-4 space-y-4">
            {previewDocument.sections.map((section, sectionIndex) => (
              <li
                key={section.id}
                className="rounded-xl border border-base-300 p-3"
              >
                <label className="text-xs font-medium text-base-content/60">
                  Section {sectionIndex + 1}
                  <input
                    type="text"
                    aria-label={`Section ${sectionIndex + 1} title`}
                    value={section.title ?? ''}
                    placeholder="Untitled section"
                    disabled={!section.headingBlockId}
                    onChange={(event) =>
                      updateSectionTitle(section, event.target.value)
                    }
                    className="input input-sm mt-1 w-full"
                  />
                </label>

                <ul className="mt-3 space-y-2">
                  {section.blocks.map((block) => (
                    <li
                      key={block.id}
                      className="flex min-w-0 items-center justify-between gap-2 text-xs"
                    >
                      <span className="min-w-0 truncate">
                        <span className="mr-2 text-primary">{block.type}</span>
                        {block.text || 'Separator'}
                      </span>
                      {block.type !== 'heading' && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs shrink-0"
                          aria-label={`Start section at ${block.text || 'separator'}`}
                          onClick={() => startSectionAt(block)}
                        >
                          Start section
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {pendingClipboardText !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-300/65 p-4 backdrop-blur-sm">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="replace-editor-text-title"
            aria-describedby="replace-editor-text-description"
            className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 shadow-2xl"
          >
            <h2
              id="replace-editor-text-title"
              className="text-lg font-semibold"
            >
              Replace editor text?
            </h2>
            <p
              id="replace-editor-text-description"
              className="mt-2 text-sm text-base-content/65"
            >
              Pasting from the clipboard will replace the text currently in the
              editor. You can review the clipboard text before starting to read.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPendingClipboardText(null)}
              >
                Keep current text
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => applyClipboardText(pendingClipboardText)}
              >
                Replace text
              </button>
            </div>
          </section>
        </div>
      )}

      <div className="relative z-20 flex flex-wrap justify-end gap-3 bg-base-100 py-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-3 font-medium transition motion-reduce:transition-none hover:bg-base-200"
          >
            <X className="size-4" />
            Cancel
          </button>
        )}

        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={!draft.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground transition motion-reduce:transition-none hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          <FileText className="size-4" />
          Read document
        </button>
      </div>
    </div>
  );
};

export default DocumentEditor;
