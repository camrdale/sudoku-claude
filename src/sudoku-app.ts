import {
  LitElement,
  html,
  css,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
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
import { launchConfetti } from './confetti.js';
import { boing, ejectDigit, jelly, scream, shake } from './bonkers.js';
import wilhelmScreamUrl from './assets/wilhelm-scream.mp3';
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
    bonkers: { state: true },
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
  declare bonkers: boolean;
  declare won: boolean;
  declare elapsed: number;

  constructor() {
    super();
    this.difficulty = 'medium';
    this.autoCandidates = false;
    this.autofill = false;
    this.bonkers = false;
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
      font-weight: 600;
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
    .overlay .confetti {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .overlay .card {
      position: relative;
      background: var(--cell-bg);
      padding: 36px 48px;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 12px 40px rgb(0 0 0 / 0.3);
      animation: card-pop 700ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .overlay .card::before,
    .overlay .card::after {
      content: '🎉';
      font-size: 2rem;
      display: inline-block;
      animation: bounce 900ms ease-in-out infinite alternate;
    }
    .overlay .card::after {
      content: '🎊';
      animation-delay: 450ms;
    }
    .overlay h2 {
      margin: 4px 0 8px;
      font-size: 2.4rem;
      background: linear-gradient(
        90deg,
        #f43f5e,
        #facc15,
        #22c55e,
        #3b82f6,
        #a855f7,
        #f43f5e
      );
      background-size: 500% 100%;
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
      animation: rainbow 2.5s linear infinite;
    }
    .overlay p {
      margin: 0 0 20px;
      color: var(--ink-note);
    }
    @keyframes card-pop {
      from {
        transform: scale(0.2) rotate(-8deg);
        opacity: 0;
      }
      70% {
        transform: scale(1.1) rotate(3deg);
      }
      to {
        transform: scale(1) rotate(0deg);
        opacity: 1;
      }
    }
    @keyframes rainbow {
      to {
        background-position: 500% 0;
      }
    }
    @keyframes bounce {
      from {
        transform: translateY(2px);
      }
      to {
        transform: translateY(-10px) scale(1.2);
      }
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

    const previous = this.board[i];
    const board = this.board.slice();
    board[i] = board[i] === value ? EMPTY : value;
    this.#place(i, board);
    if (this.autofilled.has(i)) {
      // The user took over this cell; it is no longer an automatic entry.
      const autofilled = new Set(this.autofilled);
      autofilled.delete(i);
      this.autofilled = autofilled;
    }
    if (this.bonkers) this.#goBonkers(i, previous, board[i]);
    this.#runAutofill();
  }

  /** Cartoon consequences for changing cell `i` from `previous` to `value`. */
  #goBonkers(i: number, previous: number, value: number): void {
    const boardEl = this.renderRoot.querySelector('sudoku-board');
    if (previous !== EMPTY && previous !== value) {
      // The old digit is violently evicted, screaming.
      const rect = boardEl?.cellRect(i);
      if (rect) ejectDigit(String(previous), rect);
      scream(wilhelmScreamUrl);
    }
    if (value !== EMPTY) {
      if (boardEl) jelly(boardEl);
      if (this.#conflicts.has(i)) {
        // A mistake this dramatic deserves slow motion.
        shake(this);
        scream(wilhelmScreamUrl, 0.45, 0.7);
      } else {
        boing();
      }
    }
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
  #stopConfetti?: () => void;

  protected updated(changed: PropertyValues): void {
    if (!changed.has('won')) return;
    this.#stopConfetti?.();
    this.#stopConfetti = undefined;
    if (this.won) this.#celebrate();
  }

  /** Confetti and the obligatory Wilhelm scream. */
  #celebrate(): void {
    const canvas =
      this.renderRoot.querySelector<HTMLCanvasElement>('canvas.confetti');
    if (canvas) this.#stopConfetti = launchConfetti(canvas);
    void new Audio(wilhelmScreamUrl).play().catch(() => {
      // Audio is best-effort; the confetti still flies.
    });
    if (this.bonkers) {
      // In Bonkers mode, one scream is never enough: a rising barrage.
      [400, 750, 1050, 1300].forEach((delay, k) =>
        setTimeout(() => scream(wilhelmScreamUrl, 0.55 + k * 0.3), delay)
      );
    }
  }

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
      if (this.bonkers) {
        const boardEl = this.renderRoot.querySelector('sudoku-board');
        if (boardEl) jelly(boardEl);
      }
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
    } else if (event.key.toLowerCase() === 'b') {
      this.bonkers = !this.bonkers;
      if (this.bonkers) boing();
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
        <button
          class="btn"
          aria-pressed=${this.bonkers}
          @click=${() => {
            this.bonkers = !this.bonkers;
            if (this.bonkers) boing();
          }}
        >
          🤪 Bonkers ${this.bonkers ? 'on' : 'off'}
        </button>
        <button class="btn" @click=${() => this.#setValue(EMPTY)}>
          ⌫ Erase
        </button>
      </div>

      ${this.won
        ? html`
            <div class="overlay">
              <canvas class="confetti"></canvas>
              <div class="card">
                <h2>Solved!</h2>
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
