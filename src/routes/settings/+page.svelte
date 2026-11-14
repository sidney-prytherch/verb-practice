<script lang="ts">
  import { settings, resetSettings, toggleIn, SUBJECTS } from '#lib/settings.svelte.ts';
  import { LANGUAGES, LANGUAGE_NAMES, type Language } from '#lib/verbs.ts';
  import { languagePairs } from '#lib/crossword-clues.ts';

  const subjectIds = SUBJECTS.map((s) => s.id);

  let pairs = $derived(languagePairs(settings.languages));

  /** How the subject reads in each chosen language: "you (pl.) · vocês". */
  function subjectLabel(s: (typeof SUBJECTS)[number]): string {
    const parts: string[] = [];
    for (const lang of LANGUAGES) {
      if (!settings.languages.includes(lang)) continue;
      const text = lang === 'en' ? `${s.en}${s.note ? ` (${s.note})` : ''}` : s[lang];
      if (!parts.includes(text)) parts.push(text);
    }
    if (parts.length === 0) parts.push(`${s.en}${s.note ? ` (${s.note})` : ''}`);
    return parts.join(' · ');
  }

  function toggleLanguage(lang: Language) {
    settings.languages = toggleIn(settings.languages, lang, LANGUAGES);
  }
</script>

<main>
  <h1>Settings</h1>

  <section>
    <h2>Languages</h2>
    <p class="help">Clues are written in one of these and answered in another.</p>
    <div class="options">
      {#each LANGUAGES as lang}
        <label class="option" class:on={settings.languages.includes(lang)}>
          <input
            type="checkbox"
            checked={settings.languages.includes(lang)}
            onchange={() => toggleLanguage(lang)}
          />
          {LANGUAGE_NAMES[lang]}
        </label>
      {/each}
    </div>
    {#if settings.languages.length < 2}
      <p class="warn">Choose at least two languages to make a crossword.</p>
    {:else if settings.languages.length === 3}
      <p class="help">
        With English chosen, clues always go between English and Portuguese (not Brazil ↔
        Portugal).
      </p>
    {/if}
    {#if pairs.length}
      <p class="help small">
        Translations used: {pairs.map(([a, b]) => `${LANGUAGE_NAMES[a]} → ${LANGUAGE_NAMES[b]}`).join(', ')}
      </p>
    {/if}
  </section>

  <section>
    <h2>Subjects</h2>
    <div class="row">
      <button onclick={() => (settings.subjects = [...subjectIds])}>All</button>
      <button onclick={() => (settings.subjects = [])}>None</button>
    </div>
    <div class="options">
      {#each SUBJECTS as s}
        <label class="option" class:on={settings.subjects.includes(s.id)}>
          <input
            type="checkbox"
            checked={settings.subjects.includes(s.id)}
            onchange={() => (settings.subjects = toggleIn(settings.subjects, s.id, subjectIds))}
          />
          {subjectLabel(s)}
        </label>
      {/each}
    </div>
    {#if settings.subjects.length === 0}
      <p class="warn">Choose at least one subject to make a crossword.</p>
    {/if}
  </section>

  <section>
    <button onclick={resetSettings}>Reset all settings</button>
    <span class="help small">Also turns every verb in the dictionary back on.</span>
  </section>
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
    margin: 0 0 1rem;
  }
  section {
    margin-bottom: 2rem;
  }
  h2 {
    font-size: 1.1rem;
    margin: 0 0 0.4rem;
  }
  .help {
    color: #555;
    margin: 0.25rem 0 0.75rem;
  }
  .small {
    font-size: 0.85rem;
  }
  .warn {
    color: #b91c1c;
    font-weight: 600;
  }
  .row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .option {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.85rem;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    cursor: pointer;
    user-select: none;
  }
  .option.on {
    border-color: #2563eb;
    background: #eff6ff;
  }
  button {
    font: inherit;
    padding: 0.4rem 0.8rem;
    border: 1px solid #c7c7cc;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
  }
</style>
