/**
 * Pure Sudoku logic: solving, generating, and validating puzzles.
 * Boards are arrays of 81 numbers, 0 meaning an empty cell.
 */

const SIZE = 9;
const BOX = 3;

export const EMPTY = 0;

/** A board is a flat array of 81 cell values (0 = empty). */
export type Board = number[];

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Difficulty presets: number of clues left in the puzzle. */
export const DIFFICULTIES: Record<Difficulty, { label: string; clues: number }> = {
  easy: { label: 'Easy', clues: 40 },
  medium: { label: 'Medium', clues: 32 },
  hard: { label: 'Hard', clues: 26 },
};

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function rowOf(index: number): number {
  return Math.floor(index / SIZE);
}

export function colOf(index: number): number {
  return index % SIZE;
}

export function boxOf(index: number): number {
  return Math.floor(rowOf(index) / BOX) * BOX + Math.floor(colOf(index) / BOX);
}

/** Indices of all cells sharing a row, column, or box with the given cell. */
export function peersOf(index: number): Set<number> {
  const peers = new Set<number>();
  const row = rowOf(index);
  const col = colOf(index);
  const boxRow = Math.floor(row / BOX) * BOX;
  const boxCol = Math.floor(col / BOX) * BOX;
  for (let i = 0; i < SIZE; i++) {
    peers.add(row * SIZE + i);
    peers.add(i * SIZE + col);
    peers.add((boxRow + Math.floor(i / BOX)) * SIZE + boxCol + (i % BOX));
  }
  peers.delete(index);
  return peers;
}

/** Values that can legally be placed at the given cell. */
export function candidatesFor(board: Board, index: number): number[] {
  const used = new Set<number>();
  for (const peer of peersOf(index)) {
    if (board[peer] !== EMPTY) used.add(board[peer]);
  }
  const candidates: number[] = [];
  for (let value = 1; value <= SIZE; value++) {
    if (!used.has(value)) candidates.push(value);
  }
  return candidates;
}

/**
 * Solve the board in place using backtracking.
 * Returns true if a solution was found.
 */
function solve(board: Board, randomize = false): boolean {
  let bestIndex = -1;
  let bestCandidates: number[] | null = null;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY) continue;
    const candidates = candidatesFor(board, i);
    if (candidates.length === 0) return false;
    if (bestCandidates === null || candidates.length < bestCandidates.length) {
      bestIndex = i;
      bestCandidates = candidates;
      if (candidates.length === 1) break;
    }
  }
  if (bestIndex === -1 || bestCandidates === null) return true;

  if (randomize) shuffle(bestCandidates);
  for (const value of bestCandidates) {
    board[bestIndex] = value;
    if (solve(board, randomize)) return true;
  }
  board[bestIndex] = EMPTY;
  return false;
}

/** Count solutions, stopping early once `limit` is reached. */
function countSolutions(board: Board, limit = 2): number {
  let bestIndex = -1;
  let bestCandidates: number[] | null = null;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY) continue;
    const candidates = candidatesFor(board, i);
    if (candidates.length === 0) return 0;
    if (bestCandidates === null || candidates.length < bestCandidates.length) {
      bestIndex = i;
      bestCandidates = candidates;
      if (candidates.length === 1) break;
    }
  }
  if (bestIndex === -1 || bestCandidates === null) return 1;

  let count = 0;
  for (const value of bestCandidates) {
    board[bestIndex] = value;
    count += countSolutions(board, limit - count);
    if (count >= limit) break;
  }
  board[bestIndex] = EMPTY;
  return count;
}

/** Generate a fully solved board. */
export function generateSolution(): Board {
  const board: Board = new Array(SIZE * SIZE).fill(EMPTY);
  solve(board, true);
  return board;
}

/**
 * Generate a puzzle with a unique solution.
 * Returns { puzzle, solution } where puzzle has ~clues givens.
 */
export function generatePuzzle(difficulty: Difficulty = 'medium'): {
  puzzle: Board;
  solution: Board;
} {
  const { clues } = DIFFICULTIES[difficulty] ?? DIFFICULTIES.medium;
  const solution = generateSolution();
  const puzzle = solution.slice();

  const order = shuffle([...Array(SIZE * SIZE).keys()]);
  let remaining = SIZE * SIZE;
  for (const index of order) {
    if (remaining <= clues) break;
    const backup = puzzle[index];
    puzzle[index] = EMPTY;
    if (countSolutions(puzzle.slice()) !== 1) {
      puzzle[index] = backup;
    } else {
      remaining--;
    }
  }

  return { puzzle, solution };
}

/**
 * Parse a board from a string of 81 digits (0 = empty cell), as used in
 * the `s` URL query parameter. Returns null if the string is malformed.
 */
export function parseBoard(text: string): Board | null {
  if (!/^[0-9]{81}$/.test(text)) return null;
  return [...text].map(Number);
}

/** Indices of filled cells that conflict with a peer. */
export function findConflicts(board: Board): Set<number> {
  const conflicts = new Set<number>();
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY) continue;
    for (const peer of peersOf(i)) {
      if (board[peer] === board[i]) {
        conflicts.add(i);
        conflicts.add(peer);
      }
    }
  }
  return conflicts;
}

export function isComplete(board: Board): boolean {
  return !board.includes(EMPTY) && findConflicts(board).size === 0;
}
