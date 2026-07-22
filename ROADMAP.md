# Stillpoint Product Roadmap

Stillpoint is a local-first reading library with two connected reading experiences:

- **Book mode** renders EPUBs with `react-epub-viewer` / Epub.js and preserves the book's own structure and presentation.
- **Immersive mode** provides focused RSVP reading from a position selected in the book.

The library also supports a lightweight **Paste and read** flow for text that is not packaged as an EPUB.

> The EPUB file is the source of truth. Stillpoint should build features around the viewer instead of converting books into a custom chapter model.

## Product principles

- [ ] Keep imported books and pasted text local unless the reader explicitly chooses otherwise.
- [ ] Store original EPUB files rather than a lossy extracted representation.
- [ ] Let Epub.js handle EPUB spine, navigation, pagination, layout, and CFI locations.
- [ ] Keep book mode calm and familiar before adding Stillpoint-specific controls.
- [ ] Keep book position and immersive position synchronized.
- [ ] Never execute scripted EPUB content by default.
- [ ] Preserve keyboard access, screen-reader support, reflow, browser zoom, and reduced motion.
- [ ] Avoid loading the EPUB viewer bundle outside book-viewer routes.

---

# Architecture decisions

## Canonical EPUB renderer

- [x] Adopt `react-epub-viewer` as the EPUB rendering foundation.
- [x] Verify React 19 compatibility.
- [x] Render a local EPUB through an object URL with `openAs: 'epub'`.
- [x] Keep the viewer in a lazy-loaded reader chunk so Epub.js does not increase the initial app bundle.
- [x] Wrap the package behind a Stillpoint-owned viewer adapter so package-specific props and refs do not spread through the app.
- [x] Keep `allowScriptedContent` disabled.

## Local data model

Use one library with source-specific records.

```js
{
  id: 'book-id',
  kind: 'epub', // or 'text'
  title: 'Book title',
  authors: [],
  cover: null,
  source: {
    file: Blob,
    fileName: 'book.epub',
    mediaType: 'application/epub+zip'
  },
  reading: {
    cfi: null,
    percentage: 0,
    chapterLabel: null
  },
  createdAt: 0,
  lastOpenedAt: 0
}
```

Text records should store their original pasted text and RSVP position without pretending to be EPUBs.

- [x] Version the new library schema.
- [x] Store EPUB `Blob`s in IndexedDB.
- [ ] Store metadata and progress separately from the binary file where useful.
- [ ] Define migrations or a clean reset path for legacy text-only records.
- [x] Revoke temporary object URLs when books are replaced, closed, or removed.

## Position model

- [x] Use EPUB CFI as the canonical position for EPUB books.
- [x] Persist the latest CFI and percentage from viewer relocation events.
- [x] Restore the saved CFI when a book opens.
- [x] Keep the existing block/token position model only for pasted-text records.
- [ ] Define an immersive session bridge that records both the source CFI and RSVP token offset.

---

# Phase 1: Local EPUB library

Make EPUB import and reopening reliable before redesigning the viewer.

## Storage

- [x] Accept local `.epub` files from the library.
- [x] Validate file extension, media type, and a practical maximum file size.
- [x] Store the original EPUB `Blob` in IndexedDB.
- [ ] Read title, author, cover, language, and navigation metadata through Epub.js.
- [ ] Save metadata without maintaining a second custom EPUB parser.
- [x] Reopen a stored book by creating a fresh object URL.
- [x] Persist CFI, percentage, current chapter label, and last-opened time.
- [x] Delete the binary file and related state together.
- [ ] Handle quota, corrupted records, unsupported EPUBs, and DRM failures with actionable messages.

## Library UI

- [x] Make **Import EPUB** the primary library action.
- [ ] Display cover, title, author, progress, and last-opened time.
- [x] Open a book directly in the viewer.
- [ ] Support rename, delete, and replacement actions without changing the EPUB file itself.
- [x] Explain clearly that books remain in this browser.
- [x] Add an empty-library state focused on importing a first book.

## Completion criteria

- [ ] A full-length EPUB can be imported once and reopened after a reload without selecting the file again.
- [ ] The viewer restores the exact saved CFI.
- [ ] Removing a book removes its stored Blob and progress.
- [ ] No EPUB content is uploaded or executed as script.

---

# Phase 2: Paste and read

Keep a simple path for articles, notes, and copied text.

- [x] Add **Paste and read** beside **Import EPUB** in the library.
- [x] Accept clipboard text and manual textarea input.
- [x] Validate that the input contains readable text before saving.
- [x] Create a local text record with title, progress, and last-opened time.
- [x] Open pasted text in a minimal reading surface.
- [x] Allow immediate immersive RSVP reading.
- [x] Preserve exact text position across reloads.
- [x] Keep text records visually distinct from EPUB books in the library.

## Completion criteria

- [x] A reader can paste text, read immediately, and find it in the local library later.
- [x] Clipboard denial, empty input, and unavailable clipboard APIs have useful feedback.

---

# Phase 3: Stillpoint viewer shell

Build around `react-epub-viewer` without replacing its EPUB rendering.

## Demo review decisions

The package's `demo` branch was reviewed as a reference implementation. Its useful pattern is a thin application shell that owns viewer state and passes it through package props, callbacks, and `ViewerRef` methods.

Adopt these patterns:

- `tocChanged` / `onTocChange` supplies `{ label, href }` entries; selecting one calls `setLocation(href)`.
- `pageChanged` / `onPageChange` supplies chapter label, generated current/total location numbers, and page CFIs.
- `prevPage`, `nextPage`, and `setLocation` remain behind the Stillpoint adapter.
- Viewer appearance is controlled by font, font size, line height, horizontal margin, and vertical margin state.
- Viewer mode is controlled by `flow: 'paginated' | 'scrolled-doc'` and `spread: 'auto' | 'none'`.
- TOC and settings use dismissible side sheets; page information and movement controls live in a restrained footer.

Do not copy these demo choices:

- Do not add Redux or styled-components solely for the viewer; Stillpoint's existing state and styling are sufficient.
- Do not enable `allowScriptedContent`; the demo enables it, but Stillpoint keeps it `false`.
- Do not copy the persistent highlight/context-menu subsystem.
- Do not depend on global `document.querySelector('iframe')`, non-standard `event.path`, or fixed iframe timing delays.
- Do not treat the package's generated location count as guaranteed publisher page numbers; label it clearly and test behavior across books.

## Shell and navigation

- [x] Create a Stillpoint-owned viewer adapter for a stored EPUB record.
- [x] Replace the experiment page with the production stored-book shell.
- [ ] Add a stable stored-book route or equivalent restorable application location.
- [ ] Capture the package TOC and render it in an accessible Stillpoint side sheet.
- [ ] Navigate TOC entries through adapter-owned `setLocation(href)`.
- [x] Preserve Epub.js pagination and publisher content rather than extracting chapters.
- [x] Place previous/next controls in the bottom reader footer.
- [ ] Add current chapter name and generated current/total location information to the footer.
- [ ] Support and test left/right arrow page movement without intercepting form controls or assistive-technology interactions.
- [ ] Define desktop, tablet, mobile, high-zoom, and safe-area layouts for header, viewer, footer, TOC, and settings.

## Reading settings

- [ ] Add a settings side sheet using the demo's control categories, restyled for Stillpoint.
- [ ] Add publisher-original and readable fallback font choices.
- [ ] Add font-size control with practical minimum and maximum values.
- [ ] Add line-height control.
- [ ] Add horizontal viewer margin control.
- [ ] Add vertical viewer margin control for paginated mode.
- [ ] Add paginated versus `scrolled-doc` flow control.
- [ ] Add single-page versus automatic spread control where the viewport supports it.
- [ ] Apply settings through the adapter/rendition without recreating or reparsing the book unnecessarily.
- [ ] Persist viewer preferences locally and restore them before first visible layout where possible.

## Reliability

- [ ] Add loading, malformed-book, unsupported-book, and recovery states.
- [x] Keep the viewer package dynamically imported.
- [ ] Confirm TOC, settings, flow changes, spread changes, page information, and keyboard navigation with generated and real-world EPUBs.

## Completion criteria

- [ ] Book mode feels like an EPUB reader rather than an extracted document editor.
- [ ] TOC, settings, pagination/scrolling, current location, arrow keys, and position restoration work on desktop and mobile.
- [ ] Viewer settings survive closing and reopening a book.

---

# Phase 4: EPUB-to-immersive bridge

Add Stillpoint features through Epub.js APIs rather than reparsing the full book.

## Click a word to immerse

Persistent highlighting is intentionally out of scope. The iframe interaction that the demo uses for mouse selection will instead become a Stillpoint-owned word activation bridge.

- [ ] Register delegated click listeners through Epub.js rendition/content hooks for each loaded spine document.
- [ ] Remove listeners when a rendition view unloads; do not poll for or globally query an iframe.
- [ ] Ignore links, controls, images, empty areas, and clicks made while selecting text.
- [ ] Resolve the click point to a text node and character offset with `caretPositionFromPoint` / `caretRangeFromPoint` fallbacks.
- [ ] Expand the clicked offset to a word boundary with `Intl.Segmenter` where available and a Unicode-aware fallback.
- [ ] Convert the clicked word range to an exact CFI range through the current Epub.js `Contents` object.
- [ ] Extract only a bounded RSVP text window from the current spine section around that word.
- [ ] Preserve token-to-CFI-range mappings for the bounded session instead of parsing or tokenizing the whole book.
- [ ] Start immersive mode at the clicked word or nearest readable token.
- [ ] Keep EPUB content completely absent behind active immersive mode.
- [ ] Provide a keyboard-accessible **Immerse from here** action for readers who cannot point to a word.
- [ ] Verify clicks inside nested inline markup, punctuation, Unicode text, footnotes, and publisher-styled content.

## Return to book

- [ ] Pause immediately on exit.
- [ ] Translate the immersive token position back to its stored CFI range.
- [ ] Return the viewer to that CFI.
- [ ] Show a temporary return-position indicator without creating a persistent highlight feature.
- [ ] Restore focus to a meaningful viewer control.
- [ ] Keep reduced-motion behavior calm and immediate.

## Chapter-aware playback

- [ ] Use Epub.js spine/navigation data for chapter boundaries.
- [ ] Keep chapter and book progress distinct.
- [ ] Offer continue, return, and review behavior at chapter end.
- [ ] Avoid extracting or tokenizing chapters that the reader has not opened.

## Completion criteria

- [ ] A reader can click a word in the rendered EPUB, read immersively, and return to the same CFI.
- [ ] Large books do not require rendering or tokenizing all chapters at once.

---

# Phase 5: Reading tools

- [ ] Search through Epub.js spine resources with incremental indexing.
- [ ] Add CFI-based bookmarks if readers need them after the core viewer is stable.
- [ ] Keep persistent highlights and notes out of scope unless later user research justifies them.
- [ ] Include bookmarks, settings, and progress in local exports.
- [ ] Add optional session summaries without streaks or forced gamification.
- [ ] Reintroduce calibration and pacing controls where they fit the new viewer architecture.

---

# Cross-cutting work

## Accessibility

- [ ] Verify all package controls with keyboard and screen readers.
- [ ] Manage focus across library, viewer, TOC, settings, and immersive mode.
- [ ] Test 200% and 400% zoom.
- [ ] Provide touch-friendly targets and mobile reflow.
- [ ] Ensure position and progress are not communicated by color alone.

## Performance

- [ ] Profile full-length books on lower-powered mobile hardware.
- [ ] Keep Epub.js in a route-level lazy chunk.
- [ ] Avoid whole-book DOM rendering and whole-book RSVP tokenization.
- [ ] Generate or cache locations without blocking initial reading where possible.
- [ ] Revoke object URLs and rendition resources reliably.

## Privacy and security

- [ ] Keep EPUB Blobs, pasted text, positions, notes, and settings local.
- [ ] Treat files and metadata as untrusted input.
- [ ] Keep scripted EPUBs disabled by default and document the risk clearly.
- [ ] Never send book content to external services without explicit consent.
- [ ] Provide **Delete all local data**.

## Quality

- [x] Add generated, redistributable EPUB fixtures for automated tests.
- [ ] Test import, persistence, reopen, CFI restore, deletion, and quota failures.
- [x] Test the stored-book viewer shell in desktop and mobile browsers.
- [ ] Add CI for install, lint, unit tests, browser tests, and production build.
- [ ] Add an error boundary around the third-party viewer.

---

# Immediate next milestone

Build the complete EPUB reader shell demonstrated by the package before adding the immersive bridge:

1. [ ] Capture and render the EPUB TOC in a responsive side sheet.
2. [ ] Add font, font size, line height, horizontal margin, and vertical margin controls.
3. [ ] Add paginated/`scrolled-doc` and single/spread viewer controls.
4. [ ] Show current chapter and generated current/total location information in the bottom footer.
5. [ ] Support and test arrow-key page movement.
6. [ ] Persist and restore viewer settings locally.
7. [ ] Test the shell with the generated fixture and full `moby_dick.epub` on desktop and mobile.
8. [ ] Prototype delegated word-click detection and exact clicked-word CFI generation in the current spine section.
9. [ ] Connect the clicked word to a bounded immersive RSVP session only after the click/CFI prototype is reliable.

Do not add custom EPUB chapter parsing. Do not copy the demo's highlight subsystem or enable scripted EPUB content.
