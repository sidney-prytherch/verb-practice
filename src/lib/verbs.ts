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
  reflexive: boolean;
  "direct-object": boolean;
  "indirect-object": boolean;
}

export interface VerbSense {
  /** stable id: the verbs.json key plus the position in its list, e.g. "be#1" */
  id: string;
  en: string;
  "pt-br": string;
  "pt-pt": string;
  sense: string | null;
  /** frequency rank of the English verb (1 = most common); shared by all its senses */
  commonIndex: number;
  /** reflexive in Portuguese (-se) in either variant */
  reflexive: boolean;
  /** takes a direct object pronoun in both languages: I saw it / eu vi-o */
  directObject: boolean;
  /** also takes an indirect object pronoun: I gave it to her / eu dei-lho */
  indirectObject: boolean;
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
      reflexive: !!s.reflexive,
      directObject: !!s["direct-object"],
      indirectObject: !!s["indirect-object"],
    }))
);

/* ---------------- dictionary presets ---------------- */

export interface VerbPreset {
  id: string;
  name: string;
  /** which verbs the preset turns on; every other verb is turned off */
  includes: (v: VerbSense) => boolean;
}

export const VERB_PRESETS: VerbPreset[] = [
  { id: "all", name: "All verbs", includes: () => true },
  { id: "top100", name: "100 most common verbs", includes: (v) => v.commonIndex <= 100 },
  { id: "reflexive", name: "Reflexive verbs", includes: (v) => v.reflexive },
];

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
