<script lang="ts">
  import { settings } from '#lib/settings.svelte.ts';
  import { resolve } from '$app/paths';
  import {
    VERBS,
    VERB_PRESETS,
    LANGUAGES,
    LANGUAGE_NAMES,
    LANGUAGE_TAGS,
    type Language
  } from '#lib/verbs.ts';
  import {
    VOCAB,
    WORD_TYPES,
    withArticle,
    categoriesOf,
    type VocabEntry,
    type WordType
  } from '#lib/vocab.ts';

  /** One row of the dictionary: a verb sense or a vocabulary entry. */
  interface Item {
    id: string;
    type: WordType;
    /** what is shown: nouns with their article, adjectives as "alto / alta" */
    text: Record<Language, string>;
    /** what is sorted and searched: the bare word */
    word: Record<Language, string>;
    sense: string | null;
    category: string | null;
    reflexive: boolean;
  }

  function vocabDisplay(e: VocabEntry, lang: Language): string {
    if (lang === 'en') return e.en;
    if (e.type === 'noun') return withArticle(e, lang);
    if (e.type === 'adjective' && e.feminine && e.feminine[lang] !== e[lang]) {
      return `${e[lang]} / ${e.feminine[lang]}`;
    }
    return e[lang];
  }

  const ITEMS: Item[] = [
    ...VERBS.map((v) => {
      const word = { en: v.en, 'pt-br': v['pt-br'], 'pt-pt': v['pt-pt'] };
      return { id: v.id, type: 'verb' as const, text: word, word, sense: v.sense, category: null, reflexive: v.reflexive };
    }),
    ...VOCAB.map((e) => ({
      id: e.id,
      type: e.type,
      text: { en: e.en, 'pt-br': vocabDisplay(e, 'pt-br'), 'pt-pt': vocabDisplay(e, 'pt-pt') },
      word: { en: e.en, 'pt-br': e['pt-br'], 'pt-pt': e['pt-pt'] },
      sense: e.sense,
      category: e.category,
      reflexive: false
    }))
  ];

  const TYPE_TAG: Record<WordType, string> = {
    verb: 'verb',
    noun: 'noun',
    adjective: 'adj.',
    word: 'word',
    phrase: 'phrase'
  };

  let typeChoice = $state<WordType | 'all'>('all');
  let topicChoice = $state('all');
  let sortChoice = $state<Language>('en');
  let search = $state('');
  let show = $state<'all' | 'on' | 'off'>('all');

  /** Topics for the chosen word type (verbs have none). */
  let topics = $derived(typeChoice === 'all' || typeChoice === 'verb' ? [] : categoriesOf(typeChoice));
  let topic = $derived(topics.includes(topicChoice) ? topicChoice : 'all');

  /** Languages from Settings; if none are chosen, show all of them. */
  let shownLanguages = $derived(settings.languages.length ? settings.languages : LANGUAGES);
  /** Fall back to the first shown language if the chosen sort language is turned off. */
  let sortBy = $derived(shownLanguages.includes(sortChoice) ? sortChoice : shownLanguages[0]);
  let otherLanguages = $derived(shownLanguages.filter((l) => l !== sortBy));

  let disabled = $derived(new Set(settings.disabledVerbs));

  const collator = new Intl.Collator('pt', { sensitivity: 'base' });
  const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  /** Everything in the chosen type and topic (before search / on-off filters). */
  let inScope = $derived(
    ITEMS.filter(
      (i) =>
        (typeChoice === 'all' || i.type === typeChoice) && (topic === 'all' || i.category === topic)
    )
  );

  let sorted = $derived(
    [...inScope].sort((a, b) => {
      let d = collator.compare(a.word[sortBy], b.word[sortBy]);
      for (const l of otherLanguages) if (!d) d = collator.compare(a.word[l], b.word[l]);
      return d;
    })
  );

  let visible = $derived.by(() => {
    const q = fold(search.trim());
    return sorted.filter((i) => {
      if (show === 'on' && disabled.has(i.id)) return false;
      if (show === 'off' && !disabled.has(i.id)) return false;
      if (!q) return true;
      return shownLanguages.some((l) => fold(i.text[l]).includes(q)) || fold(i.sense ?? '').includes(q);
    });
  });

  let enabledCount = $derived(inScope.filter((i) => !disabled.has(i.id)).length);

  /** Word types (in the current view) that are switched off in Settings. */
  let typesOff = $derived(
    WORD_TYPES.filter(
      (t) => !settings.wordTypes.includes(t.id) && (typeChoice === 'all' || typeChoice === t.id)
    )
  );

  /** Translations in the other languages; identical spellings are shown once. */
  function translations(i: Item): { text: string; tags: string[] }[] {
    const out: { text: string; tags: string[] }[] = [];
    for (const l of otherLanguages) {
      const found = out.find((t) => t.text === i.text[l]);
      if (found) found.tags.push(LANGUAGE_TAGS[l]);
      else out.push({ text: i.text[l], tags: [LANGUAGE_TAGS[l]] });
    }
    return out;
  }

  function toggle(id: string) {
    settings.disabledVerbs = disabled.has(id)
      ? settings.disabledVerbs.filter((x) => x !== id)
      : [...settings.disabledVerbs, id];
  }

  /* ---------------- presets (verbs only) ---------------- */
  let presetChoice = $state('');
  let presetMessage = $state('');
  /** what the selection was before the last preset, for Undo */
  let undoSnapshot = $state<string[] | null>(null);
  const VERB_IDS = new Set(VERBS.map((v) => v.id));

  function applyPreset(id: string) {
    const preset = VERB_PRESETS.find((p) => p.id === id);
    presetChoice = '';
    if (!preset) return;
    undoSnapshot = [...settings.disabledVerbs];
    // turn every verb off, then turn the preset's verbs back on (other words are untouched)
    const otherWordsOff = settings.disabledVerbs.filter((x) => !VERB_IDS.has(x));
    const verbsOff = VERBS.filter((v) => !preset.includes(v)).map((v) => v.id);
    settings.disabledVerbs = [...otherWordsOff, ...verbsOff];
    presetMessage = `${preset.name}: ${VERBS.length - verbsOff.length} verbs turned on.`;
  }

  function undoPreset() {
    if (!undoSnapshot) return;
    settings.disabledVerbs = undoSnapshot;
    undoSnapshot = null;
    presetMessage = 'Previous selection restored.';
  }

  function setVisible(on: boolean) {
    const ids = new Set(visible.map((i) => i.id));
    const rest = settings.disabledVerbs.filter((id) => !ids.has(id));
    settings.disabledVerbs = on ? rest : [...rest, ...ids];
  }
</script>

<main>
  <h1>Dictionary</h1>
  <p class="help">
    Turn words on or off for the crossword. {enabledCount} of {inScope.length}
    {typeChoice === 'all' ? 'entries' : WORD_TYPES.find((t) => t.id === typeChoice)?.name.toLowerCase()} are on.
  </p>
  {#if typesOff.length}
    <p class="note">
      {typesOff.map((t) => t.name).join(', ')}
      {typesOff.length === 1 ? 'is' : 'are'} switched off in
      <a href={resolve('/settings')}>Settings</a>, so {typesOff.length === 1 ? 'it' : 'they'} won't
      appear in crosswords.
    </p>
  {/if}

  <div class="toolbar">
    <label>
      Type
      <select bind:value={typeChoice}>
        <option value="all">All words</option>
        {#each WORD_TYPES as t}<option value={t.id}>{t.name}</option>{/each}
      </select>
    </label>
    {#if topics.length}
      <label>
        Topic
        <select bind:value={topicChoice}>
          <option value="all">All topics</option>
          {#each topics as c}<option value={c}>{c}</option>{/each}
        </select>
      </label>
    {/if}
    {#if typeChoice === 'all' || typeChoice === 'verb'}
      <label>
        Verb preset
        <select bind:value={presetChoice} onchange={() => applyPreset(presetChoice)}>
          <option value="" disabled>Choose…</option>
          {#each VERB_PRESETS as p}<option value={p.id}>{p.name}</option>{/each}
        </select>
      </label>
    {/if}
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
      <input type="search" bind:value={search} placeholder="Find a word…" />
    </label>
    <div class="bulk">
      <button onclick={() => setVisible(true)}>Turn on shown</button>
      <button onclick={() => setVisible(false)}>Turn off shown</button>
    </div>
  </div>

  {#if presetMessage}
    <p class="preset-message">
      {presetMessage}
      {#if undoSnapshot}<button class="link" onclick={undoPreset}>Undo</button>{/if}
    </p>
  {/if}

  {#if visible.length === 0}
    <p class="help">No words match.</p>
  {:else}
    <ul>
      {#each visible as i (i.id)}
        {@const off = disabled.has(i.id)}
        <li class:off>
          <label>
            <input type="checkbox" checked={!off} onchange={() => toggle(i.id)} />
            <span class="entry">
              <strong>{i.text[sortBy]}</strong>{#if otherLanguages.length}:{' '}
                {#each translations(i) as t, n}
                  {#if n}<span class="sep"> · </span>{/if}{t.text}{#if otherLanguages.length > 1}
                    <span class="tag">{t.tags.join('/')}</span>{/if}
                {/each}
              {/if}
              {#if typeChoice === 'all'}<span class="tag type">{TYPE_TAG[i.type]}</span>{/if}
              {#if i.reflexive}<span class="tag refl" title="Reflexive in Portuguese">reflexive</span>{/if}
              {#if i.sense || (i.category && topic === 'all')}
                <span class="sense">{[i.sense, topic === 'all' ? i.category : null].filter(Boolean).join(' · ')}</span>
              {/if}
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
  .tag.type {
    background: #e0f2fe;
    color: #075985;
  }
  .note {
    margin: 0 0 1rem;
    padding: 0.4rem 0.75rem;
    background: #fef3c7;
    border-radius: 6px;
    font-size: 0.9rem;
  }
  .note a {
    color: #2563eb;
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
