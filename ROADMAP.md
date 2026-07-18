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
- [ ] Make navigation mode feel like a calm document workspace, not a card-heavy dashboard or text editor.
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

- [x] Introduce a first-class reading-position model.
- [x] Track the current paragraph or block ID.
- [x] Track the current token offset inside that block.
- [x] Move position ownership out of the private RSVP timer closure.
- [x] Make navigation mode and immersive mode read from the same position.
- [x] Update shared position as RSVP playback advances.
- [x] Add tests for position conversion between document blocks and RSVP tokens.

Suggested initial shape:

```js
{
  blockId: 'paragraph-7',
  tokenOffset: 12
}
```

## Entering immersive mode

- [x] Let the reader start from the beginning of a paragraph.
- [x] Add an **Immerse from here** action.
- [x] Add a persistent **Resume reading** action.
- [x] Start RSVP at the selected document position.
- [x] Decide whether heading clicks start at the heading or the following paragraph.
- [x] Prevent accidental immersive activation while selecting text.
- [x] Ensure paragraph entry works with keyboard navigation.

## Exiting immersive mode

- [x] Pause playback immediately on exit.
- [x] Return to navigation mode at the exact current paragraph.
- [x] Scroll the current paragraph into view.
- [x] Apply a persistent, subtle current-paragraph marker.
- [x] Apply a temporary exact-word highlight after returning.
- [x] Fade the exact-word highlight without losing the paragraph marker.
- [x] Restore focus to a meaningful element in navigation mode.

## Mode transition

- [x] Design the navigation-to-immersive transition.
- [x] Fade and soften surrounding document content.
- [x] Keep the selected paragraph visually connected during entry.
- [x] Introduce the RSVP focal point before playback begins.
- [x] Reverse the transition when returning to navigation mode.
- [x] Keep transition duration around 700–1,000 ms.
- [x] Stop playback immediately even if an exit animation is still running.
- [x] Implement a reduced-motion opacity-only transition.
- [x] Prevent animation state from corrupting reading position.

## Navigation-mode controls

- [x] Add document progress.
- [x] Add current-position status.
- [x] Add a Resume button with useful context.
- [x] Add a visible action for returning to the document editor.
- [x] Ensure controls remain usable at high browser zoom.

## Completion criteria

- [x] A reader can start immersive playback from a chosen paragraph.
- [x] Exiting returns to the correct document location.
- [x] Position remains synchronized after rewind, forward, pause, and resume.
- [x] The transition works with normal and reduced motion.
- [x] Navigation mode is usable without a mouse.

---

# Phase 2: Document structure and chapters

Add chapters, headings, a table of contents, and meaningful section boundaries.

## Structured document model

- [x] Define a document model with stable document, section, block, and token IDs.
- [x] Represent headings, paragraphs, quotes, lists, and separators.
- [x] Keep source text separate from parsed document structure.
- [x] Store token-to-block mappings for position synchronization.
- [x] Preserve enough source information to edit or reparse a document.

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

- [x] Choose the first structured input format, preferably Markdown.
- [x] Parse Markdown headings into sections.
- [x] Detect plain-text chapter labels such as `Chapter 1`.
- [x] Decide how short standalone lines are treated.
- [x] Provide a preview of detected document structure.
- [x] Let the reader correct titles and chapter boundaries.
- [x] Handle documents with no headings as one section.
- [x] Preserve URLs, punctuation, paragraph breaks, and Unicode text.
- [x] Add parser tests for malformed and ambiguous input.

## Document workspace shell

Navigation mode should support scrolling, skimming, searching, and choosing where to begin while feeling like a focused reading surface rather than a dashboard.

```text
┌──────────────────────────────────────────────────────────────┐
│ Stillpoint       Document title               Search  Theme  │
├───────────────┬──────────────────────────────────────────────┤
│ Contents      │                                              │
│ Introduction  │              Chapter title                   │
│ Basics        │              Section heading                 │
│ ORP           │              Paragraph text...               │
│ Timing        │              Paragraph text...               │
│ Summary       │                                              │
├───────────────┴──────────────────────────────────────────────┤
│         Click any word, heading, or paragraph to Immerse     │
└──────────────────────────────────────────────────────────────┘
```

- [x] Replace the current card-like document header with a restrained workspace shell.
- [x] Add a minimal top bar containing Stillpoint, the document title, and only actions that are currently available.
- [x] Reserve natural top-bar locations for Search in Phase 4 and Theme in Phase 3 without showing inactive placeholder controls.
- [x] Keep the document column centered with a comfortable reading measure independent of sidebar width.
- [x] Use whitespace, typography, and subtle dividers instead of a card-heavy dashboard treatment.
- [x] Keep document content visually primary while controls remain discoverable by keyboard and pointer.
- [x] Define tablet behavior for the top bar, document column, and collapsed contents navigation.
- [x] Define mobile behavior with a contents drawer, reflowed top bar, safe-area spacing, and no horizontal overflow.
- [x] Add responsive browser tests for desktop, tablet, narrow mobile, and high zoom.

## Table of contents

- [x] Add a narrow, collapsible desktop table-of-contents sidebar on the left.
- [x] Add a collapsed tablet treatment that does not reduce the document to an uncomfortable width.
- [x] Add a mobile table-of-contents drawer or sheet.
- [x] Highlight the current chapter.
- [x] Let readers jump to a chapter without entering immersive mode.
- [x] Add an **Immerse chapter** action.
- [x] Keep the URL or application state synchronized with the selected chapter if routing is introduced.
- [x] Ensure table-of-contents controls are keyboard and screen-reader accessible.

## Multi-level immersive entry

- [x] Let a reader activate an individual word and begin immersive playback at that exact token.
- [x] Let a reader activate a paragraph and begin at its first readable token.
- [x] Give paragraphs a subtle hover and focus-within treatment with a small **Immerse from here** action.
- [x] Let a reader activate a heading and begin at the following readable block rather than reading the heading itself.
- [x] Keep document text selectable and suppress immersive activation when the reader is selecting text.
- [x] Provide keyboard-accessible equivalents for word, paragraph, and heading entry without turning reading text into a noisy tab sequence.
- [x] Use event delegation or another scalable strategy instead of attaching heavy handlers to every rendered word.
- [x] Preserve token, block, and section mappings for every entry level.
- [x] Add browser tests for pointer, keyboard, text-selection, and exact-token entry.

## Exact-position return refinement

- [x] Scroll the current token—not only its paragraph—into view when navigation mode returns.
- [x] Position the current token near the vertical center of the viewport where document boundaries allow.
- [x] Apply a restrained temporary token glow for approximately one second.
- [x] Keep the permanent block-level reading-position marker after the token glow disappears.
- [x] Ensure the temporary glow and permanent marker remain distinguishable from search results and text selection.
- [x] Preserve the printed-page metaphor: the marker should feel like returning a finger to the correct place.
- [x] Respect reduced motion without removing the exact-position indication.

## Bottom interaction hint

- [x] Add a subtle instruction such as **Click any word, heading, or paragraph to Immerse**.
- [x] Keep the hint near the bottom of the workspace without obscuring document content or mobile controls.
- [x] Reduce its opacity after a short delay without making the text unreadable.
- [x] Hide it for the remainder of the session after the reader successfully starts immersive mode.
- [x] Defer permanent dismissal to the Phase 3 preference store.
- [x] Keep the hint accessible to keyboard and screen-reader users and static under reduced motion.

## Chapter-aware playback

- [x] Mark chapter boundaries in the reading-position model.
- [x] Detect when immersive playback reaches the end of a chapter.
- [x] Prevent chapter-boundary prompts from being triggered more than once.
- [x] Keep rewind and forward behavior correct across chapter boundaries.
- [x] Show the next chapter title before continuing.
- [x] Calculate chapter and document progress separately.

## Chapter completion prompt

- [x] Design a calm chapter-complete interstitial.
- [x] Show the completed chapter title.
- [x] Show optional session information such as reading time and words read.
- [x] Add **Continue to next chapter**.
- [x] Add **Return to document**.
- [x] Add **Review chapter** if it is meaningfully different from returning.
- [x] Support keyboard selection.
- [x] Restore the correct position after every choice.

## Completion behavior settings

- [ ] Add **Ask what to do** mode.
- [ ] Add **Continue automatically** mode.
- [ ] Add **Return to document** mode.
- [ ] Use Ask mode as the initial default.
- [ ] Add a short cancelable countdown before automatic continuation.
- [ ] Persist the selected behavior.
- [ ] Add tests for all chapter-completion modes.

## Completion criteria

- [ ] Navigation mode presents a calm, responsive document workspace rather than a dashboard.
- [ ] Structured documents display a usable table of contents.
- [ ] Readers can enter immersive mode from an exact word, paragraph, heading, or chapter.
- [ ] Returning from immersion centers and marks the exact current token while retaining a block marker.
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

## Personalized calibration

- [ ] Offer an optional first-run calibration instead of assuming one default reading speed fits everyone.
- [ ] Use a roughly 30-second representative passage with normal punctuation, varied word lengths, and enough context for comprehension.
- [ ] Ask a short, accessible comprehension check after the passage.
- [ ] Combine reading comfort and comprehension—not speed alone—to recommend an initial WPM.
- [ ] Avoid presenting the recommendation as a precise clinical or cognitive measurement.
- [ ] Let readers accept, adjust, or ignore the recommended speed.
- [ ] Persist the current recommendation, calibration date, passage version, and result history locally.
- [ ] Offer an explicit **Recalibrate** action in reading settings.
- [ ] Offer occasional, non-blocking recalibration prompts after meaningful reading time or word-count milestones.
- [ ] Let readers dismiss periodic prompts permanently or postpone them.
- [ ] Compare recalibration results over time without streaks, pressure, or claims that faster is always better.
- [ ] Account for passage familiarity, language, and content difficulty when interpreting results.
- [ ] Add browser tests for completing, skipping, retrying, dismissing, and applying calibration.

## Reading settings

- [ ] Use the accepted calibration result as the initial WPM while preserving manual overrides.
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
- [ ] Expose theme selection from the minimal document top bar without turning it into a settings toolbar.
- [ ] Add document font selection.
- [ ] Add document width and line-height controls.
- [ ] Add immersive word-size control.
- [ ] Add ORP accent-color selection.
- [ ] Add reduced-effects preference in addition to system reduced motion.
- [ ] Validate contrast for every supported theme.

## Navigation settings

- [ ] Add table-of-contents visibility preference.
- [ ] Add **Keep current token centered after exit**.
- [ ] Add **Remember that I dismissed the immersive-entry hint**.
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
- [ ] Readers can calibrate, override, and later revisit their recommended reading pace.

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
- [ ] Open search from the minimal document top bar with a keyboard shortcut and accessible on-screen action.
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

## PDF and EPUB ingestion

- [ ] Support local EPUB upload and preserve its title, author, table of contents, chapters, and reading order.
- [ ] Support local PDF upload with clear expectations about text-extraction and layout limitations.
- [ ] Keep local file extraction on-device where practical.
- [ ] Detect image-only PDFs and explain when OCR would be required rather than silently importing an empty document.
- [ ] Reconstruct PDF reading order conservatively and flag uncertain multi-column or complex layouts.
- [ ] Detect recurring PDF headers, footers, page numbers, and line-end hyphenation without silently deleting uncertain text.
- [ ] Preserve chapter structure where the source format provides it.
- [ ] Show a reviewable structure and text preview before saving any imported file.
- [ ] Show import warnings when structure, reading order, or text quality is uncertain.
- [ ] Preserve source filename and relevant publication metadata.
- [ ] Treat archives, embedded resources, files, and metadata as untrusted input and enforce size/resource limits.
- [ ] Add parser fixtures and tests for valid, malformed, encrypted, image-only, and unusually large files.

## Completion criteria

- [ ] Readers can recover context without abandoning their position.
- [ ] Search, bookmarks, and notes remain navigation-mode tools rather than immersive clutter.
- [ ] PDF and EPUB imports produce a reviewable structured document before reading.
- [ ] Imported files retain useful source metadata and fail with actionable feedback.

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
