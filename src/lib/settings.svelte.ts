/**
 * App-wide settings, shared by every page and saved in localStorage.
 *
 *   import { settings } from '#lib/settings.svelte.ts';
 *   settings.languages // ["en", "pt-br"]
 */

import { LANGUAGES, SUBJECTS, type Language, type SubjectId } from "./verbs";
import type { Tense, Aspect } from "./conjugator";
import { WORD_TYPES, type WordType } from "./vocab";

export { SUBJECTS, type SubjectId, type SubjectInfo } from "./verbs";

/** symmetric: classic 180° rotational symmetry; dense: no symmetry, packed tighter */
export type CrosswordLayout = "symmetric" | "dense";

export const LAYOUTS: { id: CrosswordLayout; name: string; description: string }[] = [
  {
    id: "symmetric",
    name: "Symmetrical",
    description: "Classic look: the pattern of black squares is the same when the grid is turned upside down.",
  },
  {
    id: "dense",
    name: "Dense",
    description: "No symmetry. Words can sit side by side when every run of letters they form is also a word.",
  },
];

export const SIZES = [9, 11, 13, 15, 17] as const;
export type GridSize = (typeof SIZES)[number];

export const TENSES: Tense[] = ["past", "present", "future"];
export const ASPECTS: Aspect[] = ["simple", "continuous", "perfect", "perfectContinuous"];
export const ASPECT_LABELS: Record<Aspect, string> = {
  simple: "simple",
  continuous: "continuous",
  perfect: "perfect",
  perfectContinuous: "perfect continuous",
};

export interface Settings {
  /** which kinds of words crosswords use: verbs, nouns, adjectives, words, phrases */
  wordTypes: WordType[];
  layout: CrosswordLayout;
  size: GridSize;
  tenses: Tense[];
  aspects: Aspect[];
  /** use the subjunctive in about half the clues */
  subjunctive: boolean;
  /** add direct object pronouns (I saw *him*) to verbs that take them, about half the time */
  objectPronouns: boolean;
  /** add indirect object pronouns (I told *her*, I gave it *to her*), about half the time */
  indirectObjectPronouns: boolean;
  languages: Language[];
  subjects: SubjectId[];
  /** ids of verbs switched off in the dictionary (new verbs are on by default) */
  /** ids of dictionary entries switched off (verbs and other words; new ones are on) */
  disabledVerbs: string[];
}

const STORAGE_KEY = "verb-practice:settings";

export function defaultSettings(): Settings {
  return {
    layout: "symmetric",
    size: 13,
    tenses: [...TENSES],
    aspects: ["simple", "continuous"],
    subjunctive: false,
    objectPronouns: true,
    indirectObjectPronouns: true,
    languages: ["en", "pt-br"],
    subjects: SUBJECTS.map((s) => s.id),
    disabledVerbs: [],
    wordTypes: WORD_TYPES.map((t) => t.id),
  };
}

function load(): Settings {
  const defaults = defaultSettings();
  if (typeof localStorage === "undefined") return defaults;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Settings> | null;
    if (!saved) return defaults;
    const subjectIds = SUBJECTS.map((s) => s.id);
    return {
      layout: LAYOUTS.some((l) => l.id === saved.layout) ? (saved.layout as CrosswordLayout) : defaults.layout,
      size: SIZES.includes(saved.size as GridSize) ? (saved.size as GridSize) : defaults.size,
      tenses: Array.isArray(saved.tenses) ? TENSES.filter((t) => saved.tenses!.includes(t)) : defaults.tenses,
      aspects: Array.isArray(saved.aspects) ? ASPECTS.filter((a) => saved.aspects!.includes(a)) : defaults.aspects,
      subjunctive: typeof saved.subjunctive === "boolean" ? saved.subjunctive : defaults.subjunctive,
      objectPronouns: typeof saved.objectPronouns === "boolean" ? saved.objectPronouns : defaults.objectPronouns,
      indirectObjectPronouns:
        typeof saved.indirectObjectPronouns === "boolean"
          ? saved.indirectObjectPronouns
          : defaults.indirectObjectPronouns,
      languages: Array.isArray(saved.languages)
        ? LANGUAGES.filter((l) => saved.languages!.includes(l))
        : defaults.languages,
      subjects: Array.isArray(saved.subjects)
        ? subjectIds.filter((id) => saved.subjects!.includes(id))
        : defaults.subjects,
      disabledVerbs: Array.isArray(saved.disabledVerbs) ? saved.disabledVerbs.map(String) : [],
      wordTypes: Array.isArray(saved.wordTypes)
        ? WORD_TYPES.map((t) => t.id).filter((id) => saved.wordTypes!.includes(id))
        : defaults.wordTypes,
    };
  } catch {
    return defaults;
  }
}

export const settings = $state<Settings>(load());

// save on every change (browser only)
if (typeof localStorage !== "undefined") {
  $effect.root(() => {
    $effect(() => {
      const json = JSON.stringify(settings);
      try {
        localStorage.setItem(STORAGE_KEY, json);
      } catch {
        /* storage full or blocked: settings still work for this visit */
      }
    });
  });
}

export function resetSettings(): void {
  Object.assign(settings, defaultSettings());
}

/** Toggle an item in a list, keeping the order of `all`. */
export function toggleIn<T>(list: T[], item: T, all: readonly T[]): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : all.filter((x) => x === item || list.includes(x));
}
