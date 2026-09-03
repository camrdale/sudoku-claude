/**
 * Per-puzzle progress, saved in the browser.
 *
 * Progress is keyed by the puzzle itself — the same 81 digits the `s` query
 * parameter carries — so coming back to a puzzle's URL restores the entries,
 * pencil marks and clock from last time. It lives in `localStorage`, so it
 * outlives the tab that made it. Serialization is pure and testable; only
 * `saveProgress`/`loadProgress` touch storage, and they treat anything
 * unreadable or malformed as "no saved progress" rather than failing the game.
 */
import {
  DIFFICULTIES,
  EMPTY,
  formatBoard,
  parseBoard,
  type Board,
  type Difficulty,
} from './sudoku.js';

const KEY_PREFIX = 'sudoku:progress:';
const VERSION = 1;
const CELLS = 81;

/** How many puzzles to keep; the least recently saved are dropped. */
const MAX_PUZZLES = 50;

/** The part of the game state that belongs to a puzzle in progress. */
export interface Progress {
  board: Board;
  candidates: Set<number>[];
  removedCandidates: Set<number>[];
  autofilled: Set<number>;
  elapsed: number;
  difficulty: Difficulty;
  won: boolean;
}

/** Per-cell digit sets as 81 groups of digits, e.g. `"|37|1||259|..."`. */
function formatSets(sets: readonly ReadonlySet<number>[]): string {
  return sets.map((set) => [...set].sort().join('')).join('|');
}

function parseSets(text: unknown): Set<number>[] | null {
  if (typeof text !== 'string') return null;
  const groups = text.split('|');
  if (groups.length !== CELLS) return null;
  const sets: Set<number>[] = [];
  for (const group of groups) {
    if (!/^[1-9]*$/.test(group)) return null;
    sets.push(new Set([...group].map(Number)));
  }
  return sets;
}

function parseIndices(text: unknown): Set<number> | null {
  if (typeof text !== 'string') return null;
  if (text === '') return new Set();
  const indices = new Set<number>();
  for (const part of text.split(',')) {
    const index = Number(part);
    if (!Number.isInteger(index) || index < 0 || index >= CELLS) return null;
    indices.add(index);
  }
  return indices;
}

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && value in DIFFICULTIES;
}

export function serializeProgress(progress: Progress, savedAt = Date.now()): string {
  return JSON.stringify({
    v: VERSION,
    saved: savedAt,
    board: formatBoard(progress.board),
    candidates: formatSets(progress.candidates),
    removed: formatSets(progress.removedCandidates),
    autofilled: [...progress.autofilled].join(','),
    elapsed: progress.elapsed,
    difficulty: progress.difficulty,
    won: progress.won,
  });
}

/**
 * Restore progress saved for `puzzle`. Returns null unless the record is
 * intact and still belongs to this puzzle — every given must be untouched,
 * so a stale or hand-edited record is discarded instead of corrupting a game.
 */
export function deserializeProgress(
  text: string,
  puzzle: Board
): Progress | null {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || data.v !== VERSION) return null;

  const board = typeof data.board === 'string' ? parseBoard(data.board) : null;
  if (!board) return null;
  for (let i = 0; i < CELLS; i++) {
    if (puzzle[i] !== EMPTY && board[i] !== puzzle[i]) return null;
  }

  const candidates = parseSets(data.candidates);
  const removedCandidates = parseSets(data.removed);
  const autofilled = parseIndices(data.autofilled);
  if (!candidates || !removedCandidates || !autofilled) return null;

  const elapsed = data.elapsed;
  return {
    board,
    candidates,
    removedCandidates,
    autofilled,
    elapsed:
      typeof elapsed === 'number' && Number.isFinite(elapsed) && elapsed >= 0
        ? Math.floor(elapsed)
        : 0,
    difficulty: isDifficulty(data.difficulty) ? data.difficulty : 'medium',
    won: data.won === true,
  };
}

/** The store, or null where it is unavailable (e.g. blocked cookies). */
function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Our own keys, in whatever order the store lists them. */
function savedKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(KEY_PREFIX)) keys.push(key);
  }
  return keys;
}

/**
 * Drop the least recently saved records until at most `keep` remain. Saves
 * happen every second while the clock runs, so the common case — nothing to
 * drop — costs a scan of the key names, and records are only read and parsed
 * when the store has actually outgrown its cap.
 */
function prune(storage: Storage, keep: number): void {
  const keys = savedKeys(storage);
  if (keys.length <= keep) return;
  const dated = keys.map((key) => {
    let saved = 0;
    try {
      saved = Number(JSON.parse(storage.getItem(key) ?? '{}').saved) || 0;
    } catch {
      // An unparseable record sorts oldest, so it is the first to go.
    }
    return { key, saved };
  });
  dated.sort((a, b) => a.saved - b.saved);
  for (const { key } of dated.slice(0, dated.length - keep)) {
    storage.removeItem(key);
  }
}

export function saveProgress(puzzle: Board, progress: Progress): void {
  const storage = store();
  if (!storage) return;
  const key = KEY_PREFIX + formatBoard(puzzle);
  const text = serializeProgress(progress);
  try {
    storage.setItem(key, text);
  } catch {
    // Most likely out of quota: make room and try once more. Puzzles this
    // player has not touched in a long time are the ones to lose.
    try {
      prune(storage, Math.floor(MAX_PUZZLES / 2));
      storage.setItem(key, text);
    } catch {
      // Still unwritable: the game plays on unsaved.
    }
    return;
  }
  try {
    prune(storage, MAX_PUZZLES);
  } catch {
    // Pruning is housekeeping; failing at it must not disturb the game.
  }
}

export function loadProgress(puzzle: Board): Progress | null {
  let text: string | null = null;
  try {
    text = store()?.getItem(KEY_PREFIX + formatBoard(puzzle)) ?? null;
  } catch {
    return null;
  }
  return text === null ? null : deserializeProgress(text, puzzle);
}
