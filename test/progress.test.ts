import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deserializeProgress,
  loadProgress,
  saveProgress,
  serializeProgress,
  type Progress,
} from '../src/progress.js';
import { EMPTY, parseBoard, type Board } from '../src/sudoku.js';

/** A stand-in for `localStorage`, so the store can be exercised in node. */
function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    key: (i: number) => [...entries.keys()][i] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
  } as unknown as Storage;
}

const storage = memoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: storage };

/** A puzzle with a handful of empty cells, and a board part-way through it. */
const PUZZLE = parseBoard(
  '002845379457090826938607015583902164694310752701456983075280041246731598819564237'
) as Board;

function progress(overrides: Partial<Progress> = {}): Progress {
  const board = PUZZLE.slice();
  board[0] = 1;
  const candidates = Array.from({ length: 81 }, () => new Set<number>());
  candidates[1] = new Set([6, 3]);
  const removedCandidates = Array.from({ length: 81 }, () => new Set<number>());
  removedCandidates[4] = new Set([9]);
  return {
    board,
    candidates,
    removedCandidates,
    autofilled: new Set([0]),
    elapsed: 42,
    difficulty: 'hard',
    won: false,
    ...overrides,
  };
}

test('progress round-trips through serialization', () => {
  const original = progress();
  const restored = deserializeProgress(serializeProgress(original), PUZZLE);
  assert.deepEqual(restored, original);
});

test('a record is rejected when it contradicts the puzzle givens', () => {
  const wrong = progress();
  // Cell 2 is a given 2 in this puzzle; a record that overwrites it is stale.
  wrong.board[2] = 4;
  assert.equal(deserializeProgress(serializeProgress(wrong), PUZZLE), null);
});

test('a record for a different puzzle is rejected', () => {
  const other = PUZZLE.slice();
  other[0] = 1; // an extra given the saved board leaves empty
  assert.equal(deserializeProgress(serializeProgress(progress({ board: PUZZLE.slice() })), other), null);
});

test('malformed records are rejected rather than thrown on', () => {
  for (const text of [
    '',
    'not json',
    '{}',
    JSON.stringify({ v: 999, board: PUZZLE.join('') }),
    JSON.stringify({ v: 1, board: '123' }),
    JSON.stringify({ v: 1, board: PUZZLE.join(''), candidates: 'x'.repeat(80) }),
  ]) {
    assert.equal(deserializeProgress(text, PUZZLE), null, text.slice(0, 40));
  }
});

test('a nonsense clock or difficulty falls back to sane values', () => {
  const text = serializeProgress(progress()).replace(
    '"elapsed":42,"difficulty":"hard"',
    '"elapsed":-5,"difficulty":"impossible"'
  );
  const restored = deserializeProgress(text, PUZZLE);
  assert.equal(restored?.elapsed, 0);
  assert.equal(restored?.difficulty, 'medium');
});

test('an empty board keeps every cell of an untouched puzzle', () => {
  const blank = new Array(81).fill(EMPTY) as Board;
  const restored = deserializeProgress(
    serializeProgress(progress({ board: blank, autofilled: new Set() })),
    blank
  );
  assert.deepEqual(restored?.board, blank);
});

test('progress round-trips through storage', () => {
  storage.clear();
  assert.equal(loadProgress(PUZZLE), null);
  const original = progress();
  saveProgress(PUZZLE, original);
  assert.deepEqual(loadProgress(PUZZLE), original);
});

test('the store keeps only the most recent puzzles', () => {
  storage.clear();
  // Distinct puzzles, far more than the store is willing to keep.
  const puzzles = [...Array(60).keys()].map((i) => {
    const puzzle = new Array(81).fill(EMPTY) as Board;
    puzzle[0] = (i % 9) + 1;
    puzzle[1] = Math.floor(i / 9) + 1;
    return puzzle;
  });
  for (const puzzle of puzzles) {
    saveProgress(puzzle, progress({ board: puzzle.slice(), autofilled: new Set() }));
  }
  assert.ok(storage.length <= 50, `kept ${storage.length} puzzles`);
  // The one just played is still there; the first one has been dropped.
  assert.notEqual(loadProgress(puzzles[puzzles.length - 1]), null);
  assert.equal(loadProgress(puzzles[0]), null);
});
