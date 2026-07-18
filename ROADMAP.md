# Stillpoint Product Roadmap

This roadmap evolves Stillpoint from a standalone RSVP player into a complete reading environment with two connected experiences:

- **Navigation mode** for context, skimming, scrolling, chapters, and choosing where to read.
- **Immersive mode** for focused RSVP playback.

The central product principle is:

> Immersion is never a dead end. Readers can always return to a clear position in the document, and every meaningful document position can become an entry point into immersion.

## Product principles

- [ ] Keep the reader's position synchronized across navigation and immersive modes.
- [ ] Preserve a fixed ORP position throughout immersive playback.
- [ ] Stop playback immediately when the reader requests it, regardless of transition state.
- [ ] Make transitions calm and meaningful without delaying interaction.
- [ ] Preserve document context instead of treating RSVP as an isolated tool.
- [ ] Respect keyboard navigation, screen readers, browser zoom, and reduced-motion preferences.
- [ ] Prefer understandable defaults over exposing every timing parameter.
- [ ] Keep imported document content local unless the reader explicitly chooses otherwise.

---

# Phase 0: Foundations and playback semantics

Prepare the current application for shared position state and larger product features.

## Player behavior

- [x] Define what happens when Play is pressed after reaching the end of a document.
- [x] Add explicit `restart` or `reset` behavior to the RSVP engine.
- [x] Define one consistent meaning for progress values.
- [x] Make preview, playback, rewind, and forward use the same progress calculation.
- [x] Make navigation commands safe when the document contains no tokens.
- [x] Decide whether pause/resume redisplays the current word or resumes its remaining duration.
- [x] Decide how a WPM change affects the currently displayed word.
- [x] Add tests for completion, restart, empty input, and progress consistency.

## Engine integration

- [x] Replace single mutable callback properties with a subscription API.
- [x] Make every subscription return an unsubscribe function.
- [x] Define a stable public interface for player state and commands.
- [x] Remove stale implementation comments and unused function arguments.
- [x] Add a documented token shape using JSDoc or TypeScript.
- [x] Ensure token metadata fields always use consistent boolean values.

## Browser-level test foundation

- [x] Choose a browser test framework, preferably Playwright.
- [x] Add a test for entering immersive mode.
- [x] Add a test for exiting during the countdown.
- [x] Add a test confirming playback does not restart after exit.
- [x] Add a test for keyboard controls.
- [x] Add desktop and mobile long-word layout tests.
- [x] Add a reduced-motion transition test.

## Completion criteria

- [x] Playback has documented and tested end, restart, pause, and progress semantics.
- [x] Empty documents cannot crash the player.
- [x] UI components can subscribe to engine events without replacing one another.
- [x] Critical immersive-mode lifecycle behavior is covered in a real browser.

---

# Phase 1: Connected reading modes

Build the central Stillpoint experience: navigating a document and entering or leaving immersive reading without losing position.

## Document reading view

- [x] Separate document import/editing from document reading.
- [x] Replace the textarea-only reading experience with rendered document content.
- [x] Render paragraphs with stable IDs.
- [x] Preserve paragraph breaks and basic punctuation.
- [x] Keep the reading column comfortable at desktop and mobile widths.
- [x] Add an explicit **Edit document** action.
- [x] Add an empty-document state.

## Shared reading position

- [ ] Introduce a first-class reading-position model.
- [ ] Track the current paragraph or block ID.
- [ ] Track the current token offset inside that block.
- [ ] Move position ownership out of the private RSVP timer closure.
- [ ] Make navigation mode and immersive mode read from the same position.
- [ ] Update shared position as RSVP playback advances.
- [ ] Add tests for position conversion between document blocks and RSVP tokens.

Suggested initial shape:

```js
{
  blockId: 'paragraph-7',
  tokenOffset: 12
}
```

## Entering immersive mode

- [ ] Let the reader start from the beginning of a paragraph.
- [ ] Add an **Immerse from here** action.
- [ ] Add a persistent **Resume reading** action.
- [ ] Start RSVP at the selected document position.
- [ ] Decide whether heading clicks start at the heading or the following paragraph.
- [ ] Prevent accidental immersive activation while selecting text.
- [ ] Ensure paragraph entry works with keyboard navigation.

## Exiting immersive mode

- [ ] Pause playback immediately on exit.
- [ ] Return to navigation mode at the exact current paragraph.
- [ ] Scroll the current paragraph into view.
- [ ] Apply a persistent, subtle current-paragraph marker.
- [ ] Apply a temporary exact-word highlight after returning.
- [ ] Fade the exact-word highlight without losing the paragraph marker.
- [ ] Restore focus to a meaningful element in navigation mode.

## Mode transition

- [ ] Design the navigation-to-immersive transition.
- [ ] Fade and soften surrounding document content.
- [ ] Keep the selected paragraph visually connected during entry.
- [ ] Introduce the RSVP focal point before playback begins.
- [ ] Reverse the transition when returning to navigation mode.
- [ ] Keep transition duration around 700–1,000 ms.
- [ ] Stop playback immediately even if an exit animation is still running.
- [ ] Implement a reduced-motion opacity-only transition.
- [ ] Prevent animation state from corrupting reading position.

## Navigation-mode controls

- [ ] Add document progress.
- [ ] Add current-position status.
- [ ] Add a Resume button with useful context.
- [ ] Add a visible action for returning to the document editor.
- [ ] Ensure controls remain usable at high browser zoom.

## Completion criteria

- [ ] A reader can start immersive playback from a chosen paragraph.
- [ ] Exiting returns to the correct document location.
- [ ] Position remains synchronized after rewind, forward, pause, and resume.
- [ ] The transition works with normal and reduced motion.
- [ ] Navigation mode is usable without a mouse.

---

# Phase 2: Document structure and chapters

Add chapters, headings, a table of contents, and meaningful section boundaries.

## Structured document model

- [ ] Define a document model with stable document, section, block, and token IDs.
- [ ] Represent headings, paragraphs, quotes, lists, and separators.
- [ ] Keep source text separate from parsed document structure.
- [ ] Store token-to-block mappings for position synchronization.
- [ ] Preserve enough source information to edit or reparse a document.

Suggested direction:

```js
{
  id: 'document-1',
  title: 'Document title',
  sections: [
    {
      id: 'chapter-1',
      title: 'Introduction',
      blocks: [
        {
          id: 'paragraph-1',
          type: 'paragraph',
          tokens: []
        }
      ]
    }
  ]
}
```

## Import and parsing

- [ ] Choose the first structured input format, preferably Markdown.
- [ ] Parse Markdown headings into sections.
- [ ] Detect plain-text chapter labels such as `Chapter 1`.
- [ ] Decide how short standalone lines are treated.
- [ ] Provide a preview of detected document structure.
- [ ] Let the reader correct titles and chapter boundaries.
- [ ] Handle documents with no headings as one section.
- [ ] Preserve URLs, punctuation, paragraph breaks, and Unicode text.
- [ ] Add parser tests for malformed and ambiguous input.

## Table of contents

- [ ] Add a desktop table-of-contents sidebar.
- [ ] Add a mobile table-of-contents drawer or sheet.
- [ ] Highlight the current chapter.
- [ ] Let readers jump to a chapter without entering immersive mode.
- [ ] Add an **Immerse chapter** action.
- [ ] Keep the URL or application state synchronized with the selected chapter if routing is introduced.
- [ ] Ensure table-of-contents controls are keyboard and screen-reader accessible.

## Chapter-aware playback

- [ ] Mark chapter boundaries in the reading-position model.
- [ ] Detect when immersive playback reaches the end of a chapter.
- [ ] Prevent chapter-boundary prompts from being triggered more than once.
- [ ] Keep rewind and forward behavior correct across chapter boundaries.
- [ ] Show the next chapter title before continuing.
- [ ] Calculate chapter and document progress separately.

## Chapter completion prompt

- [ ] Design a calm chapter-complete interstitial.
- [ ] Show the completed chapter title.
- [ ] Show optional session information such as reading time and words read.
- [ ] Add **Continue to next chapter**.
- [ ] Add **Return to document**.
- [ ] Add **Review chapter** if it is meaningfully different from returning.
- [ ] Support keyboard selection.
- [ ] Restore the correct position after either choice.

## Completion behavior settings

- [ ] Add **Ask what to do** mode.
- [ ] Add **Continue automatically** mode.
- [ ] Add **Return to document** mode.
- [ ] Use Ask mode as the initial default.
- [ ] Add a short cancelable countdown before automatic continuation.
- [ ] Persist the selected behavior.
- [ ] Add tests for all chapter-completion modes.

## Completion criteria

- [ ] Structured documents display a usable table of contents.
- [ ] Chapter navigation and immersive position remain synchronized.
- [ ] Chapter completion behavior follows the selected setting.
- [ ] Documents without headings still work correctly.

---

# Phase 3: Persistence, library, and settings

Remember documents, positions, and preferences across sessions.

## Local document library

- [ ] Choose local persistence, initially IndexedDB or another browser-local store.
- [ ] Save imported documents locally.
- [ ] List saved documents with title, progress, and last-opened time.
- [ ] Open a saved document at its last reading position.
- [ ] Rename documents.
- [ ] Delete documents with confirmation.
- [ ] Handle storage errors and quota limits.
- [ ] Explain clearly that documents remain local.
- [ ] Add export and backup options before users depend on local storage.

## Reading-session persistence

- [ ] Persist current chapter, block, and token offset.
- [ ] Persist completed chapters.
- [ ] Persist WPM.
- [ ] Persist chapter completion behavior.
- [ ] Persist navigation scroll position where useful.
- [ ] Debounce position writes to avoid excessive storage operations.
- [ ] Recover gracefully from an invalid or outdated saved position.
- [ ] Version persisted data and plan migrations.

## Reading settings

- [ ] Add pacing presets: Smooth, Natural, and Deliberate.
- [ ] Add WPM control.
- [ ] Add countdown duration.
- [ ] Add rewind distance.
- [ ] Add punctuation-pause strength.
- [ ] Add long-word timing preference.
- [ ] Add function-word acceleration toggle.
- [ ] Keep advanced timing controls behind an expandable section.
- [ ] Preview timing changes before applying them globally.

## Appearance settings

- [ ] Add theme selection.
- [ ] Add document font selection.
- [ ] Add document width and line-height controls.
- [ ] Add immersive word-size control.
- [ ] Add ORP accent-color selection.
- [ ] Add reduced-effects preference in addition to system reduced motion.
- [ ] Validate contrast for every supported theme.

## Navigation settings

- [ ] Add table-of-contents visibility preference.
- [ ] Add **Keep current paragraph centered after exit**.
- [ ] Add **Resume automatically when opening a document**.
- [ ] Add **Remember document scroll position**.

## Clipboard and error feedback

- [ ] Replace console-only clipboard errors with user-visible feedback.
- [ ] Distinguish permission denial from empty clipboard content.
- [ ] Explain secure-context requirements when clipboard access is unavailable.
- [ ] Avoid replacing the current document until clipboard text is validated.

## Completion criteria

- [ ] Documents and reading positions survive page reloads.
- [ ] Settings are restored consistently.
- [ ] Stored data has a versioned schema and recovery behavior.
- [ ] Readers can export or remove their local data.

---

# Phase 4: Advanced reading tools

Expand navigation, comprehension, and review without cluttering immersive mode.

## Context peek

- [ ] Design a temporary sentence-context overlay while immersive playback is paused.
- [ ] Keep the current word highlighted within the sentence.
- [ ] Support a press-and-hold keyboard interaction.
- [ ] Support an accessible on-screen equivalent.
- [ ] Return to fixed-ORP mode without moving the reading position.

## Semantic navigation

- [ ] Add previous-sentence navigation.
- [ ] Add next-sentence navigation.
- [ ] Add previous-paragraph navigation.
- [ ] Add next-paragraph navigation.
- [ ] Decide how navigation behaves while playback is active.
- [ ] Add configurable keyboard shortcuts.

## Search

- [ ] Add full-document search in navigation mode.
- [ ] Highlight results without interfering with the reading-position marker.
- [ ] Jump to a search result in navigation mode.
- [ ] Add **Immerse from result**.
- [ ] Preserve search state when returning from immersive mode where useful.

## Bookmarks and notes

- [ ] Bookmark paragraphs or exact positions.
- [ ] Add notes in navigation mode.
- [ ] List bookmarks and notes per document.
- [ ] Jump from a bookmark to navigation mode.
- [ ] Enter immersive mode from a bookmark.
- [ ] Include notes and bookmarks in exports.

## Session summaries

- [ ] Track session duration.
- [ ] Track words read.
- [ ] Track average effective WPM.
- [ ] Track completed chapters.
- [ ] Show an optional, understated session summary after exit.
- [ ] Avoid manipulative streaks or forced gamification.

## Additional imports

- [ ] Evaluate EPUB import.
- [ ] Evaluate PDF text extraction and its formatting limitations.
- [ ] Evaluate HTML/article import.
- [ ] Preserve chapter structure where the source format provides it.
- [ ] Show import warnings when structure or text quality is uncertain.
- [ ] Keep external content fetching explicit and privacy-conscious.

## Completion criteria

- [ ] Readers can recover context without abandoning their position.
- [ ] Search, bookmarks, and notes remain navigation-mode tools rather than immersive clutter.
- [ ] Additional import formats produce a reviewable structured document before reading.

---

# Cross-cutting engineering work

These tasks apply throughout all phases.

## Accessibility

- [ ] Maintain complete keyboard operation.
- [ ] Manage focus during every mode transition and modal prompt.
- [ ] Respect `prefers-reduced-motion`.
- [ ] Test at 200% and 400% browser zoom.
- [ ] Test screen-reader announcements for countdowns, completion, and errors.
- [ ] Ensure color is not the only indicator of reading position.
- [ ] Verify text and control contrast.
- [ ] Provide touch-friendly targets on mobile.

## Internationalization and text correctness

- [ ] Document that current timing rules are optimized for English.
- [ ] Make ORP calculation aware of leading and trailing punctuation.
- [ ] Use Unicode-aware letter matching.
- [ ] Evaluate grapheme segmentation for emoji and composed characters.
- [ ] Make function-word timing language-specific or configurable.
- [ ] Test curly quotes, apostrophes, accented text, and non-Latin scripts.
- [ ] Define behavior for numbers, dates, times, code, and URLs.

## Performance

- [ ] Profile immersive playback at 800 WPM.
- [ ] Profile long-word measurement on mobile hardware.
- [ ] Avoid unnecessary layout reads and writes per word.
- [ ] Recalculate visible-word fitting after viewport changes.
- [ ] Test large documents without rendering every interactive word at once.
- [ ] Consider virtualization for very large navigation views.
- [ ] Keep transition effects smooth on lower-powered devices.

## Quality and delivery

- [ ] Add CI for install, lint, tests, and production build.
- [ ] Add browser tests to CI.
- [ ] Use explicit dependency version ranges instead of `latest`.
- [ ] Add formatting and formatting-check scripts.
- [ ] Remove unused template assets.
- [ ] Add error boundaries or equivalent recovery for rendering failures.
- [ ] Add lightweight release notes or a changelog.

## Privacy and security

- [ ] Keep pasted and imported text local by default.
- [ ] Never send document content to external services without explicit consent.
- [ ] Explain clipboard permission and secure-context requirements.
- [ ] Sanitize rendered imported HTML if HTML import is introduced.
- [ ] Treat imported files and metadata as untrusted input.
- [ ] Provide a clear way to delete all local data.

---

# Deferred ideas

These ideas are valuable but should not distract from position synchronization and chapter-aware navigation.

- [ ] Exact word-click entry into immersive mode.
- [ ] Immerse a selected text range.
- [ ] Shareable reading-position links.
- [ ] Cross-device synchronization.
- [ ] Cloud document library.
- [ ] Collaborative annotations.
- [ ] Optional reading analytics.
- [ ] Custom timing profiles per document type.
- [ ] Text-to-speech synchronization.
- [ ] Offline installable PWA support.

---

# Immediate next milestone

The recommended next milestone is **Phase 0 followed by the smallest usable slice of Phase 1**:

- [ ] Define restart and progress semantics.
- [ ] Introduce a shared reading-position model.
- [ ] Render pasted text as paragraphs in navigation mode.
- [ ] Start immersive mode from a selected paragraph.
- [ ] Return to that paragraph at the current word.
- [ ] Add one browser test for the complete navigation → immersion → navigation loop.

Do not begin chapter parsing or persistence until this loop feels reliable and natural.
