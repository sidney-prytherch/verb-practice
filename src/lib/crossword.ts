/**
 * Crossword generator with 180° rotational symmetry.
 *
 * The black/white pattern of the grid is symmetric: cell (r, c) is white
 * if and only if cell (N-1-r, N-1-c) is white. Every word placed is paired
 * with a *different* word of the same length at the rotated position
 * (except words on the centre line that map onto themselves).
 *
 * Usage:
 *   const result = generateCrossword(entries, 15);
 *   printCrossword(result);
 */

// ---------- types ----------
export type Languages = "en" | "pt-br" | "pt-pt";

export interface WordEntry {
  word: string;
  hint: string;
  extraDataIndex?: number;
  languageOrigin: Languages;
  hintLanguageOrigin: Languages;
  partOfSpeech?: string;
  verbTense?: string;
  wordCount: number;
  letterCount: number[];
}

/** Every WordEntry field is carried through, plus the placement data. */
export interface PlacedWord extends WordEntry {
  number: number;
  dir: "across" | "down";
  row: number;
  col: number;
  /** the uppercase, letters-only form of `word` that actually sits in the grid */
  answer: string;
}

export interface CrosswordResult {
  /** N×N grid of letters; null = black square */
  grid: (string | null)[][];
  /** clue numbers (0 = no number) */
  numbers: number[][];
  /** every entry in the grid, with its hint */
  words: PlacedWord[];
  size: number;
}

export interface CrosswordOptions {
  /** how long to keep trying for a better grid (default 3000) */
  timeLimitMs?: number;
  /** RNG seed for reproducible output */
  seed?: number;
  /**
   * How hard to aim for as many down words as across words (default 5).
   * Each word of difference costs this many letters when grids are compared,
   * and placement also favours the direction that is behind. 0 = only density.
   */
  balance?: number;
}

const DEFAULT_BALANCE = 5;

/** Number of across and down words (runs of 2+ letters) in a grid. */
function countWords(grid: Grid): { across: number; down: number } {
  const N = grid.length;
  let across = 0;
  let down = 0;
  for (let i = 0; i < N; i++) {
    let runA = 0;
    let runD = 0;
    for (let j = 0; j <= N; j++) {
      if (j < N && grid[i][j]) runA++;
      else {
        if (runA >= 2) across++;
        runA = 0;
      }
      if (j < N && grid[j][i]) runD++;
      else {
        if (runD >= 2) down++;
        runD = 0;
      }
    }
  }
  return { across, down };
}

/** Grid quality: letters filled, minus a penalty for uneven across/down counts. */
function gridScore(grid: Grid, balance: number): number {
  const letters = grid.flat().filter(Boolean).length;
  const { across, down } = countWords(grid);
  return letters - balance * Math.abs(across - down);
}

type Grid = (string | null)[][];
type Dir = 0 | 1; // 0 = across, 1 = down

interface Placement {
  word: string;
  row: number;
  col: number;
  dir: Dir;
}

interface State {
  grid: Grid;
  used: Set<string>;
  placed: Placement[];
}

// ---------- seeded RNG ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const DIRS: Record<Dir, { dr: number; dc: number }> = {
  0: { dr: 0, dc: 1 },
  1: { dr: 1, dc: 0 },
};

/**
 * The form of a phrase that sits in the grid: uppercase letters only.
 * Accented letters (Á, Ç, Õ, ...) are kept; spaces, hyphens and other
 * punctuation are dropped (they are shown as word breaks instead).
 */
export function toAnswer(word: string): string {
  return String(word).normalize("NFC").toLocaleUpperCase("pt-BR").replace(/[^\p{L}]/gu, "");
}

/**
 * Normalise entries: see toAnswer, fits the grid, unique.
 * Maps the normalised answer to its entry. First entry wins on duplicates.
 */
function normalizeEntries(entries: WordEntry[], maxLen: number): Map<string, WordEntry> {
  const map = new Map<string, WordEntry>();
  for (const e of entries) {
    const answer = toAnswer(e.word);
    if (answer.length < 2 || answer.length > maxLen || map.has(answer)) continue;
    map.set(answer, e);
  }
  return map;
}

// ---------- main entry point ----------
export function generateCrossword(
  entries: WordEntry[],
  size: number,
  opts: CrosswordOptions = {}
): CrosswordResult {
  const N = size;
  const timeLimitMs = opts.timeLimitMs ?? 3000;
  const balance = opts.balance ?? DEFAULT_BALANCE;
  const rnd = mulberry32(opts.seed ?? Math.floor(Math.random() * 2 ** 32));

  const entryByAnswer = normalizeEntries(entries, N);
  const pool = [...entryByAnswer.keys()];
  if (pool.length === 0) throw new Error("No usable words in pool.");

  const byLen = new Map<number, string[]>();
  for (const word of pool) {
    const list = byLen.get(word.length) ?? [];
    list.push(word);
    byLen.set(word.length, list);
  }

  const inB = (r: number, c: number): boolean =>
    r >= 0 && c >= 0 && r < N && c < N;

  /** Returns number of crossings, or -1 if the word cannot go here. */
  function canPlace(grid: Grid, word: string, r: number, c: number, d: Dir): number {
    const { dr, dc } = DIRS[d];
    const L = word.length;
    const er = r + dr * (L - 1);
    const ec = c + dc * (L - 1);
    if (!inB(r, c) || !inB(er, ec)) return -1;

    // cells directly before and after must be empty
    if (inB(r - dr, c - dc) && grid[r - dr][c - dc]) return -1;
    if (inB(er + dr, ec + dc) && grid[er + dr][ec + dc]) return -1;

    let crossings = 0;
    for (let i = 0; i < L; i++) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      const cur = grid[rr][cc];
      if (cur) {
        if (cur !== word[i]) return -1;
        // must be a true crossing, not overlap with a same-direction word
        if (inB(rr - dr, cc - dc) && grid[rr - dr][cc - dc]) return -1;
        if (inB(rr + dr, cc + dc) && grid[rr + dr][cc + dc]) return -1;
        crossings++;
      } else {
        // new letter: perpendicular neighbours must be empty
        if (inB(rr - dc, cc - dr) && grid[rr - dc][cc - dr]) return -1;
        if (inB(rr + dc, cc + dr) && grid[rr + dc][cc + dr]) return -1;
      }
    }
    return crossings;
  }

  function write(grid: Grid, word: string, r: number, c: number, d: Dir): [number, number][] {
    const { dr, dc } = DIRS[d];
    const written: [number, number][] = [];
    for (let i = 0; i < word.length; i++) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      if (!grid[rr][cc]) {
        grid[rr][cc] = word[i];
        written.push([rr, cc]);
      }
    }
    return written;
  }

  /** 180° rotation of a placement */
  function rotated(word: string, r: number, c: number, d: Dir) {
    const { dr, dc } = DIRS[d];
    const er = r + dr * (word.length - 1);
    const ec = c + dc * (word.length - 1);
    return { r: N - 1 - er, c: N - 1 - ec, d };
  }

  /** Place `word` plus its rotational partner. Mutates state on success. */
  function trySymmetric(
    state: State,
    word: string,
    r: number,
    c: number,
    d: Dir,
    requireCross: boolean
  ): boolean {
    const { grid, used, placed } = state;
    const x = canPlace(grid, word, r, c, d);
    if (x < 0 || (requireCross && x < 1)) return false;

    const rot = rotated(word, r, c, d);

    // Self-symmetric word (on the centre line, centred on the centre)
    if (rot.r === r && rot.c === c) {
      write(grid, word, r, c, d);
      used.add(word);
      placed.push({ word, row: r, col: c, dir: d });
      return true;
    }

    // Temporarily write A, then look for a partner B at the rotated spot
    const written = write(grid, word, r, c, d);
    used.add(word);

    const partners = shuffle(
      (byLen.get(word.length) ?? []).filter((p) => !used.has(p)),
      rnd
    );
    for (const p of partners) {
      if (canPlace(grid, p, rot.r, rot.c, rot.d) >= 0) {
        write(grid, p, rot.r, rot.c, rot.d);
        used.add(p);
        placed.push({ word, row: r, col: c, dir: d });
        placed.push({ word: p, row: rot.r, col: rot.c, dir: rot.d });
        return true;
      }
    }

    // undo
    for (const [rr, cc] of written) grid[rr][cc] = null;
    used.delete(word);
    return false;
  }

  function attempt(): State {
    const state: State = {
      grid: Array.from({ length: N }, () => Array<string | null>(N).fill(null)),
      used: new Set<string>(),
      placed: [],
    };

    // first word: prefer a long one
    const long = pool.filter((x) => x.length >= Math.ceil(N / 2));
    const starters = shuffle([...(long.length ? long : pool)], rnd);
    let started = false;
    for (const word of starters) {
      for (let t = 0; t < 40 && !started; t++) {
        const d: Dir = rnd() < 0.5 ? 0 : 1;
        const r = Math.floor(rnd() * N);
        const c = Math.floor(rnd() * N);
        if (trySymmetric(state, word, r, c, d, false)) started = true;
      }
      if (started) break;
    }
    if (!started) return state;

    // grow: repeatedly place any word that crosses existing letters
    for (;;) {
      const cands: [string, number, number, Dir][] = [];
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const ch = state.grid[r][c];
          if (!ch) continue;
          for (const word of pool) {
            if (state.used.has(word)) continue;
            for (let i = 0; i < word.length; i++) {
              if (word[i] !== ch) continue;
              cands.push([word, r, c - i, 0]);
              cands.push([word, r - i, c, 1]);
            }
          }
        }
      }
      shuffle(cands, rnd);
      // try the direction with fewer words first (pairs keep their direction,
      // so this is what keeps across and down even)
      if (balance > 0) {
        const { across, down } = countWords(state.grid);
        if (across !== down) {
          const behind: Dir = across > down ? 1 : 0;
          cands.sort((x, y) => (x[3] === behind ? 0 : 1) - (y[3] === behind ? 0 : 1));
        }
      }
      let progressed = false;
      for (const [word, r, c, d] of cands) {
        if (state.used.has(word)) continue;
        if (trySymmetric(state, word, r, c, d, true)) {
          progressed = true;
          break;
        }
      }
      if (!progressed) break;
    }
    return state;
  }

  // repeat random attempts
  // keep the best grid: most letters, with across and down words roughly even
  const score = (s: State): number => gridScore(s.grid, balance);
  let best: State | null = null;
  let bestScore = -1;
  const start = Date.now();
  do {
    const s = attempt();
    const sc = score(s);
    if (sc > bestScore) {
      best = s;
      bestScore = sc;
    }
  } while (Date.now() - start < timeLimitMs);

  return finalise((best as State).grid, N, entryByAnswer);
}

// ---------- dense variant (no symmetry) ----------
/**
 * Like generateCrossword, but ignores rotational symmetry and tries to pack
 * the grid as densely as possible.
 *
 * Unlike the symmetric version, words may sit directly next to each other
 * as long as every extra run of letters they create is itself a valid,
 * unused word from the pool. Placements are chosen greedily by how many
 * extra words and letters they add (plus crossings, and keeping across and down
 * counts even), with some randomness, over repeated attempts; the grid with the
 * most letters wins, with a penalty for uneven across/down counts.
 */
export function generateDenseCrossword(
  entries: WordEntry[],
  size: number,
  opts: CrosswordOptions = {}
): CrosswordResult {
  const N = size;
  const timeLimitMs = opts.timeLimitMs ?? 3000;
  const balance = opts.balance ?? DEFAULT_BALANCE;
  const rnd = mulberry32(opts.seed ?? Math.floor(Math.random() * 2 ** 32));
  const MAX_CANDIDATES = 4000;

  const entryByAnswer = normalizeEntries(entries, N);
  const pool = [...entryByAnswer.keys()];
  if (pool.length === 0) throw new Error("No usable words in pool.");

  const inB = (r: number, c: number): boolean =>
    r >= 0 && c >= 0 && r < N && c < N;

  interface Fit {
    crossings: number;
    /** extra words formed perpendicular to the placed word */
    newWords: string[];
  }

  /** Can `word` go here? Returns crossings and any extra words it forms. */
  function fit(grid: Grid, used: Set<string>, word: string, r: number, c: number, d: Dir): Fit | null {
    const { dr, dc } = DIRS[d];
    const L = word.length;
    const er = r + dr * (L - 1);
    const ec = c + dc * (L - 1);
    if (!inB(r, c) || !inB(er, ec)) return null;

    // the word's own run must be exactly the word
    if (inB(r - dr, c - dc) && grid[r - dr][c - dc]) return null;
    if (inB(er + dr, ec + dc) && grid[er + dr][ec + dc]) return null;

    let crossings = 0;
    const newWords: string[] = [];
    const pr = dc; // perpendicular step
    const pc = dr;

    for (let i = 0; i < L; i++) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      const cur = grid[rr][cc];

      if (cur) {
        if (cur !== word[i]) return null;
        // genuine crossing only: no overlap with a same-direction word
        if (inB(rr - dr, cc - dc) && grid[rr - dr][cc - dc]) return null;
        if (inB(rr + dr, cc + dc) && grid[rr + dr][cc + dc]) return null;
        crossings++;
        continue;
      }

      // new letter: count filled cells on each perpendicular side
      let a = 0;
      while (inB(rr - pr * (a + 1), cc - pc * (a + 1)) && grid[rr - pr * (a + 1)][cc - pc * (a + 1)]) a++;
      let b = 0;
      while (inB(rr + pr * (b + 1), cc + pc * (b + 1)) && grid[rr + pr * (b + 1)][cc + pc * (b + 1)]) b++;

      // 2+ filled cells means an existing word that we would extend or join
      if (a >= 2 || b >= 2) return null;

      if (a + b > 0) {
        // touching single letters: together they form a new perpendicular word
        let run = "";
        if (a === 1) run += grid[rr - pr][cc - pc];
        run += word[i];
        if (b === 1) run += grid[rr + pr][cc + pc];
        if (!entryByAnswer.has(run) || used.has(run) || run === word || newWords.includes(run)) {
          return null;
        }
        newWords.push(run);
      }
    }
    return { crossings, newWords };
  }

  function put(grid: Grid, word: string, r: number, c: number, d: Dir): void {
    const { dr, dc } = DIRS[d];
    for (let i = 0; i < word.length; i++) grid[r + dr * i][c + dc * i] = word[i];
  }

  function attempt(): State {
    const state: State = {
      grid: Array.from({ length: N }, () => Array<string | null>(N).fill(null)),
      used: new Set<string>(),
      placed: [],
    };
    const { grid, used } = state;

    // first word: one of the longest, near the centre
    const longest = [...pool].sort((x, y) => y.length - x.length).slice(0, 5);
    const first = longest[Math.floor(rnd() * longest.length)];
    const d0: Dir = rnd() < 0.5 ? 0 : 1;
    const mid = Math.floor(N / 2);
    const off = Math.floor((N - first.length) / 2);
    const r0 = d0 === 0 ? mid : off;
    const c0 = d0 === 0 ? off : mid;
    if (!fit(grid, used, first, r0, c0, d0)) return state;
    put(grid, first, r0, c0, d0);
    used.add(first);
    state.placed.push({ word: first, row: r0, col: c0, dir: d0 });
    const count = { across: d0 === 0 ? 1 : 0, down: d0 === 1 ? 1 : 0 };

    for (;;) {
      // candidate placements that cross at least one existing letter
      const seen = new Set<string>();
      let cands: [string, number, number, Dir][] = [];
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const ch = grid[r][c];
          if (!ch) continue;
          for (const word of pool) {
            if (used.has(word)) continue;
            for (let i = 0; i < word.length; i++) {
              if (word[i] !== ch) continue;
              const ka = `${word}|${r}|${c - i}|0`;
              if (!seen.has(ka)) {
                seen.add(ka);
                cands.push([word, r, c - i, 0]);
              }
              const kd = `${word}|${r - i}|${c}|1`;
              if (!seen.has(kd)) {
                seen.add(kd);
                cands.push([word, r - i, c, 1]);
              }
            }
          }
        }
      }
      if (cands.length > MAX_CANDIDATES) {
        cands = shuffle(cands, rnd).slice(0, MAX_CANDIDATES);
      }

      // pick the best-scoring valid candidate (with a little noise)
      let bestScore = -Infinity;
      let best: { word: string; r: number; c: number; d: Dir; f: Fit } | null = null;
      for (const [word, r, c, d] of cands) {
        const f = fit(grid, used, word, r, c, d);
        if (!f || f.crossings < 1) continue;
        // reward placements that bring across and down closer together
        // (extra words formed run the other way)
        const a = count.across + (d === 0 ? 1 : f.newWords.length);
        const dn = count.down + (d === 1 ? 1 : f.newWords.length);
        const evenness = Math.abs(count.across - count.down) - Math.abs(a - dn);
        const score =
          f.crossings + 6 * f.newWords.length + word.length + balance * evenness + rnd() * 2;
        if (score > bestScore) {
          bestScore = score;
          best = { word, r, c, d, f };
        }
      }
      if (!best) break;

      put(grid, best.word, best.r, best.c, best.d);
      used.add(best.word);
      for (const nw of best.f.newWords) used.add(nw);
      state.placed.push({ word: best.word, row: best.r, col: best.c, dir: best.d });
      if (best.d === 0) {
        count.across++;
        count.down += best.f.newWords.length;
      } else {
        count.down++;
        count.across += best.f.newWords.length;
      }
    }
    return state;
  }

  // keep the best grid: most letters, with across and down words roughly even
  const score = (s: State): number => gridScore(s.grid, balance);
  let best: State | null = null;
  let bestScore = -1;
  const start = Date.now();
  do {
    const s = attempt();
    const sc = score(s);
    if (sc > bestScore) {
      best = s;
      bestScore = sc;
    }
  } while (Date.now() - start < timeLimitMs);

  return finalise((best as State).grid, N, entryByAnswer);
}

// ---------- numbering & output ----------
function finalise(
  grid: Grid,
  N: number,
  entryByAnswer: Map<string, WordEntry>
): CrosswordResult {
  const white = (r: number, c: number): boolean =>
    r >= 0 && c >= 0 && r < N && c < N && !!grid[r][c];

  const words: PlacedWord[] = [];
  const numbers: number[][] = Array.from({ length: N }, () => Array<number>(N).fill(0));
  let n = 0;

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!white(r, c)) continue;
      const across = !white(r, c - 1) && white(r, c + 1);
      const down = !white(r - 1, c) && white(r + 1, c);
      if (!across && !down) continue;
      n++;
      numbers[r][c] = n;
      if (across) {
        let answer = "";
        for (let cc = c; white(r, cc); cc++) answer += grid[r][cc];
        words.push({ ...entryByAnswer.get(answer)!, number: n, dir: "across", row: r, col: c, answer });
      }
      if (down) {
        let answer = "";
        for (let rr = r; white(rr, c); rr++) answer += grid[rr][c];
        words.push({ ...entryByAnswer.get(answer)!, number: n, dir: "down", row: r, col: c, answer });
      }
    }
  }
  return { grid, numbers, words, size: N };
}

/** Sanity check: is the white/black pattern 180° symmetric? */
export function isSymmetric(result: CrosswordResult): boolean {
  const { grid, size: N } = result;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (!!grid[r][c] !== !!grid[N - 1 - r][N - 1 - c]) return false;
  return true;
}

/** Grid as plain text: letters and '#', no spaces or bars. */
export function gridToString(result: CrosswordResult): string {
  return result.grid.map((row) => row.map((ch) => ch ?? "#").join("")).join("\n");
}

/** Prints the grid plus numbered across/down clues with their hints. */
export function printCrossword(result: CrosswordResult): void {
  console.log(gridToString(result));
  for (const dir of ["across", "down"] as const) {
    console.log(`\n${dir[0].toUpperCase() + dir.slice(1)}:`);
    for (const w of result.words.filter((x) => x.dir === dir)) {
      console.log(` ${w.number}. ${w.hint}  (${(w.letterCount.length ? w.letterCount : [w.answer.length]).join(",")}) [${w.answer}]`);
    }
  }
}
