<script lang="ts">
  import { settings } from '#lib/settings.svelte.ts';
  import {
    VERBS,
    VERB_PRESETS,
    LANGUAGES,
    LANGUAGE_NAMES,
    LANGUAGE_TAGS,
    type Language,
    type VerbSense
  } from '#lib/verbs.ts';

  let sortChoice = $state<Language>('en');
  let search = $state('');
  let show = $state<'all' | 'on' | 'off'>('all');

  /** Languages from Settings; if none are chosen, show all of them. */
  let shownLanguages = $derived(settings.languages.length ? settings.languages : LANGUAGES);
  /** Fall back to the first shown language if the chosen sort language is turned off. */
  let sortBy = $derived(shownLanguages.includes(sortChoice) ? sortChoice : shownLanguages[0]);
  let otherLanguages = $derived(shownLanguages.filter((l) => l !== sortBy));

  let disabled = $derived(new Set(settings.disabledVerbs));

  const collator = new Intl.Collator('pt', { sensitivity: 'base' });
  const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  let sorted = $derived(
    [...VERBS].sort((a, b) => {
      let d = collator.compare(a[sortBy], b[sortBy]);
      for (const l of otherLanguages) if (!d) d = collator.compare(a[l], b[l]);
      return d;
    })
  );

  let visible = $derived.by(() => {
    const q = fold(search.trim());
    return sorted.filter((v) => {
      if (show === 'on' && disabled.has(v.id)) return false;
      if (show === 'off' && !disabled.has(v.id)) return false;
      if (!q) return true;
      return shownLanguages.some((l) => fold(v[l]).includes(q)) || fold(v.sense ?? '').includes(q);
    });
  });

  let enabledCount = $derived(VERBS.length - VERBS.filter((v) => disabled.has(v.id)).length);

  /** Translations in the other languages; identical spellings are shown once. */
  function translations(v: VerbSense): { text: string; tags: string[] }[] {
    const out: { text: string; tags: string[] }[] = [];
    for (const l of otherLanguages) {
      const found = out.find((t) => t.text === v[l]);
      if (found) found.tags.push(LANGUAGE_TAGS[l]);
      else out.push({ text: v[l], tags: [LANGUAGE_TAGS[l]] });
    }
    return out;
  }

  function toggle(id: string) {
    settings.disabledVerbs = disabled.has(id)
      ? settings.disabledVerbs.filter((x) => x !== id)
      : [...settings.disabledVerbs, id];
  }

  /* ---------------- presets ---------------- */
  let presetChoice = $state('');
  let presetMessage = $state('');
  /** what the selection was before the last preset, for Undo */
  let undoSnapshot = $state<string[] | null>(null);

  function applyPreset(id: string) {
    const preset = VERB_PRESETS.find((p) => p.id === id);
    presetChoice = '';
    if (!preset) return;
    undoSnapshot = [...settings.disabledVerbs];
    // turn everything off, then turn the preset's verbs back on
    settings.disabledVerbs = VERBS.filter((v) => !preset.includes(v)).map((v) => v.id);
    const on = VERBS.length - settings.disabledVerbs.length;
    presetMessage = `${preset.name}: ${on} turned on.`;
  }

  function undoPreset() {
    if (!undoSnapshot) return;
    settings.disabledVerbs = undoSnapshot;
    undoSnapshot = null;
    presetMessage = 'Previous selection restored.';
  }

  function setVisible(on: boolean) {
    const ids = new Set(visible.map((v) => v.id));
    const rest = settings.disabledVerbs.filter((id) => !ids.has(id));
    settings.disabledVerbs = on ? rest : [...rest, ...ids];
  }
</script>

<main>
  <h1>Dictionary</h1>
  <p class="help">
    Turn verbs on or off for the crossword. {enabledCount} of {VERBS.length} are on.
  </p>

  <div class="toolbar">
    <label>
      Preset
      <select bind:value={presetChoice} onchange={() => applyPreset(presetChoice)}>
        <option value="" disabled>Choose…</option>
        {#each VERB_PRESETS as p}<option value={p.id}>{p.name}</option>{/each}
      </select>
    </label>
    <label>
      Sort by
      <select bind:value={sortChoice}>
        {#each shownLanguages as l}<option value={l}>{LANGUAGE_NAMES[l]}</option>{/each}
      </select>
    </label>
    <label>
      Show
      <select bind:value={show}>
        <option value="all">All</option>
        <option value="on">On</option>
        <option value="off">Off</option>
      </select>
    </label>
    <label class="grow">
      Search
      <input type="search" bind:value={search} placeholder="Find a verb…" />
    </label>
    <div class="bulk">
      <button onclick={() => setVisible(true)}>Turn on {search || show !== 'all' ? 'shown' : 'all'}</button>
      <button onclick={() => setVisible(false)}>Turn off {search || show !== 'all' ? 'shown' : 'all'}</button>
    </div>
  </div>

  {#if presetMessage}
    <p class="preset-message">
      {presetMessage}
      {#if undoSnapshot}<button class="link" onclick={undoPreset}>Undo</button>{/if}
    </p>
  {/if}

  {#if visible.length === 0}
    <p class="help">No verbs match.</p>
  {:else}
    <ul>
      {#each visible as v (v.id)}
        {@const off = disabled.has(v.id)}
        <li class:off>
          <label>
            <input type="checkbox" checked={!off} onchange={() => toggle(v.id)} />
            <span class="entry">
              <strong>{v[sortBy]}</strong>{#if otherLanguages.length}:{' '}
                {#each translations(v) as t, i}
                  {#if i}<span class="sep"> · </span>{/if}{t.text}{#if otherLanguages.length > 1}
                    <span class="tag">{t.tags.join('/')}</span>{/if}
                {/each}
              {/if}
              {#if v.reflexive}<span class="tag refl" title="Reflexive in Portuguese">reflexive</span>{/if}
              {#if v.sense}<span class="sense">{v.sense}</span>{/if}
            </span>
          </label>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: #1d1d1f;
    max-width: 72rem;
    margin: 0 auto;
    padding: 1.5rem;
  }
  h1 {
    margin: 0 0 0.25rem;
  }
  .help {
    color: #555;
    margin: 0 0 1rem;
  }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #fff;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem;
    padding: 0.5rem 0 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 0.5rem;
  }
  .toolbar label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.85rem;
  }
  .grow {
    flex: 1;
    min-width: 12rem;
  }
  input[type='search'],
  select {
    font: inherit;
    padding: 0.35rem 0.5rem;
  }
  .bulk {
    display: flex;
    gap: 0.4rem;
  }
  button {
    font: inherit;
    padding: 0.4rem 0.8rem;
    border: 1px solid #c7c7cc;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    columns: 22rem;
    column-gap: 2rem;
  }
  li {
    break-inside: avoid;
  }
  li label {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.3rem 0.25rem;
    border-radius: 4px;
    cursor: pointer;
  }
  li label:hover {
    background: #f3f4f6;
  }
  li.off .entry {
    color: #9ca3af;
  }
  .sep {
    color: #9ca3af;
  }
  .tag {
    font-size: 0.6rem;
    font-weight: 700;
    padding: 0 0.25rem;
    border-radius: 3px;
    background: #e5e7eb;
    color: #4b5563;
    vertical-align: 1px;
  }
  .tag.refl {
    background: #ede9fe;
    color: #5b21b6;
  }
  .preset-message {
    margin: 0.25rem 0 0.75rem;
    padding: 0.4rem 0.75rem;
    background: #ecfdf5;
    border-radius: 6px;
    font-size: 0.9rem;
  }
  .link {
    border: 0;
    background: none;
    color: #2563eb;
    padding: 0 0.25rem;
    text-decoration: underline;
  }
  .sense {
    display: block;
    font-size: 0.8rem;
    color: #6b7280;
  }
  li.off .sense {
    color: #c4c7cc;
  }
</style>
