# Sudoku

A Sudoku web game built with [Lit](https://lit.dev) and TypeScript.

## Features

- **Puzzle generator** with a guaranteed unique solution, at three
  difficulty levels (Easy, Medium, Hard) controlled by clue count
- **Conflict highlighting** — duplicate numbers in a row, column, or box
  are marked in red
- **Row / column / box / same-value highlighting** for the selected cell
- **Candidates** (pencil marks): toggle candidates mode and type digits
  to add or remove marks in a cell
- **Auto Candidates**: fills every empty cell with its legal candidates,
  derived live from the board — they update as you enter and erase
  numbers, while marks you remove by hand stay removed
- **Number pad** with completed digits greyed out, elapsed timer,
  fill counter, and a win overlay
- **Autofill singles**: when enabled, any cell with exactly one possible
  candidate is filled automatically — including cascades, where each
  entry unlocks the next — with an animation and a rising tone per step.
  Filled digits appear in purple until you overwrite them.
- **Bonkers mode** 🤪: erased or overwritten digits are launched off the
  board, tumbling under cartoon gravity to a randomly pitch-shifted
  Wilhelm scream; the board wobbles like jelly on every entry;
  conflicting entries shake the whole page to a slow-motion scream; and
  winning unleashes a rising scream barrage on top of the confetti
- Light and dark theme, following your system preference
- **Load a board from the URL**: pass `?s=<81 digits>` where each digit
  is a cell's initial value in reading order and `0` means empty

### Keyboard controls

| Key | Action |
| --- | --- |
| `1`–`9` | Enter a number (or toggle a candidate in candidates mode) |
| `Backspace` / `Delete` / `0` | Erase the selected cell |
| Arrow keys | Move the selection |
| `C` | Toggle candidates mode |
| `A` | Toggle Auto Candidates |
| `F` | Toggle Autofill singles |
| `B` | Toggle Bonkers mode |

## Development

Requires Node.js 20+.

```sh
npm install
npx playwright install chromium   # one-time: browser for the e2e tests

npm run dev        # start the Vite dev server
npm test           # run unit tests (node test runner via tsx)
npm run test:e2e   # run browser tests (Playwright)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

## Architecture

- `src/sudoku.ts` — pure game logic: board representation, a
  backtracking solver/generator, candidate computation, and conflict
  detection. No DOM dependencies; unit tested in `test/`. The UI is
  covered by Playwright browser tests in `e2e/`.
- `src/sudoku-board.ts` — `<sudoku-board>`, a presentational Lit
  component that renders the grid from properties and emits
  `cell-selected` events.
- `src/sudoku-app.ts` — `<sudoku-app>`, owns all game state (board,
  candidates, exclusions, timer, win detection) and handles keyboard
  and pointer input.
