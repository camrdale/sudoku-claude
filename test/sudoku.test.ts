import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY,
  DIFFICULTIES,
  candidatesFor,
  findSingleCandidate,
  parseBoard,
  type Difficulty,
  generateSolution,
  generatePuzzle,
  findConflicts,
  isComplete,
  peersOf,
} from '../src/sudoku.js';

test('generateSolution produces a complete valid board', () => {
  const board = generateSolution();
  assert.equal(board.length, 81);
  assert.ok(!board.includes(EMPTY));
  assert.equal(findConflicts(board).size, 0);
  assert.ok(isComplete(board));
});

test('generatePuzzle leaves roughly the requested number of clues', () => {
  for (const [difficulty, { clues }] of Object.entries(DIFFICULTIES) as [
    Difficulty,
    { label: string; clues: number },
  ][]) {
    const { puzzle } = generatePuzzle(difficulty);
    const givens = puzzle.filter((v) => v !== EMPTY).length;
    assert.ok(
      givens >= clues,
      `${difficulty}: expected at least ${clues} givens, got ${givens}`
    );
    assert.ok(givens < 81, `${difficulty}: puzzle should have empty cells`);
  }
});

test('puzzle is consistent with its solution', () => {
  const { puzzle, solution } = generatePuzzle('easy');
  assert.ok(isComplete(solution));
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] !== EMPTY) {
      assert.equal(puzzle[i], solution[i]);
    }
  }
});

test('findConflicts flags duplicates in row, column, and box', () => {
  const board = new Array(81).fill(EMPTY);
  board[0] = 5;
  board[8] = 5; // same row
  let conflicts = findConflicts(board);
  assert.ok(conflicts.has(0) && conflicts.has(8));

  board[8] = EMPTY;
  board[72] = 5; // same column
  conflicts = findConflicts(board);
  assert.ok(conflicts.has(0) && conflicts.has(72));

  board[72] = EMPTY;
  board[10] = 5; // same box
  conflicts = findConflicts(board);
  assert.ok(conflicts.has(0) && conflicts.has(10));
});

test('findConflicts is empty for a legal partial board', () => {
  const board = new Array(81).fill(EMPTY);
  board[0] = 1;
  board[1] = 2;
  board[9] = 3;
  assert.equal(findConflicts(board).size, 0);
});

test('candidatesFor excludes values used by peers', () => {
  const board = new Array(81).fill(EMPTY);
  assert.deepEqual(candidatesFor(board, 0), [1, 2, 3, 4, 5, 6, 7, 8, 9]);

  board[1] = 5; // same row
  board[9] = 3; // same column and box
  board[10] = 7; // same box
  assert.deepEqual(candidatesFor(board, 0), [1, 2, 4, 6, 8, 9]);
});

test('findSingleCandidate finds a cell whose peers use eight values', () => {
  const board = new Array(81).fill(EMPTY);
  assert.equal(findSingleCandidate(board), null);

  // Cell 0 sees 1..5 in its row and 6,7,8 in its column: only 9 remains.
  [1, 2, 3, 4, 5].forEach((v, i) => (board[i + 1] = v));
  [6, 7, 8].forEach((v, i) => (board[(i + 1) * 9] = v));
  assert.deepEqual(findSingleCandidate(board), { index: 0, value: 9 });
});

test('findSingleCandidate honors removed candidates', () => {
  const board = new Array(81).fill(EMPTY);
  // Cell 0 sees 1..5 in its row and 6,7 in its column: 8 and 9 remain.
  [1, 2, 3, 4, 5].forEach((v, i) => (board[i + 1] = v));
  [6, 7].forEach((v, i) => (board[(i + 1) * 9] = v));
  assert.equal(findSingleCandidate(board), null);

  const removed = Array.from({ length: 81 }, () => new Set<number>());
  removed[0].add(8);
  assert.deepEqual(findSingleCandidate(board, removed), {
    index: 0,
    value: 9,
  });
});

test('parseBoard round-trips a puzzle string', () => {
  const { puzzle } = generatePuzzle('easy');
  const text = puzzle.join('');
  assert.deepEqual(parseBoard(text), puzzle);
});

test('parseBoard rejects malformed strings', () => {
  assert.equal(parseBoard(''), null);
  assert.equal(parseBoard('123'), null);
  assert.equal(parseBoard('0'.repeat(80)), null);
  assert.equal(parseBoard('0'.repeat(82)), null);
  assert.equal(parseBoard('a'.repeat(81)), null);
  assert.equal(parseBoard('0'.repeat(80) + 'x'), null);
});

test('peersOf covers row, column, and box without the cell itself', () => {
  const peers = peersOf(40); // center cell: row 4, col 4
  assert.equal(peers.size, 20);
  assert.ok(!peers.has(40));
  assert.ok(peers.has(36)); // row 4, col 0
  assert.ok(peers.has(4)); // row 0, col 4
  assert.ok(peers.has(30)); // same box: row 3, col 3
});
