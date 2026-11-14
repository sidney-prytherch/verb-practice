<script lang="ts">
  import {
    settings,
    resetSettings,
    toggleIn,
    SUBJECTS,
    LAYOUTS,
    SIZES,
    TENSES,
    ASPECTS,
    ASPECT_LABELS
  } from '#lib/settings.svelte.ts';
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
    <h2>Grid size</h2>
    <div class="options">
      {#each SIZES as n}
        <label class="option" class:on={settings.size === n}>
          <input type="radio" name="size" value={n} bind:group={settings.size} />
          {n}×{n}
        </label>
      {/each}
    </div>
  </section>

  <section>
    <h2>Tenses</h2>
    <div class="options">
      {#each TENSES as t}
        <label class="option" class:on={settings.tenses.includes(t)}>
          <input
            type="checkbox"
            checked={settings.tenses.includes(t)}
            onchange={() => (settings.tenses = toggleIn(settings.tenses, t, TENSES))}
          />
          {t}
        </label>
      {/each}
    </div>
    {#if settings.tenses.length === 0}
      <p class="warn">Choose at least one tense to make a crossword.</p>
    {/if}
  </section>

  <section>
    <h2>Aspects</h2>
    <p class="help">
      Simple: <em>I walked</em> · continuous: <em>I was walking</em> · perfect: <em>I had walked</em>
      · perfect continuous: <em>I had been walking</em>
    </p>
    <div class="options">
      {#each ASPECTS as a}
        <label class="option" class:on={settings.aspects.includes(a)}>
          <input
            type="checkbox"
            checked={settings.aspects.includes(a)}
            onchange={() => (settings.aspects = toggleIn(settings.aspects, a, ASPECTS))}
          />
          {ASPECT_LABELS[a]}
        </label>
      {/each}
    </div>
    {#if settings.aspects.length === 0}
      <p class="warn">Choose at least one aspect to make a crossword.</p>
    {/if}
  </section>

  <section>
    <h2>Object pronouns</h2>
    <p class="help">Each appears in about half the clues for verbs that can take it.</p>
    <div class="options">
      <label class="option layout" class:on={settings.objectPronouns}>
        <input type="checkbox" bind:checked={settings.objectPronouns} />
        <span>
          <strong>Direct object pronouns</strong>
          <span class="desc">
            <em>I saw him</em> → <em>eu vi ele</em> (BR) · <em>eu vi-o</em> (PT)
          </span>
        </span>
      </label>
      <label class="option layout" class:on={settings.indirectObjectPronouns}>
        <input type="checkbox" bind:checked={settings.indirectObjectPronouns} />
        <span>
          <strong>Indirect object pronouns</strong>
          <span class="desc">
            <em>I told her</em> → <em>eu disse pra ela</em> (BR) · <em>eu disse-lhe</em> (PT).
            With both on: <em>I gave it to her</em> → <em>eu dei pra ela</em> ·
            <em>eu dei-lho</em>
          </span>
        </span>
      </label>
    </div>
  </section>

  <section>
    <h2>Crossword layout</h2>
    <div class="options layouts">
      {#each LAYOUTS as l}
        <label class="option layout" class:on={settings.layout === l.id}>
          <input type="radio" name="layout" value={l.id} bind:group={settings.layout} />
          <span>
            <strong>{l.name}</strong>
            <span class="desc">{l.description}</span>
          </span>
        </label>
      {/each}
    </div>
  </section>

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
  .layout {
    align-items: flex-start;
    max-width: 22rem;
  }
  .layout input {
    margin-top: 0.2rem;
  }
  .desc {
    display: block;
    font-size: 0.85rem;
    color: #555;
    margin-top: 0.15rem;
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
