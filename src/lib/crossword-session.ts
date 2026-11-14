/**
 * Keeps the current crossword while you visit other pages (Settings,
 * Dictionary). Lives in memory only, so a reload starts fresh.
 */

import type { CrosswordResult } from "./crossword";

export type Mark = "" | "ok" | "bad";

export const session: {
  puzzle: CrosswordResult | null;
  guesses: string[][];
  marks: Mark[][];
  active: { r: number; c: number } | null;
  dir: "across" | "down";
  showAllClues: boolean;
} = {
  puzzle: null,
  guesses: [],
  marks: [],
  active: null,
  dir: "across",
  showAllClues: false,
};
