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
- [x] Keep the viewer in a lazy-loaded route so Epub.js does not increase the normal app bundle.
- [ ] Wrap the package behind a Stillpoint-owned viewer adapter so package-specific props and refs do not spread through the app.
- [ ] Keep `allowScriptedContent` disabled.

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

- [ ] Version the new library schema.
- [ ] Store EPUB `Blob`s in IndexedDB.
- [ ] Store metadata and progress separately from the binary file where useful.
- [ ] Define migrations or a clean reset path for legacy text-only records.
- [ ] Revoke temporary object URLs when books are replaced, closed, or removed.

## Position model

- [ ] Use EPUB CFI as the canonical position for EPUB books.
- [ ] Persist the latest CFI and percentage from viewer page-change events.
- [ ] Restore the saved CFI when a book opens.
- [ ] Keep the existing block/token position model only for pasted-text records.
- [ ] Define an immersive session bridge that records both the source CFI and RSVP token offset.

---

# Phase 1: Local EPUB library

Make EPUB import and reopening reliable before redesigning the viewer.

## Storage

- [ ] Accept local `.epub` files from the library.
- [ ] Validate file extension, media type, and a practical maximum file size.
- [ ] Store the original EPUB `Blob` in IndexedDB.
- [ ] Read title, author, cover, language, and navigation metadata through Epub.js.
- [ ] Save metadata without maintaining a second custom EPUB parser.
- [ ] Reopen a stored book by creating a fresh object URL.
- [ ] Persist CFI, percentage, current chapter label, and last-opened time.
- [ ] Delete the binary file and related state together.
- [ ] Handle quota, corrupted records, unsupported EPUBs, and DRM failures with actionable messages.

## Library UI

- [ ] Make **Import EPUB** the primary library action.
- [ ] Display cover, title, author, progress, and last-opened time.
- [ ] Open a book directly in the viewer.
- [ ] Support rename, delete, and replacement actions without changing the EPUB file itself.
- [ ] Explain clearly that books remain in this browser.
- [ ] Add an empty-library state focused on importing a first book.

## Completion criteria

- [ ] A full-length EPUB can be imported once and reopened after a reload without selecting the file again.
- [ ] The viewer restores the exact saved CFI.
- [ ] Removing a book removes its stored Blob and progress.
- [ ] No EPUB content is uploaded or executed as script.

---

# Phase 2: Paste and read

Keep a simple path for articles, notes, and copied text.

- [ ] Add **Paste and read** beside **Import EPUB** in the library.
- [ ] Accept clipboard text and manual textarea input.
- [ ] Validate that the input contains readable text before saving.
- [ ] Create a local text record with title, progress, and last-opened time.
- [ ] Open pasted text in a minimal reading surface.
- [ ] Allow immediate immersive RSVP reading.
- [ ] Preserve exact text position across reloads.
- [ ] Keep text records visually distinct from EPUB books in the library.

## Completion criteria

- [ ] A reader can paste text, read immediately, and find it in the local library later.
- [ ] Clipboard denial, empty input, and unavailable clipboard APIs have useful feedback.

---

# Phase 3: Stillpoint viewer shell

Build around `react-epub-viewer` without replacing its EPUB rendering.

- [ ] Create a Stillpoint viewer adapter and route for a stored book ID.
- [ ] Replace the experiment header with the production viewer shell.
- [ ] Integrate the package TOC into the Stillpoint visual system.
- [ ] Preserve native pagination and publisher content styling.
- [ ] Add restrained controls for library, appearance, progress, and immersive entry.
- [ ] Persist viewer font, size, line height, margins, flow, and spread preferences.
- [ ] Define desktop, tablet, mobile, and high-zoom layouts.
- [ ] Add loading, malformed-book, and recovery states.
- [ ] Keep the viewer package dynamically imported.

## Completion criteria

- [ ] Book mode feels like an EPUB reader rather than an extracted document editor.
- [ ] Navigation, pagination, TOC, and position restoration work on desktop and mobile.

---

# Phase 4: EPUB-to-immersive bridge

Add Stillpoint features through Epub.js APIs rather than reparsing the full book.

## Click or selection to immerse

- [ ] Use rendition/content hooks to observe clicks inside the EPUB iframe.
- [ ] Resolve the selected DOM range or clicked text to an EPUB CFI.
- [ ] Extract a bounded text window from the current spine section only.
- [ ] Tokenize that bounded text for RSVP without converting the entire book.
- [ ] Start immersive mode at the selected word or nearest readable word.
- [ ] Prevent entry while the reader is making a text selection unless explicitly requested.
- [ ] Provide a keyboard-accessible **Immerse from here** action.

## Return to book

- [ ] Pause immediately on exit.
- [ ] Translate the immersive token position back to a CFI.
- [ ] Return the viewer to that CFI.
- [ ] Highlight the exact return range briefly inside the rendition.
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
- [ ] Add CFI-based bookmarks.
- [ ] Add notes and highlights anchored to CFI ranges.
- [ ] Include bookmarks, notes, settings, and progress in local exports.
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

- [ ] Add generated, redistributable EPUB fixtures for automated tests.
- [ ] Test import, persistence, reopen, CFI restore, deletion, and quota failures.
- [ ] Test the isolated viewer route in desktop and mobile browsers.
- [ ] Add CI for install, lint, unit tests, browser tests, and production build.
- [ ] Add an error boundary around the third-party viewer.

---

# Immediate next milestone

Build the smallest durable vertical slice around the new renderer:

1. [ ] Define the versioned EPUB library record.
2. [ ] Store an uploaded EPUB Blob in IndexedDB.
3. [ ] List the stored book in the library.
4. [ ] Open it through a Stillpoint viewer adapter.
5. [ ] Persist and restore its CFI.
6. [ ] Delete the book and revoke its resources.
7. [ ] Add **Paste and read** as the secondary library action.

Do not add custom EPUB chapter parsing. Do not begin click-to-immerse until local import, reopen, position restoration, and deletion are reliable.
