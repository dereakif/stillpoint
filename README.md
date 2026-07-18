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

1. Paste or type text into the document field.
2. Select **Immerse**.
3. Wait for the countdown to finish.
4. Use the on-screen controls or keyboard shortcuts to control playback.
5. Select **Exit** or press `Escape` to return to the document view.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play or pause |
| `Left Arrow` | Rewind five tokens |
| `Right Arrow` | Skip forward five tokens |
| `Up Arrow` | Increase speed by 10 WPM |
| `Down Arrow` | Decrease speed by 10 WPM |
| `C` | Replace the current text with clipboard contents and continue |
| `Escape` | Exit immersive mode |

Clipboard access depends on browser support, page security, and user permission. It generally works on `localhost` and secure HTTPS pages.

## Available commands

```sh
bun run dev      # Start the Vite development server
bun run build    # Create a production build in dist/
bun run lint     # Run Oxlint
bun run preview  # Preview the production build locally
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
