<script lang="ts">
  import type { Tense, Aspect } from '#lib/conjugator.ts';
  import { generateCrossword, type CrosswordResult, type PlacedWord } from '#lib/crossword.ts';
  import { buildCrosswordEntries, languagePairs } from '#lib/crossword-clues.ts';
  import { settings } from '#lib/settings.svelte.ts';
  import { resolve } from '$app/paths';
  import { VERBS, LANGUAGE_TAGS, type Language } from '#lib/verbs.ts';

  const tenses: Tense[] = ['past', 'present', 'future'];
  const aspects: Aspect[] = ['simple', 'continuous', 'perfect', 'perfectContinuous'];

  /* ---------------- crossword options ---------------- */
  const aspectLabels: Record<Aspect, string> = {
    simple: 'simple',
    continuous: 'continuous',
    perfect: 'perfect',
    perfectContinuous: 'perfect continuous'
  };

  let size = $state(13);
  let pickedTenses = $state<Tense[]>(['past', 'present', 'future']);
  let pickedAspects = $state<Aspect[]>(['simple', 'continuous']);
  let lenientAccents = $state(false);

  /* settings from the Settings and Dictionary pages */
  let enabledVerbs = $derived.by(() => {
    const off = new Set(settings.disabledVerbs);
    return VERBS.filter((v) => !off.has(v.id));
  });
  let setupProblem = $derived(
    languagePairs(settings.languages).length === 0
      ? 'Choose at least two languages in Settings.'
      : settings.subjects.length === 0
        ? 'Choose at least one subject in Settings.'
        : enabledVerbs.length === 0
          ? 'Turn on at least one verb in the Dictionary.'
          : ''
  );

  /* ---------------- crossword state ---------------- */
  type Dir = 'across' | 'down';
  type Mark = '' | 'ok' | 'bad';

  let puzzle = $state<CrosswordResult | null>(null);
  let guesses = $state<string[][]>([]);
  let marks = $state<Mark[][]>([]);
  let active = $state<{ r: number; c: number } | null>(null);
  let dir = $state<Dir>('across');
  let generating = $state(false);
  let message = $state('');
  let gridEl: HTMLDivElement | undefined = $state();
  /** options panel: open until the first puzzle is made */
  let optionsOpen = $state(true);
  /** phones show one clue at a time; this reveals the full list */
  let showAllClues = $state(false);

  const key = (r: number, c: number) => `${r},${c}`;

  /** For every cell: index of the across/down word through it. */
  let wordAt = $derived.by(() => {
    const across = new Map<string, number>();
    const down = new Map<string, number>();
    puzzle?.words.forEach((w, i) => {
      for (let k = 0; k < w.answer.length; k++) {
        if (w.dir === 'across') across.set(key(w.row, w.col + k), i);
        else down.set(key(w.row + k, w.col), i);
      }
    });
    return { across, down };
  });

  /** Word breaks inside phrases: thick bar for a space, dash for a hyphen. */
  let breaks = $derived.by(() => {
    const right = new Map<string, ' ' | '-'>();
    const bottom = new Map<string, ' ' | '-'>();
    for (const w of puzzle?.words ?? []) {
      for (const { after, kind } of separators(w.word)) {
        if (w.dir === 'across') right.set(key(w.row, w.col + after), kind);
        else bottom.set(key(w.row + after, w.col), kind);
      }
    }
    return { right, bottom };
  });

  let activeWordIndex = $derived(active ? wordAt[dir].get(key(active.r, active.c)) : undefined);
  let activeWord = $derived(activeWordIndex === undefined ? null : puzzle?.words[activeWordIndex] ?? null);

  let highlighted = $derived.by(() => {
    const set = new Set<string>();
    if (activeWord) for (const [r, c] of cellsOf(activeWord)) set.add(key(r, c));
    return set;
  });

  /* ---------------- helpers ---------------- */
  function separators(phrase: string): { after: number; kind: ' ' | '-' }[] {
    const out: { after: number; kind: ' ' | '-' }[] = [];
    let letters = 0;
    let pending: ' ' | '-' | null = null;
    for (const ch of phrase.normalize('NFC')) {
      if (/\p{L}/u.test(ch)) {
        if (pending && letters > 0) out.push({ after: letters - 1, kind: pending });
        pending = null;
        letters++;
      } else if (ch === '-') pending = '-';
      else if (!pending) pending = ' ';
    }
    return out;
  }

  /** "(3,5)" for a space, "(6-2)" for a hyphen. */
  function enumeration(phrase: string): string {
    const parts = phrase.normalize('NFC').match(/\p{L}+|-/gu) ?? [];
    let out = '';
    let prevWasWord = false;
    for (const p of parts) {
      if (p === '-') {
        out += '-';
        prevWasWord = false;
      } else {
        if (prevWasWord) out += ',';
        out += p.length;
        prevWasWord = true;
      }
    }
    return `(${out})`;
  }

  function cellsOf(w: PlacedWord): [number, number][] {
    return Array.from({ length: w.answer.length }, (_, k) =>
      w.dir === 'across' ? [w.row, w.col + k] : [w.row + k, w.col]
    );
  }

  const isWhite = (r: number, c: number) =>
    !!puzzle && r >= 0 && c >= 0 && r < puzzle.size && c < puzzle.size && !!puzzle.grid[r][c];

  const stripAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

  function focusCell(r: number, c: number) {
    active = { r, c };
    gridEl?.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`)?.focus();
  }

  /** Move one step along the current direction (or backwards). */
  function step(r: number, c: number, delta: 1 | -1) {
    const nr = dir === 'down' ? r + delta : r;
    const nc = dir === 'across' ? c + delta : c;
    if (isWhite(nr, nc)) focusCell(nr, nc);
  }

  /* ---------------- actions ---------------- */
  function create() {
    if (generating) return;
    const chosen = pickedTenses.flatMap((t) => pickedAspects.map((a) => [t, a] as [Tense, Aspect]));
    if (chosen.length === 0) {
      message = 'Pick at least one tense and one aspect.';
      return;
    }
    generating = true;
    message = '';
    // let the "Generating…" state paint before the generator blocks the thread
    setTimeout(() => {
      try {
        const entries = buildCrosswordEntries({
          languages: settings.languages,
          subjects: settings.subjects,
          verbs: enabledVerbs,
          pairs: chosen,
          maxLength: size,
          count: 800
        });
        const p = generateCrossword(entries, size, { timeLimitMs: 1500 });
        if (p.words.length === 0) {
          message = "Couldn't fit any words — try again or pick a bigger grid.";
          puzzle = null;
        } else {
          puzzle = p;
          optionsOpen = false;
          showAllClues = false;
          guesses = p.grid.map((row) => row.map(() => ''));
          marks = p.grid.map((row) => row.map(() => '' as Mark));
          const first = p.words[0];
          dir = first.dir;
          active = { r: first.row, c: first.col };
        }
      } catch (e) {
        message = e instanceof Error ? e.message : String(e);
      } finally {
        generating = false;
      }
    }, 20);
  }

  function setLetter(r: number, c: number, ch: string) {
    guesses[r][c] = ch.normalize('NFC').toLocaleUpperCase('pt-BR');
    marks[r][c] = '';
  }

  function check() {
    if (!puzzle) return;
    let filled = 0;
    let right = 0;
    let total = 0;
    for (let r = 0; r < puzzle.size; r++)
      for (let c = 0; c < puzzle.size; c++) {
        const answer = puzzle.grid[r][c];
        if (!answer) continue;
        total++;
        const g = guesses[r][c];
        if (!g) {
          marks[r][c] = '';
          continue;
        }
        filled++;
        const ok = lenientAccents ? stripAccents(g) === stripAccents(answer) : g === answer;
        marks[r][c] = ok ? 'ok' : 'bad';
        if (ok) right++;
      }
    message =
      right === total
        ? 'Solved! 🎉'
        : `${right} of ${total} letters right${filled < total ? `, ${total - filled} empty` : ''}.`;
  }

  function reveal(onlyActive: boolean) {
    if (!puzzle) return;
    const cells = onlyActive && activeWord ? cellsOf(activeWord) : null;
    for (let r = 0; r < puzzle.size; r++)
      for (let c = 0; c < puzzle.size; c++) {
        const answer = puzzle.grid[r][c];
        if (!answer) continue;
        if (cells && !cells.some(([rr, cc]) => rr === r && cc === c)) continue;
        guesses[r][c] = answer;
        marks[r][c] = '';
      }
  }

  function clearGrid() {
    if (!puzzle) return;
    guesses = puzzle.grid.map((row) => row.map(() => ''));
    marks = puzzle.grid.map((row) => row.map(() => '' as Mark));
    message = '';
  }

  /* ---------------- cell events ---------------- */
  function onFocus(r: number, c: number) {
    active = { r, c };
    // switch direction if there is no word this way
    if (!wordAt[dir].has(key(r, c))) dir = dir === 'across' ? 'down' : 'across';
  }

  function onClick(r: number, c: number) {
    if (active && active.r === r && active.c === c) {
      const other: Dir = dir === 'across' ? 'down' : 'across';
      if (wordAt[other].has(key(r, c))) dir = other;
    }
  }

  function onInput(e: Event, r: number, c: number) {
    const ie = e as InputEvent;
    const el = e.currentTarget as HTMLInputElement;
    if (ie.isComposing) return; // dead keys (´ + a): wait for compositionend
    handleTyped(el, r, c);
  }

  function handleTyped(el: HTMLInputElement, r: number, c: number) {
    const letters = el.value.normalize('NFC').match(/\p{L}/gu);
    if (!letters) {
      setLetter(r, c, '');
      el.value = '';
      return;
    }
    setLetter(r, c, letters[letters.length - 1]);
    el.value = guesses[r][c];
    step(r, c, 1);
  }

  function onKeydown(e: KeyboardEvent, r: number, c: number) {
    const moves: Record<string, [number, number, Dir]> = {
      ArrowRight: [0, 1, 'across'],
      ArrowLeft: [0, -1, 'across'],
      ArrowDown: [1, 0, 'down'],
      ArrowUp: [-1, 0, 'down']
    };
    if (e.key in moves) {
      e.preventDefault();
      const [dr, dc, d] = moves[e.key];
      if (dir !== d && wordAt[d].has(key(r, c))) {
        dir = d;
        return;
      }
      if (isWhite(r + dr, c + dc)) focusCell(r + dr, c + dc);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      if (guesses[r][c]) setLetter(r, c, '');
      else {
        const pr = dir === 'down' ? r - 1 : r;
        const pc = dir === 'across' ? c - 1 : c;
        if (isWhite(pr, pc)) {
          setLetter(pr, pc, '');
          focusCell(pr, pc);
        }
      }
    } else if (e.key === ' ') {
      e.preventDefault();
      onClick(r, c);
    }
  }

  /** On-screen buttons for letters that are awkward to type. */
  const accents = ['Á', 'À', 'Â', 'Ã', 'Ç', 'É', 'Ê', 'Í', 'Ó', 'Ô', 'Õ', 'Ú'];
  function typeAccent(ch: string) {
    if (!active) return;
    const { r, c } = active;
    setLetter(r, c, ch);
    step(r, c, 1);
    if (active.r === r && active.c === c) focusCell(r, c);
  }

  function selectClue(w: PlacedWord) {
    dir = w.dir;
    focusCell(w.row, w.col);
  }

  /** Previous / next clue, across first then down, wrapping round. */
  function moveClue(delta: 1 | -1) {
    const ordered = [...acrossClues, ...downClues];
    if (ordered.length === 0) return;
    const i = activeWord ? ordered.indexOf(activeWord) : delta === 1 ? -1 : 0;
    selectClue(ordered[(i + delta + ordered.length) % ordered.length]);
  }

  /** Tap on the clue bar: switch between across and down at the current square. */
  function switchDirection() {
    if (!active) {
      moveClue(1);
      return;
    }
    const other: Dir = dir === 'across' ? 'down' : 'across';
    if (wordAt[other].has(key(active.r, active.c))) dir = other;
    focusCell(active.r, active.c);
  }

  let acrossClues = $derived(puzzle?.words.filter((w) => w.dir === 'across') ?? []);
  let downClues = $derived(puzzle?.words.filter((w) => w.dir === 'down') ?? []);

  /** "EN → BR": language of the hint and of the answer. */
  function langTag(w: PlacedWord) {
    return `${LANGUAGE_TAGS[w.hintLanguageOrigin as Language]} → ${LANGUAGE_TAGS[w.languageOrigin as Language]}`;
  }

  function toggle<T>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  }
</script>

<main class:has-puzzle={!!puzzle}>
  <h1>Verb crossword</h1>
  <p class="lede">
    Each clue is a verb in one language — write its translation in the grid (the tag shows which
    way, e.g. EN → BR). A subject in
    brackets, like <em>(I) walked</em>, is left out of the answer: <em>andei</em>.
  </p>

  <div class="toolbar">
    <button class="primary" onclick={create} disabled={generating || !!setupProblem}>
      {generating ? 'Generating…' : puzzle ? 'New crossword' : 'Create'}
    </button>
    <button class="plain" aria-expanded={optionsOpen} onclick={() => (optionsOpen = !optionsOpen)}>
      Options {optionsOpen ? '▴' : '▾'}
    </button>
  </div>

  {#if optionsOpen}
  <section class="options">
    <label>
      Grid
      <select bind:value={size}>
        {#each [9, 11, 13, 15] as n}<option value={n}>{n}×{n}</option>{/each}
      </select>
    </label>
    <fieldset>
      <legend>Tenses</legend>
      {#each tenses as t}
        <label class="check">
          <input
            type="checkbox"
            checked={pickedTenses.includes(t)}
            onchange={() => (pickedTenses = toggle(pickedTenses, t))}
          />
          {t}
        </label>
      {/each}
    </fieldset>
    <fieldset>
      <legend>Aspects</legend>
      {#each aspects as a}
        <label class="check">
          <input
            type="checkbox"
            checked={pickedAspects.includes(a)}
            onchange={() => (pickedAspects = toggle(pickedAspects, a))}
          />
          {aspectLabels[a]}
        </label>
      {/each}
    </fieldset>
    <p class="summary">
      {settings.languages.map((l) => LANGUAGE_TAGS[l]).join(', ') || 'No languages'} ·
      {settings.subjects.length} subjects · {enabledVerbs.length} verbs —
      <a href={resolve('/settings')}>Settings</a>, <a href={resolve('/dictionary')}>Dictionary</a>
    </p>
  </section>
  {/if}

  {#if setupProblem}<p class="message warn">{setupProblem}</p>{/if}
  {#if message}<p class="message">{message}</p>{/if}

  {#if puzzle}
    <div class="board">
      <div class="left" style="--n: {puzzle.size}">
        <div class="cluebar">
          <button
            class="nav"
            aria-label="Previous clue"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => moveClue(-1)}>‹</button
          >
          <button
            class="cluetext"
            title="Switch across / down"
            onmousedown={(e) => e.preventDefault()}
            onclick={switchDirection}
          >
            {#if activeWord}
              <span class="cl-num">{activeWord.number}{activeWord.dir === 'across' ? 'A' : 'D'}</span>
              <span class="tag">{langTag(activeWord)}</span>
              <span class="cl-hint">{activeWord.hint} <span class="enum">{enumeration(activeWord.word)}</span></span>
            {:else}
              <span class="cl-hint">Tap a square to start</span>
            {/if}
          </button>
          <button
            class="nav"
            aria-label="Next clue"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => moveClue(1)}>›</button
          >
        </div>

        <div class="grid" bind:this={gridEl}>
          {#each puzzle.grid as row, r}
            {#each row as cell, c}
              {#if cell}
                {@const k = key(r, c)}
                <div
                  class="cell"
                  class:hl={highlighted.has(k)}
                  class:current={active?.r === r && active?.c === c}
                  class:ok={marks[r][c] === 'ok'}
                  class:bad={marks[r][c] === 'bad'}
                  class:bar-r={breaks.right.get(k) === ' '}
                  class:bar-b={breaks.bottom.get(k) === ' '}
                >
                  {#if puzzle.numbers[r][c]}<span class="num">{puzzle.numbers[r][c]}</span>{/if}
                  {#if breaks.right.get(k) === '-'}<span class="dash-r"></span>{/if}
                  {#if breaks.bottom.get(k) === '-'}<span class="dash-b"></span>{/if}
                  <input
                    data-cell="{r}-{c}"
                    value={guesses[r][c]}
                    autocomplete="off"
                    autocapitalize="characters"
                    autocorrect="off"
                    enterkeyhint="next"
                    spellcheck="false"
                    aria-label="row {r + 1} column {c + 1}"
                    onfocus={() => onFocus(r, c)}
                    onclick={() => onClick(r, c)}
                    oninput={(e) => onInput(e, r, c)}
                    oncompositionend={(e) => handleTyped(e.currentTarget, r, c)}
                    onkeydown={(e) => onKeydown(e, r, c)}
                  />
                </div>
              {:else}
                <div class="cell black"></div>
              {/if}
            {/each}
          {/each}
        </div>

        <div class="accents">
          {#each accents as a}
            <button onmousedown={(e) => e.preventDefault()} onclick={() => typeAccent(a)}>{a}</button>
          {/each}
        </div>

        <div class="actions">
          <button onclick={check}>Check</button>
          <button onclick={() => reveal(true)} disabled={!activeWord}>Reveal word</button>
          <button onclick={() => reveal(false)}>Reveal all</button>
          <button onclick={clearGrid}>Clear</button>
          <label class="check">
            <input type="checkbox" bind:checked={lenientAccents} />
            accept letters without accents
          </label>
        </div>

        <button class="plain all-clues-toggle" onclick={() => (showAllClues = !showAllClues)}>
          {showAllClues ? 'Hide clue list' : 'Show all clues'}
        </button>
      </div>

      <div class="clues" class:show={showAllClues}>
        {#each [{ title: 'Across', list: acrossClues }, { title: 'Down', list: downClues }] as { title, list }}
          <div>
            <h2>{title}</h2>
            <ol>
              {#each list as w}
                <li class:active={w === activeWord}>
                  <button onclick={() => selectClue(w)}>
                    <span class="n">{w.number}</span>
                    <span class="tag">{langTag(w)}</span>
                    <span>{w.hint} <span class="enum">{enumeration(w.word)}</span></span>
                  </button>
                </li>
              {/each}
            </ol>
          </div>
        {/each}
      </div>
    </div>
  {/if}

</main>

<style>
  main {
    --pad: 1.5rem;
    --ink: #1d1d1f;
    --line: #8a8a8e;
    --hl: #dbeafe;
    --current: #93c5fd;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: var(--ink);
    max-width: 72rem;
    margin: 0 auto;
    padding: var(--pad);
  }
  h1 {
    margin: 0 0 0.25rem;
  }
  .lede {
    margin: 0 0 1.25rem;
    color: #555;
  }

  .toolbar {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1rem;
  }
  .plain {
    border-color: transparent;
    background: none;
    color: #2563eb;
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .options > label {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    gap: 0.25rem;
  }
  fieldset {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 0.25rem 0.75rem 0.5rem;
    display: flex;
    gap: 0.75rem;
    font-size: 0.9rem;
  }
  legend {
    font-size: 0.8rem;
    color: #666;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.9rem;
  }
  button {
    font: inherit;
    padding: 0.4rem 0.8rem;
    border: 1px solid #c7c7cc;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .primary {
    background: #2563eb;
    border-color: #2563eb;
    color: #fff;
    font-weight: 600;
    padding: 0.5rem 1.4rem;
  }
  .message {
    font-weight: 600;
  }
  .warn {
    color: #b91c1c;
  }
  .summary {
    font-size: 0.85rem;
    color: #555;
    margin: -0.25rem 0 1rem;
  }
  .summary a {
    color: #2563eb;
  }

  /* the selected clue, above the grid */
  .cluebar {
    display: flex;
    align-items: stretch;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    background: var(--hl);
    border-radius: 8px;
    min-height: 3.2rem;
  }
  .cluebar .nav {
    flex: none;
    width: 2.6rem;
    border: 0;
    background: none;
    font-size: 1.6rem;
    line-height: 1;
    color: #1e3a8a;
    padding: 0;
  }
  .cluetext {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.2rem 0.4rem;
    border: 0;
    background: none;
    text-align: left;
    padding: 0.4rem 0.25rem;
    line-height: 1.3;
  }
  .cl-num {
    font-weight: 700;
  }
  .cl-hint {
    flex-basis: 100%;
  }
  .all-clues-toggle {
    display: none;
    margin-top: 0.5rem;
    padding-left: 0;
  }

  .board {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
    align-items: flex-start;
  }

  .left {
    /* squares shrink to fit narrow screens: width minus page padding, border and gaps */
    --cell: min(2.4rem, calc((100vw - 2 * var(--pad) - 4px - (var(--n) - 1) * 1px) / var(--n)));
    /* as wide as the grid; the clue bar and buttons wrap to fit */
    width: min-content;
    max-width: 100%;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(var(--n), var(--cell));
    border: 2px solid var(--ink);
    width: max-content;
    background: var(--ink);
    gap: 1px;
  }
  .cell {
    position: relative;
    width: var(--cell);
    height: var(--cell);
    background: #fff;
  }
  .cell.black {
    background: var(--ink);
  }
  .cell.hl {
    background: var(--hl);
  }
  .cell.current {
    background: var(--current);
  }
  .cell.ok input {
    color: #15803d;
  }
  .cell.bad {
    background: #fee2e2;
  }
  .cell.bad.current {
    background: #fca5a5;
  }
  /* word break inside a phrase */
  .cell.bar-r {
    box-shadow: inset -3px 0 0 var(--ink);
  }
  .cell.bar-b {
    box-shadow: inset 0 -3px 0 var(--ink);
  }
  .cell.bar-r.bar-b {
    box-shadow:
      inset -3px 0 0 var(--ink),
      inset 0 -3px 0 var(--ink);
  }
  .dash-r,
  .dash-b {
    position: absolute;
    background: var(--ink);
    z-index: 2;
    pointer-events: none;
  }
  .dash-r {
    right: -5px;
    top: 50%;
    width: 9px;
    height: 2px;
  }
  .dash-b {
    bottom: -5px;
    left: 50%;
    width: 2px;
    height: 9px;
  }
  .num {
    position: absolute;
    top: 1px;
    left: 2px;
    font-size: max(0.45rem, calc(var(--cell) * 0.26));
    line-height: 1;
    pointer-events: none;
  }
  .cell input {
    width: 100%;
    height: 100%;
    border: 0;
    padding: calc(var(--cell) * 0.14) 0 0;
    background: transparent;
    text-align: center;
    font: 600 calc(var(--cell) * 0.48) / 1 system-ui, sans-serif;
    text-transform: uppercase;
    caret-color: transparent;
    outline: none;
    color: var(--ink);
  }

  .accents {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.75rem;
  }
  .accents button {
    padding: 0.25rem 0.55rem;
    font-weight: 600;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  .clues {
    flex: 1;
    min-width: 18rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1.5rem;
  }
  .clues h2 {
    margin: 0 0 0.5rem;
    font-size: 1.05rem;
    border-bottom: 1px solid #ddd;
    padding-bottom: 0.25rem;
  }
  .clues ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .clues li button {
    display: flex;
    gap: 0.4rem;
    width: 100%;
    text-align: left;
    border: 0;
    padding: 0.3rem 0.4rem;
    border-radius: 4px;
    background: none;
    align-items: baseline;
  }
  .clues li.active button {
    background: var(--hl);
  }
  .n {
    font-weight: 700;
    min-width: 1.4rem;
  }
  .tag {
    flex: none;
    white-space: nowrap;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    background: #e5e7eb;
    color: #374151;
  }
  .enum {
    color: #666;
    white-space: nowrap;
  }


  /* ---------------- phones ---------------- */
  @media (max-width: 700px) {
    main {
      --pad: 0.75rem;
    }
    h1 {
      font-size: 1.4rem;
    }
    .lede {
      font-size: 0.9rem;
    }
    .has-puzzle h1,
    .has-puzzle .lede {
      display: none;
    }
    .options {
      flex-direction: column;
      align-items: stretch;
    }
    fieldset {
      flex-wrap: wrap;
    }
    .board {
      gap: 1rem;
    }
    .left {
      width: 100%;
    }
    .cluebar {
      position: sticky;
      top: 0;
      z-index: 3;
      box-shadow: 0 2px 6px rgb(0 0 0 / 0.08);
    }
    .grid {
      margin: 0 auto;
    }
    /* one row of accent keys, scroll sideways if needed */
    .accents {
      flex-wrap: nowrap;
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }
    .accents button {
      flex: none;
      padding: 0.45rem 0.7rem;
    }
    .actions button {
      flex: 1 1 auto;
    }
    /* one clue at a time; the full list is optional */
    .clues {
      display: none;
    }
    .clues.show {
      display: grid;
    }
    .all-clues-toggle {
      display: inline-block;
    }
  }
</style>
