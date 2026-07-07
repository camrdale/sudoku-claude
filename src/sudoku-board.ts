import { LitElement, html, css, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { EMPTY, rowOf, colOf, boxOf, type Board } from './sudoku.js';

/**
 * Renders the 9x9 grid. Purely presentational: receives the game state as
 * properties and emits `cell-selected` events when a cell is clicked.
 */
export class SudokuBoard extends LitElement {
  static properties = {
    board: { type: Array },
    puzzle: { type: Array },
    candidates: { type: Array },
    selected: { type: Number },
    conflicts: { type: Object },
  };

  declare board: Board;
  declare puzzle: Board;
  declare candidates: Set<number>[];
  declare selected: number;
  declare conflicts: Set<number>;

  constructor() {
    super();
    this.board = [];
    this.puzzle = [];
    this.candidates = [];
    this.selected = -1;
    this.conflicts = new Set();
  }

  static styles = css`
    :host {
      display: block;
      user-select: none;
      touch-action: manipulation;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(9, 1fr);
      grid-template-rows: repeat(9, 1fr);
      aspect-ratio: 1;
      border: 3px solid var(--line-strong);
      border-radius: 8px;
      overflow: hidden;
      background: var(--cell-bg);
    }
    .cell {
      display: grid;
      place-items: center;
      position: relative;
      font-size: clamp(1rem, 4.5vmin, 1.8rem);
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      color: var(--ink-user);
      cursor: pointer;
      background: transparent;
      padding: 0;
      font-family: inherit;
    }
    .cell:nth-child(9n) {
      border-right: none;
    }
    .cell:nth-child(n + 73) {
      border-bottom: none;
    }
    .cell.box-right {
      border-right: 2px solid var(--line-strong);
    }
    .cell.box-bottom {
      border-bottom: 2px solid var(--line-strong);
    }
    .cell.given {
      color: var(--ink-given);
      font-weight: 600;
    }
    .cell.peer {
      background: var(--cell-peer);
    }
    .cell.same-value {
      background: var(--cell-same);
    }
    .cell.selected {
      background: var(--cell-selected);
    }
    .cell.conflict {
      color: var(--ink-error);
    }
    .cell.conflict.selected,
    .cell.conflict.same-value {
      background: var(--cell-error);
    }
    .candidates {
      position: absolute;
      inset: 0;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      place-items: center;
      font-size: clamp(0.45rem, 1.7vmin, 0.7rem);
      color: var(--ink-note);
      line-height: 1;
    }
  `;

  #select(index: number): void {
    this.dispatchEvent(
      new CustomEvent('cell-selected', { detail: { index } })
    );
  }

  #cellClasses(index: number): Record<string, boolean> {
    const value = this.board[index];
    const selectedValue =
      this.selected >= 0 ? this.board[this.selected] : EMPTY;
    return {
      cell: true,
      given: this.puzzle[index] !== EMPTY,
      selected: index === this.selected,
      conflict: this.conflicts.has(index),
      peer:
        this.selected >= 0 &&
        index !== this.selected &&
        (rowOf(index) === rowOf(this.selected) ||
          colOf(index) === colOf(this.selected) ||
          boxOf(index) === boxOf(this.selected)),
      'same-value':
        value !== EMPTY && value === selectedValue && index !== this.selected,
      'box-right': colOf(index) % 3 === 2 && colOf(index) !== 8,
      'box-bottom': rowOf(index) % 3 === 2 && rowOf(index) !== 8,
    };
  }

  #renderCell(value: number, index: number): TemplateResult {
    const candidates = this.candidates[index];
    return html`
      <button
        class=${classMap(this.#cellClasses(index))}
        aria-label="Row ${rowOf(index) + 1}, column ${colOf(index) + 1}"
        @click=${() => this.#select(index)}
      >
        ${value !== EMPTY
          ? value
          : candidates?.size
            ? html`<span class="candidates">
                ${[...Array(9).keys()].map(
                  (i) => html`<span>${candidates.has(i + 1) ? i + 1 : ''}</span>`
                )}
              </span>`
            : ''}
      </button>
    `;
  }

  render(): TemplateResult {
    return html`
      <div class="grid" role="grid" aria-label="Sudoku board">
        ${this.board.map((value, index) => this.#renderCell(value, index))}
      </div>
    `;
  }
}

customElements.define('sudoku-board', SudokuBoard);

declare global {
  interface HTMLElementTagNameMap {
    'sudoku-board': SudokuBoard;
  }
}
