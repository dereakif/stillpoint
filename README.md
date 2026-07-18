# Stillpoint

Stillpoint is a browser-based RSVP (Rapid Serial Visual Presentation) reader. Paste text into the document view, enter immersive mode, and read one word at a time without moving your eyes across a page.

The reader highlights each token's Optimal Recognition Point (ORP), adjusts timing for punctuation and word length, and supports keyboard-driven playback.

## Features

- Focused, single-token reading view
- ORP highlighting and centered word alignment
- Adjustable reading speed from 100 to 800 WPM
- Timing adjustments for punctuation, paragraphs, and longer words
- Rewind and skip-forward controls
- Keyboard shortcuts for playback and speed
- Clipboard loading while in immersive mode
- Responsive interface built with Tailwind CSS and DaisyUI

## Getting started

### Requirements

- [Bun](https://bun.sh/)
- A modern browser

### Install dependencies

```sh
bun install
```

### Start the development server

```sh
bun run dev
```

Open the local URL printed by Vite.

## Usage

1. Paste or type text into the document editor.
2. Select **Read document** to open the rendered reading view.
3. Select **Resume reading**, or use a paragraph's **Immerse from here** action to begin at that paragraph.
4. Wait for the countdown to finish.
5. Use the on-screen controls or keyboard shortcuts to control playback.
6. Select **Exit** or press `Escape` to return to the document view.
7. Select **Edit document** whenever you want to change the source text.

### Keyboard shortcuts

| Key           | Action                                                        |
| ------------- | ------------------------------------------------------------- |
| `Space`       | Play or pause                                                 |
| `Left Arrow`  | Rewind five tokens                                            |
| `Right Arrow` | Skip forward five tokens                                      |
| `Up Arrow`    | Increase speed by 10 WPM                                      |
| `Down Arrow`  | Decrease speed by 10 WPM                                      |
| `C`           | Replace the current text with clipboard contents and continue |
| `Escape`      | Exit immersive mode                                           |

Clipboard access depends on browser support, page security, and user permission. It generally works on `localhost` and secure HTTPS pages.

### Immersive entry semantics

Paragraph text remains selectable and never activates immersive mode by itself. Each paragraph has a separate keyboard-accessible **Immerse from here** action that starts at token offset `0`. **Resume reading** starts at the shared current position.

Structured headings are planned for Phase 2. When introduced, heading clicks will remain navigation actions; immersive entry associated with a heading will begin at the following readable paragraph rather than displaying the heading as the first RSVP token.

### Playback semantics

- Progress represents the displayed token's one-based position as a fraction of the total token count. The first of four tokens reports `0.25`, and the last reports `1`.
- Pausing keeps the current token selected. Resuming redisplays that token for its full calculated duration rather than continuing a partially elapsed duration.
- Changing WPM during playback immediately redisplays the current token and gives it a full duration calculated at the new speed.
- Playing after completion restarts playback from the first token. `reset` returns to and previews the first token while paused; `restart` returns to the first token and begins playing.

## RSVP player API

`createRSVPPlayer(text, options)` returns an immutable public interface. Internal timers, tokens, and listener collections remain private.

### Commands and state

- Playback: `play()`, `pause()`, `playToggle()`, `restart()`, and `reset()`
- Navigation: `preview()`, `rewind(count)`, `skipForward(count)`, and `setPosition(position)`
- Content and speed: `loadText(text)`, `setWpm(wpm)`, and `getWpm()`
- State: `isPlaying()` and `getState()`

`getState()` returns a new snapshot containing `isPlaying`, `wpm`, `currentIndex`, `tokenCount`, `progress`, and the shared `position`. Empty content uses `currentIndex: null`, `progress: 0`, and `position: null`.

A reading position has the shape `{ blockId, tokenOffset }`, such as `{ blockId: 'paragraph-2', tokenOffset: 4 }`. Document and immersive modes consume the same position, and RSVP navigation or playback updates it.

Subscribe with `subscribe(event, listener)`. Supported events are `word`, `progress`, `positionChange`, `complete`, `playStateChange`, and `wpmChange`. Every call returns an unsubscribe function, and multiple listeners can observe the same event independently.

## Available commands

```sh
bun run dev      # Start the Vite development server
bun run build    # Create a production build in dist/
bun run lint        # Run Oxlint
bun run test         # Run unit tests
bun run test:e2e     # Run Playwright browser tests
bun run test:e2e:ui  # Open Playwright's interactive test UI
bun run preview     # Preview the production build locally
```

## Technology

- React 19
- Vite 8
- Tailwind CSS 4
- DaisyUI 5
- Lucide React
- Oxlint
- Prettier

## Current limitations

- Text and reading position are not persisted between page loads.
- Exiting immersive mode resets playback position and reading speed.
- Clipboard loading may be unavailable if browser permission is denied.

## Production build

Create an optimized static build with:

```sh
bun run build
```

The generated `dist/` directory can be hosted by any static web server.
