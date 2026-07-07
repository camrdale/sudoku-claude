/**
 * Pure Sudoku logic: solving, generating, and validating puzzles.
 * Boards are arrays of 81 numbers, 0 meaning an empty cell.
 */

const SIZE = 9;
const BOX = 3;

export const EMPTY = 0;

/** Difficulty presets: number of clues left in the puzzle. */
export const DIFFICULTIES = {
  easy: { label: 'Easy', clues: 40 },
  medium: { label: 'Medium', clues: 32 },
  hard: { label: 'Hard', clues: 26 },
};

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function rowOf(index) {
  return Math.floor(index / SIZE);
}

export function colOf(index) {
  return index % SIZE;
}

export function boxOf(index) {
  return Math.floor(rowOf(index) / BOX) * BOX + Math.floor(colOf(index) / BOX);
}

/** Indices of all cells sharing a row, column, or box with the given cell. */
export function peersOf(index) {
  const peers = new Set();
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

function candidatesFor(board, index) {
  const used = new Set();
  for (const peer of peersOf(index)) {
    if (board[peer] !== EMPTY) used.add(board[peer]);
  }
  const candidates = [];
  for (let value = 1; value <= SIZE; value++) {
    if (!used.has(value)) candidates.push(value);
  }
  return candidates;
}

/**
 * Solve the board in place using backtracking.
 * Returns true if a solution was found.
 */
function solve(board, randomize = false) {
  let bestIndex = -1;
  let bestCandidates = null;
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
  if (bestIndex === -1) return true;

  if (randomize) shuffle(bestCandidates);
  for (const value of bestCandidates) {
    board[bestIndex] = value;
    if (solve(board, randomize)) return true;
  }
  board[bestIndex] = EMPTY;
  return false;
}

/** Count solutions, stopping early once `limit` is reached. */
function countSolutions(board, limit = 2) {
  let bestIndex = -1;
  let bestCandidates = null;
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
  if (bestIndex === -1) return 1;

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
export function generateSolution() {
  const board = new Array(SIZE * SIZE).fill(EMPTY);
  solve(board, true);
  return board;
}

/**
 * Generate a puzzle with a unique solution.
 * Returns { puzzle, solution } where puzzle has ~clues givens.
 */
export function generatePuzzle(difficulty = 'medium') {
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

/** Indices of filled cells that conflict with a peer. */
export function findConflicts(board) {
  const conflicts = new Set();
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

export function isComplete(board) {
  return !board.includes(EMPTY) && findConflicts(board).size === 0;
}
