import { Play } from 'lucide-react';

const TableOfContents = ({
  sections,
  activeSectionId,
  compact = false,
  onNavigate,
  onStartReading,
}) => (
  <nav aria-label="Table of contents" className="min-w-0">
    <ol className="space-y-1">
      {sections.map((section, index) => {
        const label = section.title || `Section ${index + 1}`;
        const immersiveEntryBlock =
          section.blocks.find(
            (block) => block.type !== 'heading' && block.tokens.length
          ) ?? section.blocks.find((block) => block.tokens.length);
        const isActive = section.id === activeSectionId;

        return (
          <li key={section.id} className="group/toc relative">
            <button
              type="button"
              aria-current={isActive ? 'location' : undefined}
              aria-label={compact ? `Go to ${label}` : undefined}
              title={compact ? label : undefined}
              className={`flex min-h-10 w-full items-center rounded-md text-left text-sm transition-colors motion-reduce:transition-none ${
                compact ? 'justify-center px-2' : 'gap-3 px-3 pr-10'
              } ${
                isActive
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-base-content/65 hover:bg-base-200/60 hover:text-base-content'
              }`}
              onClick={() => onNavigate(section)}
            >
              {compact ? (
                <span aria-hidden="true" className="font-mono text-xs">
                  {index + 1}
                </span>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className={`h-px w-3 shrink-0 ${
                      isActive ? 'bg-primary' : 'bg-base-content/25'
                    }`}
                  />
                  <span className="min-w-0 truncate">{label}</span>
                </>
              )}
            </button>

            {!compact && immersiveEntryBlock && (
              <button
                type="button"
                aria-label={`Immerse ${label}`}
                title={`Immerse ${label}`}
                className="btn btn-circle btn-ghost btn-xs absolute right-1 top-1 opacity-50 transition-opacity motion-reduce:transition-none hover:opacity-100 focus:opacity-100 sm:opacity-0 sm:group-hover/toc:opacity-100 sm:group-focus-within/toc:opacity-100"
                onClick={() =>
                  onStartReading({
                    blockId: immersiveEntryBlock.id,
                    tokenOffset: 0,
                  })
                }
              >
                <Play className="size-3 fill-current" />
              </button>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

export default TableOfContents;
