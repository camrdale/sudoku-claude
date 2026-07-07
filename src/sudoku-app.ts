import { LitElement, html, css, type TemplateResult } from 'lit';
import {
  EMPTY,
  DIFFICULTIES,
  candidatesFor,
  generatePuzzle,
  findConflicts,
  findSingleCandidate,
  isComplete,
  parseBoard,
  peersOf,
  type Board,
  type Difficulty,
} from './sudoku.js';
import './sudoku-board.js';

/** Owns all game state and handles input; delegates rendering of the grid. */
export class SudokuApp extends LitElement {
  static properties = {
    difficulty: { type: String },
    board: { state: true },
    puzzle: { state: true },
    candidates: { state: true },
    removedCandidates: { state: true },
    selected: { state: true },
    candidatesMode: { state: true },
    autoCandidates: { state: true },
    autofill: { state: true },
    autofilled: { state: true },
    won: { state: true },
    elapsed: { state: true },
  };

  declare difficulty: Difficulty;
  declare board: Board;
  declare puzzle: Board;
  declare candidates: Set<number>[];
  declare removedCandidates: Set<number>[];
  declare selected: number;
  declare candidatesMode: boolean;
  declare autoCandidates: boolean;
  declare autofill: boolean;
  declare autofilled: Set<number>;
  declare won: boolean;
  declare elapsed: number;

  constructor() {
    super();
    this.difficulty = 'medium';
    this.autoCandidates = false;
    this.autofill = false;
    const shared = new URLSearchParams(window.location.search).get('s');
    this.#newGame((shared && parseBoard(shared)) || undefined);
  }

  static styles = css`
    :host {
      display: block;
      max-width: 480px;
      margin: 0 auto;
      padding: 16px;
      font-family: system-ui, sans-serif;
      color: var(--ink);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 1.4rem;
      margin: 0;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    select,
    .btn {
      font: inherit;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: var(--cell-bg);
      color: var(--ink);
      cursor: pointer;
    }
    .btn:hover,
    select:hover {
      border-color: var(--line-strong);
    }
    .btn:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .status {
      display: flex;
      justify-content: space-between;
      margin: 10px 2px;
      font-variant-numeric: tabular-nums;
      color: var(--ink-note);
    }
    .pad {
      display: grid;
      grid-template-columns: repeat(9, 1fr);
      gap: 6px;
      margin-top: 14px;
    }
    .pad button {
      font: inherit;
      font-size: 1.3rem;
      aspect-ratio: 1;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: var(--cell-bg);
      color: var(--ink);
      cursor: pointer;
    }
    .pad button:disabled {
      opacity: 0.25;
      cursor: default;
    }
    .pad button:not(:disabled):hover {
      background: var(--cell-peer);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .actions .btn {
      flex: 1;
      text-align: center;
      white-space: nowrap;
    }
    .btn[aria-pressed='true'] {
      background: var(--cell-selected);
      border-color: var(--line-strong);
    }
    .overlay {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      background: rgb(0 0 0 / 0.5);
    }
    .overlay .card {
      background: var(--cell-bg);
      padding: 32px 40px;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 12px 40px rgb(0 0 0 / 0.3);
    }
    .overlay h2 {
      margin: 0 0 8px;
    }
    .overlay p {
      margin: 0 0 20px;
      color: var(--ink-note);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this.#onKeyDown);
    this.#timer = setInterval(() => {
      if (!this.won) this.elapsed = Math.floor((Date.now() - this.#startTime) / 1000);
    }, 1000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.#onKeyDown);
    clearInterval(this.#timer);
  }

  #timer?: ReturnType<typeof setInterval>;
  #startTime = 0;

  /** Start a game from the given puzzle, or a freshly generated one. */
  #newGame(puzzle?: Board): void {
    this.#autofillToken++;
    if (!puzzle) {
      puzzle = generatePuzzle(this.difficulty).puzzle;
      this.#clearSharedBoardParam();
    }
    this.puzzle = puzzle;
    this.board = puzzle.slice();
    this.autofilled = new Set();
    this.candidates = Array.from({ length: 81 }, () => new Set<number>());
    this.removedCandidates = Array.from({ length: 81 }, () => new Set<number>());
    this.selected = -1;
    this.candidatesMode = false;
    this.won = false;
    this.elapsed = 0;
    this.#startTime = Date.now();
    if (this.autofill) this.#runAutofill();
  }

  /** Drop the `s` parameter so a reload doesn't bring the old board back. */
  #clearSharedBoardParam(): void {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('s')) return;
    params.delete('s');
    const query = params.size ? `?${params}` : '';
    history.replaceState(null, '', window.location.pathname + query + window.location.hash);
  }

  get #conflicts(): Set<number> {
    return findConflicts(this.board);
  }

  /**
   * Candidates shown on the board. In auto mode they are derived from the
   * current board state — so they follow every entry and erase — minus the
   * marks the user has removed by hand. Otherwise they are the manual sets.
   */
  get #displayedCandidates(): Set<number>[] {
    if (!this.autoCandidates) return this.candidates;
    return this.board.map((value, i) => {
      if (value !== EMPTY) return new Set<number>();
      const auto = new Set(candidatesFor(this.board, i));
      for (const value of this.removedCandidates[i]) auto.delete(value);
      return auto;
    });
  }

  #toggleAutoCandidates(): void {
    this.autoCandidates = !this.autoCandidates;
    // Turning auto on starts fresh: forget earlier manual removals.
    if (this.autoCandidates) {
      this.removedCandidates = Array.from({ length: 81 }, () => new Set<number>());
    }
  }

  /** Values that already appear 9 times without conflicts. */
  get #exhausted(): Set<number> {
    const counts = new Map<number, number>();
    const conflicts = this.#conflicts;
    for (let i = 0; i < 81; i++) {
      const v = this.board[i];
      if (v !== EMPTY && !conflicts.has(i)) {
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
    return new Set([...counts].filter(([, n]) => n >= 9).map(([v]) => v));
  }

  #setValue(value: number): void {
    const i = this.selected;
    if (i < 0 || this.puzzle[i] !== EMPTY || this.won) return;

    if (this.candidatesMode && value !== EMPTY) {
      if (this.board[i] !== EMPTY) return;
      if (this.autoCandidates) {
        // Toggle the mark's exclusion; the rest stays derived from the board.
        const removed = new Set(this.removedCandidates[i]);
        removed.has(value) ? removed.delete(value) : removed.add(value);
        this.removedCandidates = this.removedCandidates.map((n, j) =>
          j === i ? removed : n
        );
      } else {
        const candidates = new Set(this.candidates[i]);
        candidates.has(value) ? candidates.delete(value) : candidates.add(value);
        this.candidates = this.candidates.map((n, j) =>
          j === i ? candidates : n
        );
      }
      // Removing a mark can leave a cell with a single candidate.
      this.#runAutofill();
      return;
    }

    const board = this.board.slice();
    board[i] = board[i] === value ? EMPTY : value;
    this.#place(i, board);
    if (this.autofilled.has(i)) {
      // The user took over this cell; it is no longer an automatic entry.
      const autofilled = new Set(this.autofilled);
      autofilled.delete(i);
      this.autofilled = autofilled;
    }
    this.#runAutofill();
  }

  /** Commit an updated board where cell `i` changed, with bookkeeping. */
  #place(i: number, board: Board): void {
    const value = board[i];
    this.board = board;

    if (value !== EMPTY) {
      // Clear the placed value from candidates in the same row, column, and box.
      this.candidates = this.candidates.map((n, j) => {
        if (j === i) return new Set<number>();
        if (!peersOf(i).has(j) || !n.has(value)) return n;
        const copy = new Set(n);
        copy.delete(value);
        return copy;
      });
    }

    if (isComplete(board)) this.won = true;
  }

  #autofillToken = 0;
  #audio?: AudioContext;

  #toggleAutofill(): void {
    this.autofill = !this.autofill;
    if (this.autofill) this.#runAutofill();
    else this.#autofillToken++; // cancel a cascade in flight
  }

  /**
   * While enabled, repeatedly fill the first cell that has exactly one
   * possible candidate, pausing between entries so each one can be seen
   * and heard. Any user action supersedes a running cascade (the token
   * changes), and the loop re-checks the live board after every pause.
   */
  async #runAutofill(): Promise<void> {
    if (!this.autofill) return;
    const token = ++this.#autofillToken;
    const removed = () =>
      this.autoCandidates ? this.removedCandidates : undefined;
    for (let step = 0; !this.won; step++) {
      if (!findSingleCandidate(this.board, removed())) return;
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (token !== this.#autofillToken || !this.autofill || this.won) return;
      const single = findSingleCandidate(this.board, removed());
      if (!single) return;
      const board = this.board.slice();
      board[single.index] = single.value;
      this.autofilled = new Set(this.autofilled).add(single.index);
      this.#place(single.index, board);
      this.#playTone(step);
    }
  }

  /** A short marimba-like tone, rising with each step of a cascade. */
  #playTone(step: number): void {
    try {
      this.#audio ??= new AudioContext();
      if (this.#audio.state === 'suspended') void this.#audio.resume();
      // Steps climb a C-major pentatonic scale, two octaves up from C5.
      const pentatonic = [0, 2, 4, 7, 9];
      const octave = Math.floor(step / pentatonic.length) % 3;
      const semitones = pentatonic[step % pentatonic.length] + 12 * octave;
      const start = this.#audio.currentTime;
      const oscillator = this.#audio.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = 523.25 * 2 ** (semitones / 12);
      const gain = this.#audio.createGain();
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      oscillator.connect(gain).connect(this.#audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.45);
    } catch {
      // Audio is best-effort: keep filling even if the context is unavailable.
    }
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key >= '1' && event.key <= '9') {
      this.#setValue(Number(event.key));
    } else if (['Backspace', 'Delete', '0'].includes(event.key)) {
      this.#setValue(EMPTY);
    } else if (event.key.startsWith('Arrow') && this.selected >= 0) {
      event.preventDefault();
      const delta = {
        ArrowUp: -9,
        ArrowDown: 9,
        ArrowLeft: -1,
        ArrowRight: 1,
      }[event.key];
      if (delta === undefined) return;
      const next = this.selected + delta;
      if (next >= 0 && next < 81) this.selected = next;
    } else if (event.key.toLowerCase() === 'c') {
      this.candidatesMode = !this.candidatesMode;
    } else if (event.key.toLowerCase() === 'a') {
      this.#toggleAutoCandidates();
    } else if (event.key.toLowerCase() === 'f') {
      this.#toggleAutofill();
    }
  };

  #formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  render(): TemplateResult {
    const filled = this.board.filter((v) => v !== EMPTY).length;
    const exhausted = this.#exhausted;
    return html`
      <header>
        <h1>Sudoku</h1>
        <div class="toolbar">
          <select
            aria-label="Difficulty"
            .value=${this.difficulty}
            @change=${(e: Event) => {
              this.difficulty = (e.target as HTMLSelectElement)
                .value as Difficulty;
              this.#newGame();
            }}
          >
            ${Object.entries(DIFFICULTIES).map(
              ([key, { label }]) =>
                html`<option value=${key} ?selected=${key === this.difficulty}>
                  ${label}
                </option>`
            )}
          </select>
          <button class="btn" @click=${() => this.#newGame()}>New game</button>
        </div>
      </header>

      <div class="status">
        <span>${this.#formatTime(this.elapsed)}</span>
        <span>${filled} / 81</span>
      </div>

      <sudoku-board
        .board=${this.board}
        .puzzle=${this.puzzle}
        .candidates=${this.#displayedCandidates}
        .autofilled=${this.autofilled}
        .selected=${this.selected}
        .conflicts=${this.#conflicts}
        @cell-selected=${(e: CustomEvent<{ index: number }>) =>
          (this.selected = e.detail.index)}
      ></sudoku-board>

      <div class="pad">
        ${[...Array(9).keys()].map((i) => {
          const value = i + 1;
          return html`
            <button
              ?disabled=${exhausted.has(value)}
              @click=${() => this.#setValue(value)}
            >
              ${value}
            </button>
          `;
        })}
      </div>

      <div class="actions">
        <button
          class="btn"
          aria-pressed=${this.candidatesMode}
          @click=${() => (this.candidatesMode = !this.candidatesMode)}
        >
          ✏️ Candidates ${this.candidatesMode ? 'on' : 'off'}
        </button>
        <button
          class="btn"
          aria-pressed=${this.autoCandidates}
          @click=${() => this.#toggleAutoCandidates()}
        >
          ⚡ Auto ${this.autoCandidates ? 'on' : 'off'}
        </button>
        <button
          class="btn"
          aria-pressed=${this.autofill}
          @click=${() => this.#toggleAutofill()}
        >
          ✨ Fill ${this.autofill ? 'on' : 'off'}
        </button>
        <button class="btn" @click=${() => this.#setValue(EMPTY)}>
          ⌫ Erase
        </button>
      </div>

      ${this.won
        ? html`
            <div class="overlay">
              <div class="card">
                <h2>🎉 Solved!</h2>
                <p>
                  ${DIFFICULTIES[this.difficulty].label} ·
                  ${this.#formatTime(this.elapsed)}
                </p>
                <button class="btn" @click=${() => this.#newGame()}>
                  Play again
                </button>
              </div>
            </div>
          `
        : ''}
    `;
  }
}

customElements.define('sudoku-app', SudokuApp);

declare global {
  interface HTMLElementTagNameMap {
    'sudoku-app': SudokuApp;
  }
}
