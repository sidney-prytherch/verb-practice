/**
 * Vocabulary besides verbs, from vocab.json: nouns, adjectives, adverbs & small
 * words, and everyday phrases, in English, Brazilian and European Portuguese.
 *
 * Nouns carry a gender for each variant (they can differ: a geladeira / o frigorífico),
 * adjectives carry their feminine forms (alto / alta, bom / boa).
 */

import vocabJson from "./vocab.json";
import type { Language } from "./verbs";

export type PortugueseLanguage = "pt-br" | "pt-pt";

/** Word types that can be switched on in Settings ("verb" is the verb list in verbs.json). */
export type WordType = "verb" | "noun" | "adjective" | "word" | "phrase";

export const WORD_TYPES: { id: WordType; name: string; example: string }[] = [
  { id: "verb", name: "Verbs", example: "I walked → eu andei" },
  { id: "noun", name: "Nouns", example: "the house → a casa" },
  { id: "adjective", name: "Adjectives", example: "tall (f.) → alta" },
  { id: "word", name: "Adverbs & small words", example: "always → sempre" },
  { id: "phrase", name: "Phrases", example: "good morning → bom dia" },
];

/** m / f, or plural (mp / fp) for words like os pais, as férias. */
export type Gender = "m" | "f" | "mp" | "fp";

export const ARTICLE: Record<Gender, string> = { m: "o", f: "a", mp: "os", fp: "as" };

export interface VocabEntry {
  /** stable id, e.g. "noun:house", "adjective:short#1" */
  id: string;
  type: Exclude<WordType, "verb">;
  en: string;
  "pt-br": string;
  "pt-pt": string;
  /** topic, e.g. "food", "travel", "colors" */
  category: string;
  /** short note telling apart words that translate the same way */
  sense: string | null;
  /** nouns only */
  gender?: Record<PortugueseLanguage, Gender>;
  /** adjectives only: feminine form (the entry's own word is masculine) */
  feminine?: Record<PortugueseLanguage, string>;
}

type RawEntry = Omit<VocabEntry, "type">;
const raw = vocabJson as Record<"nouns" | "adjectives" | "words" | "phrases", RawEntry[]>;

export const VOCAB: VocabEntry[] = [
  ...raw.nouns.map((e) => ({ ...e, type: "noun" as const })),
  ...raw.adjectives.map((e) => ({ ...e, type: "adjective" as const })),
  ...raw.words.map((e) => ({ ...e, type: "word" as const })),
  ...raw.phrases.map((e) => ({ ...e, type: "phrase" as const })),
];

/** A noun with its article: "a casa", "os pais", "the house". Other words unchanged. */
export function withArticle(entry: VocabEntry, lang: Language): string {
  if (entry.type !== "noun" || !entry.gender) return entry[lang];
  if (lang === "en") return `the ${entry.en}`;
  return `${ARTICLE[entry.gender[lang]]} ${entry[lang]}`;
}

/** Adjective in the given gender ("f" uses the feminine form). */
export function adjectiveForm(entry: VocabEntry, lang: PortugueseLanguage, gender: "m" | "f"): string {
  return gender === "f" && entry.feminine ? entry.feminine[lang] : entry[lang];
}

/** Topics used by one word type, in order of appearance. */
export function categoriesOf(type: Exclude<WordType, "verb">): string[] {
  return [...new Set(VOCAB.filter((e) => e.type === type).map((e) => e.category))];
}
