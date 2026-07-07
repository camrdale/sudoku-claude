import { defineConfig } from 'vite';

// Built assets are served from https://camrdale.github.io/sudoku-claude/,
// so production builds need the repo name as their base path. The dev
// server stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/sudoku-claude/' : '/',
}));
