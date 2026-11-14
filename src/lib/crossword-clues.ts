/**
 * Builds crossword entries from the verb list.
 *
 * Each entry is a conjugated verb phrase. The hint is in one of the chosen
 * languages and the answer is its translation into another:
 *
 *   hint "I walked"       -> answer "eu andei"
 *   hint "eu andei"       -> answer "I walked"
 *
 * The subject is randomly dropped from the answer. When it is, the hint shows
 * the subject in brackets so the person is still known:
 *
 *   hint "(I) walked"     -> answer "andei"
 *   hint "(ele) andou"    -> answer "walked"
 */

import { conjugate as conjugateEn, type Tense, type Aspect } from "./conjugator";
import { conjugate as conjugatePt } from "./conjugator-portuguese";
import { toAnswer, type WordEntry } from "./crossword";
import { VERBS, SUBJECTS, type Language, type VerbSense, type SubjectId, type SubjectInfo } from "./verbs";

export type { Tense, Aspect };

export interface ClueOptions {
  /** languages to use (at least two) */
  languages: Language[];
  /** subjects to use (at least one) */
  subjects: SubjectId[];
  /** verbs to use (defaults to all) */
  verbs?: VerbSense[];
  /** tense/aspect pairs to draw from */
  pairs: [Tense, Aspect][];
  /** longest answer allowed (letters only), normally the grid size */
  maxLength: number;
  /** shortest answer allowed (letters only) */
  minLength?: number;
  /** how many entries to build */
  count?: number;
  /** chance of dropping the subject from the answer (default 0.5) */
  dropSubjectChance?: number;
  rnd?: () => number;
}

/**
 * Hint -> answer language pairs. Brazil <-> Portugal is only used when
 * English is not chosen, since the two are often spelt the same.
 */
export function languagePairs(languages: Language[]): [Language, Language][] {
  const out: [Language, Language][] = [];
  const hasEn = languages.includes("en");
  for (const a of languages)
    for (const b of languages) {
      if (a === b) continue;
      if (hasEn && a !== "en" && b !== "en") continue;
      out.push([a, b]);
    }
  return out;
}

/** Conjugates for one subject and returns the predicate (without the subject). */
function predicate(lang: Language, verb: string, pair: [Tense, Aspect], subject: string): string {
  const result =
    lang === "en"
      ? conjugateEn(verb, [pair], [subject])
      : conjugatePt(verb, [pair], [subject], { variant: lang === "pt-br" ? "br" : "pt" });
  const [tense, aspect] = pair;
  const form = result.conjugations[0][tense]![0][aspect]![0];
  return form.slice(subject.length + 1);
}

function enumerate(phrase: string): { wordCount: number; letterCount: number[] } {
  const letterCount = phrase
    .split(/\s+/)
    .map((w) => toAnswer(w).length)
    .filter((n) => n > 0);
  return { wordCount: letterCount.length, letterCount };
}

/** For each (from, to) language pair: verb in `from` -> set of verbs it translates to in `to`. */
function ambiguityMaps(verbs: VerbSense[], pairs: [Language, Language][]) {
  const maps = new Map<string, Map<string, Set<string>>>();
  for (const [from, to] of pairs) {
    const map = new Map<string, Set<string>>();
    for (const v of verbs) {
      const set = map.get(v[from]) ?? new Set<string>();
      set.add(v[to]);
      map.set(v[from], set);
    }
    maps.set(`${from}>${to}`, map);
  }
  return maps;
}

function subjectText(subject: SubjectInfo, lang: Language, bracketed: boolean): string {
  if (lang !== "en") return bracketed ? `(${subject[lang]})` : subject[lang];
  if (bracketed) return `(${subject.en}${subject.note ? ", " + subject.note : ""})`;
  return `${subject.en}${subject.note ? " (" + subject.note + ")" : ""}`;
}

/** Random pool of crossword entries for generateCrossword. */
export function buildCrosswordEntries(opts: ClueOptions): WordEntry[] {
  const {
    languages,
    subjects,
    verbs = VERBS,
    pairs,
    maxLength,
    minLength = 3,
    count = 300,
    dropSubjectChance = 0.5,
    rnd = Math.random,
  } = opts;

  const langPairs = languagePairs(languages);
  if (langPairs.length === 0) throw new Error("Choose at least two languages in Settings.");
  const subjectList = SUBJECTS.filter((s) => subjects.includes(s.id));
  if (subjectList.length === 0) throw new Error("Choose at least one subject in Settings.");
  if (verbs.length === 0) throw new Error("Choose at least one verb in the Dictionary.");
  if (pairs.length === 0) throw new Error("Pick at least one tense and one aspect.");

  const ambiguous = ambiguityMaps(verbs, langPairs);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const entries: WordEntry[] = [];
  const seen = new Set<string>();

  for (let tries = 0; entries.length < count && tries < count * 20; tries++) {
    const sense = pick(verbs);
    const pair = pick(pairs);
    const subject = pick(subjectList);
    const [hintLang, answerLang] = pick(langPairs);
    const drop = rnd() < dropSubjectChance;

    let hintPred: string;
    let answerPred: string;
    try {
      hintPred = predicate(hintLang, sense[hintLang], pair, hintLang === "en" ? subject.en : subject[hintLang]);
      answerPred = predicate(answerLang, sense[answerLang], pair, answerLang === "en" ? subject.en : subject[answerLang]);
    } catch {
      continue;
    }

    const answerSubject = answerLang === "en" ? subject.en : subject[answerLang];
    const word = drop ? answerPred : `${answerSubject} ${answerPred}`;
    let hint = `${subjectText(subject, hintLang, drop)} ${hintPred}`;

    // nothing to translate (e.g. Brazil and Portugal spell it the same)
    if (toAnswer(hintPred) === toAnswer(answerPred)) continue;

    // the hint verb has several translations here: say which one is meant
    const targets = ambiguous.get(`${hintLang}>${answerLang}`)?.get(sense[hintLang]);
    if (targets && targets.size > 1) {
      hint += answerLang === "en" ? ` — to ${sense.en}` : ` — ${sense.sense ?? sense[answerLang]}`;
    }

    const answer = toAnswer(word);
    if (answer.length < minLength || answer.length > maxLength || seen.has(answer)) continue;
    seen.add(answer);
    entries.push({
      word,
      hint,
      languageOrigin: answerLang,
      hintLanguageOrigin: hintLang,
      partOfSpeech: "verb",
      verbTense: `${pair[0]} ${pair[1]}`,
      ...enumerate(word),
    });
  }
  return entries;
}
