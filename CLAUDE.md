# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Sudoku web game built with Lit 3 + TypeScript + Vite, deployed to GitHub Pages at https://camrdale.github.io/sudoku-claude/.

## Commands

```sh
npm run dev        # Vite dev server (http://localhost:5173/)
npm test           # unit tests (node test runner via tsx)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build to dist/
```

Run a single test by name pattern:

```sh
node --import tsx --test --test-name-pattern="parseBoard" test/sudoku.test.ts
```

Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs tests, builds, and deploys to GitHub Pages — a failing test blocks the deploy. Production builds use `/sudoku-claude/` as the Vite base path (see `vite.config.ts`); the dev server stays at `/`.

## Architecture

Three layers, strictly separated:

- **`src/sudoku.ts`** — pure game logic with no DOM or Lit dependencies; this is the only unit-tested layer (`test/sudoku.test.ts`). A board is a flat `number[]` of 81 cells in reading order, `0` (`EMPTY`) meaning empty. Contains the backtracking solver/generator (`generatePuzzle` guarantees a unique solution by removing clues only while `countSolutions` stays 1), `candidatesFor`, `findSingleCandidate`, `findConflicts`, and `parseBoard` (the `?s=<81 digits>` URL format).
- **`src/sudoku-app.ts`** — `<sudoku-app>` owns *all* game state and input handling (keyboard shortcuts: 1-9, arrows, Backspace, C/A/F). Win celebration (confetti + bundled Wilhelm scream mp3) fires on the `won` transition in `updated()`.
- **`src/sudoku-board.ts`** — `<sudoku-board>` is purely presentational: state in via properties, `cell-selected` events out. Keep it free of game rules.

State subtleties in `sudoku-app.ts` worth knowing before changing it:

- Derived vs. stored: conflicts and (in Auto Candidates mode) displayed candidates are computed in getters on every render, not stored. Auto Candidates honors manual removals via the `removedCandidates` per-cell exclusion sets; the user's manual pencil marks (`candidates`) are a separate layer used only when auto mode is off.
- The autofill cascade (`#runAutofill`) is an async loop guarded by `#autofillToken`; any user action, toggle-off, or new game increments the token to cancel an in-flight cascade. It re-reads the live board after every pause — don't let it capture stale state.
- Sounds are synthesized with the Web Audio API (no asset files) except the Wilhelm scream, which is a bundled mp3 (typed via `src/assets.d.ts`).
- Visual/audio juice lives in side-effect modules (`src/confetti.ts`, `src/bonkers.ts`) that manipulate the DOM directly (canvas, ejected `document.body` elements, Web Animations API) — they are fire-and-forget and hold no game state.

## Lit + TypeScript conventions

- No decorators: components use `static properties` plus `declare`-typed class fields initialized in the constructor. Don't convert `declare` fields to initialized class fields — that would shadow Lit's reactive accessors.
- Event listeners that need `this` are arrow-function class fields (e.g. `#onKeyDown`); private *methods* cannot be rebound with `.bind()` (it throws at runtime).
- Reactive updates require replacing objects, not mutating them: copy the array/Set, change the copy, assign it back.
- Relative imports use the `.js` extension (TypeScript ESM style), resolved by Vite/tsx.
- Both custom elements are registered in `HTMLElementTagNameMap`.
