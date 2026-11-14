/**
 * The verb list from verbs.json, flattened into one entry per translation
 * (sense), each with a stable id.
 */

import verbsJson from "./verbs.json";

export type Language = "en" | "pt-br" | "pt-pt";

export const LANGUAGES: Language[] = ["en", "pt-br", "pt-pt"];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  "pt-br": "Portuguese (Brazil)",
  "pt-pt": "Portuguese (Portugal)",
};

/** Short tag for compact UI. */
export const LANGUAGE_TAGS: Record<Language, string> = {
  en: "EN",
  "pt-br": "BR",
  "pt-pt": "PT",
};

interface RawSense {
  en: string;
  "pt-br": string;
  "pt-pt": string;
  sense: string | null;
  "common-index": number;
}

export interface VerbSense {
  /** stable id: the verbs.json key plus the position in its list, e.g. "be#1" */
  id: string;
  en: string;
  "pt-br": string;
  "pt-pt": string;
  sense: string | null;
  commonIndex: number;
}

export const VERBS: VerbSense[] = Object.entries(verbsJson as Record<string, RawSense[]>).flatMap(
  ([key, list]) =>
    list.map((s, i) => ({
      id: `${key}#${i}`,
      en: s.en,
      "pt-br": s["pt-br"],
      "pt-pt": s["pt-pt"],
      sense: s.sense,
      commonIndex: s["common-index"],
    }))
);

/* ---------------- subjects ---------------- */

export type SubjectId = "i" | "you" | "he" | "she" | "we" | "youPl" | "theyM" | "theyF";

export interface SubjectInfo {
  id: SubjectId;
  /** subject passed to the English conjugator */
  en: string;
  /** clarifying note shown with English (you pl., they f.) */
  note?: string;
  "pt-br": string;
  "pt-pt": string;
}

export const SUBJECTS: SubjectInfo[] = [
  { id: "i", en: "I", "pt-br": "eu", "pt-pt": "eu" },
  { id: "you", en: "you", "pt-br": "você", "pt-pt": "tu" },
  { id: "he", en: "he", "pt-br": "ele", "pt-pt": "ele" },
  { id: "she", en: "she", "pt-br": "ela", "pt-pt": "ela" },
  { id: "we", en: "we", "pt-br": "nós", "pt-pt": "nós" },
  { id: "youPl", en: "you", note: "pl.", "pt-br": "vocês", "pt-pt": "vocês" },
  { id: "theyM", en: "they", note: "m.", "pt-br": "eles", "pt-pt": "eles" },
  { id: "theyF", en: "they", note: "f.", "pt-br": "elas", "pt-pt": "elas" },
];
