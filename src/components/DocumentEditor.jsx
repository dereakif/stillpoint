import { FileText, X } from 'lucide-react';
import { useState } from 'react';

const DocumentEditor = ({ text, onSave, onCancel }) => {
  const [draft, setDraft] = useState(text);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stillpoint</h1>

        <p className="mt-2 text-muted-foreground">
          Import or edit the text you want to read.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <FileText className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Document</span>
        </div>

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Paste your text here..."
          className="min-h-100 w-full resize-y bg-transparent p-5 leading-8 text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex justify-end gap-3">
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
