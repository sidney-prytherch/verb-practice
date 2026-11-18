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
 *
 * Verbs that take objects sometimes get object pronouns:
 *
 *   hint "I gave it to her"  -> answer "eu dei-lho" / "eu dei pra ela"
 *   hint "eu vi-o (him)"     -> answer "I saw him"
 *   hint "I told her"        -> answer "eu disse-lhe" / "eu disse pra ela"
 *
 * Notes in brackets are added wherever the pronoun would otherwise be ambiguous
 * (Portuguese o = him or it; English it = o or a).
 *
 * With the subjunctive on, about half the clues use it, with its usual conjunction.
 * English hints say "(subjunctive)" so the mood is never in doubt:
 *
 *   hint "that I walk (subjunctive)"    -> answer "que eu ande"
 *   hint "if (we) had walked (subjunctive)" -> answer "se tivéssemos andado"
 *   hint "quando eu andar"              -> answer "when I walk"
 *
 * Other vocabulary (vocab.json) can be mixed in:
 *
 *   hint "the house"      -> answer "a casa"     (nouns with their article)
 *   hint "tall (f.)"      -> answer "alta"       (adjectives, gender shown when it matters)
 *   hint "sempre"         -> answer "always"
 *   hint "good morning"   -> answer "bom dia"
 */

import {
  conjugate as conjugateEn,
  SUBJUNCTIVE_CONJUNCTIONS as EN_CONJUNCTIONS,
  type Tense,
  type Aspect,
  type Mood,
  type ObjectOptions,
  type ObjectPronoun,
} from "./conjugator";
import {
  conjugate as conjugatePt,
  SUBJUNCTIVE_CONJUNCTIONS as PT_CONJUNCTIONS,
} from "./conjugator-portuguese";
import { toAnswer, type WordEntry } from "./crossword";
import { VOCAB, withArticle, adjectiveForm, type VocabEntry } from "./vocab";
import { VERBS, SUBJECTS, type Language, type VerbSense, type SubjectId, type SubjectInfo } from "./verbs";

export type { Tense, Aspect };

export interface ClueOptions {
  /** languages to use (at least two) */
  languages: Language[];
  /** subjects to use (at least one) */
  subjects: SubjectId[];
  /** verbs to use (defaults to all; pass [] for no verbs) */
  verbs?: VerbSense[];
  /** other vocabulary to mix in (nouns, adjectives, words, phrases); default none */
  vocab?: VocabEntry[];
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
  /** use direct object pronouns with verbs that take them (default true) */
  objectPronouns?: boolean;
  /** use indirect object pronouns with verbs that take them (default true) */
  indirectObjectPronouns?: boolean;
  /** chance of each kind of object pronoun when the verb allows it (default 0.5) */
  objectChance?: number;
  /** include subjunctive clues (default false) */
  subjunctive?: boolean;
  /** chance of a clue being subjunctive when it's on (default 0.5) */
  subjunctiveChance?: number;
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
function predicate(
  lang: Language,
  verb: string,
  pair: [Tense, Aspect],
  subject: string,
  objects: ObjectOptions = {},
  mood: Mood = "indicative"
): string {
  const result =
    lang === "en"
      ? conjugateEn(verb, [pair], [subject], { ...objects, mood })
      : conjugatePt(verb, [pair], [subject], { variant: lang === "pt-br" ? "br" : "pt", ...objects, mood });
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

/* ---------------- object pronouns ---------------- */

/** Things: I bought *it*. Also the direct object when there is an indirect one: I gave *it* to her. */
const THING_OPTIONS: ObjectPronoun[] = ["it-m", "it-f", "them-m", "them-f"];
/** People. ("you" plural is left out: its Portuguese pronoun varies too much.) */
const PERSON_OPTIONS: ObjectPronoun[] = ["me", "you", "him", "her", "us", "them-m", "them-f"];

/**
 * Senses whose direct object is naturally a person (I saw *him*, I helped *her*).
 * Every other verb only gets it/them, which avoids clues like "I published her".
 */
const PERSON_OBJECT = new Set(
  `see#0 know#1 find#0 find#1 call#0 leave#1 let#0 help#0 hear#0 hear#1 meet#0 meet#1 love#0 love#1
  hate#0 hate#1 visit#0 invite#0 follow#0 follow#1 watch#1 watch#2 kill#0 protect#0 support#0 support#1
  understand#0 understand#1 recognize#0 remember#2 forget#0 lose#0 beat#0 beat#2 attack#0 avoid#0
  ignore#0 judge#0 face#0 face#1 hurt#0 scare#0 surprise#0 persuade#0 persuade#1 warn#0 inform#0
  introduce#0 welcome#0 welcome#1 take#1 bring#0 wake#1 catch#0 catch#1 hold#0 push#0 pull#0 kick#0
  bite#0 hide#0 save#0 choose#0 select#1 accept#0 prefer#0 treat#0 train#0 lead#0 lead#1 receive#0
  get#4 expect#0 imagine#0 raise#2 observe#0 notice#0 examine#0 release#0 control#0 wash#0 tie#1
  compare#0 influence#0 satisfy#0 serve#0 drop#1 keep#1 want#0`.split(/\s+/)
);
/**
 * Senses whose "it" is abstract (say it, know it, explain it). Everyday Brazilian
 * leaves such an "it" out rather than saying "ele", so these only get it/them
 * together with an indirect object (where Brazilian drops it anyway).
 */
const ABSTRACT_OBJECT = new Set(
  `know#0 say#0 tell#0 tell#1 understand#0 understand#1 realize#0 decide#1 explain#0
  mention#0 suggest#0 suggest#1 report#0 describe#0 reveal#0 deny#0 prove#0 promise#0 whisper#0
  sing#0 admit#0 imagine#0 consider#0 notice#0 express#0 guess#0 repeat#0 discuss#0 deserve#0
  expect#0 remember#2 forget#0 ignore#0 regret#0 prefer#0 accept#0 recognize#0 hear#0 feel#0`.split(/\s+/)
);

/** Senses where "to her" works without an "it": I told her, I explained to them. */
const INDIRECT_ALONE = new Set(
  `say#0 tell#1 show#0 write#0 explain#0 pay#0 teach#0 sing#0 whisper#0 suggest#0 suggest#1
  mention#0 describe#0 reveal#0 report#0 lend#0 promise#0 prove#0 sell#0 deliver#0`.split(/\s+/)
);

/** ...and verbs whose object can only be a person. */
const PERSON_ONLY = new Set("invite#0 persuade#0 persuade#1 warn#0 inform#0 meet#0 introduce#0 help#0".split(" "));

/** Object pronoun that would mean the subject itself (I ... me): avoided, that's a reflexive. */
const OWN_OBJECT: Partial<Record<SubjectId, ObjectPronoun>> = { i: "me", we: "us", you: "you" };

const EN_WORD: Record<ObjectPronoun, string> = {
  me: "me", you: "you", him: "him", her: "her", "it-m": "it", "it-f": "it",
  us: "us", "you-pl": "you", "them-m": "them", "them-f": "them",
};

/** English words for a set of objects, used as a note: "it to her", "him", "to her". */
function englishObjects(o: ObjectOptions): string {
  if (o.object && o.indirectObject) return `${EN_WORD[o.object]} to ${EN_WORD[o.indirectObject]}`;
  if (o.object) return EN_WORD[o.object];
  return `to ${EN_WORD[o.indirectObject!]}`;
}

const gender = (p: ObjectPronoun) => (p.endsWith("-f") ? "f." : "m.");

/**
 * Adds gender notes to "it"/"them" in an English hint, since Portuguese needs it:
 * "gave it to her" -> "gave it (m.) to her".
 */
function markGender(text: string, o: ObjectOptions, answerLang: Language): string {
  const marks: ObjectPronoun[] = [];
  // it/them: o/a (Portugal), ele/ela (Brazil). Brazil leaves out a thing that is given
  // to someone ("eu dei pra ela"), so no gender is needed then.
  const thingDropped = answerLang === "pt-br" && !!o.indirectObject;
  if (o.object && /^(it|them)-/.test(o.object) && !thingDropped) marks.push(o.object);
  // "(to) them" only needs a gender in Brazil, where it becomes "pra eles" / "pra elas"
  if (o.indirectObject?.startsWith("them-") && answerLang === "pt-br") marks.push(o.indirectObject);
  let from = 0;
  for (const m of marks) {
    const word = EN_WORD[m];
    const re = new RegExp(`\\b${word}\\b`, "g");
    re.lastIndex = from;
    const hit = re.exec(text);
    if (!hit) continue;
    const note = ` (${gender(m)})`;
    text = text.slice(0, hit.index + word.length) + note + text.slice(hit.index + word.length);
    from = hit.index + word.length + note.length;
  }
  return text;
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
    vocab = [],
    pairs,
    maxLength,
    minLength = 3,
    count = 300,
    dropSubjectChance = 0.5,
    objectPronouns = true,
    indirectObjectPronouns = true,
    objectChance = 0.5,
    subjunctive = false,
    subjunctiveChance = 0.5,
    rnd = Math.random,
  } = opts;

  const langPairs = languagePairs(languages);
  if (langPairs.length === 0) throw new Error("Choose at least two languages in Settings.");
  const subjectList = SUBJECTS.filter((s) => subjects.includes(s.id));
  if (verbs.length === 0 && vocab.length === 0) {
    throw new Error("Turn on at least one word in the Dictionary.");
  }
  if (verbs.length > 0) {
    if (subjectList.length === 0) throw new Error("Choose at least one subject in Settings.");
    if (pairs.length === 0) throw new Error("Pick at least one tense and one aspect.");
  }

  const ambiguous = ambiguityMaps(verbs, langPairs);
  const vocabAmbiguous = vocabAmbiguity(vocab, langPairs);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const entries: WordEntry[] = [];
  const seen = new Set<string>();

  // keeps an entry if it fits the grid and isn't a repeat
  const accept = (entry: WordEntry) => {
    const answer = toAnswer(entry.word);
    if (answer.length < minLength || answer.length > maxLength || seen.has(answer)) return;
    seen.add(answer);
    entries.push(entry);
  };

  for (let tries = 0; entries.length < count && tries < count * 20; tries++) {
    // pick verbs and other words in proportion to how many of each are on
    if (vocab.length && rnd() * (verbs.length + vocab.length) < vocab.length) {
      const entry = vocabClue(pick(vocab), pick(langPairs), rnd, vocabAmbiguous);
      if (entry) accept(entry);
      continue;
    }

    const sense = pick(verbs);
    const pair = pick(pairs);
    const subject = pick(subjectList);
    const [hintLang, answerLang] = pick(langPairs);

    // object pronouns, for verbs that take them: each kind about half the time
    let objects: ObjectOptions = {};
    let objectSets: { direct: ObjectPronoun[] | null; indirect: ObjectPronoun[] | null } | null = null;
    if (!sense.reflexive) {
      const own = OWN_OBJECT[subject.id];
      const people = PERSON_OPTIONS.filter((p) => p !== own);
      // direct objects on their own: people only for verbs that take people, and
      // no abstract "it" (see ABSTRACT_OBJECT)
      const directAlone = PERSON_ONLY.has(sense.id)
        ? people
        : [
            ...(PERSON_OBJECT.has(sense.id) ? people : []),
            ...(ABSTRACT_OBJECT.has(sense.id) ? [] : THING_OPTIONS),
          ];
      const useDirect = objectPronouns && sense.directObject && rnd() < objectChance;
      // "introduce" takes a person, not a thing, so it doesn't get an indirect object here
      const useIndirect =
        indirectObjectPronouns && sense.indirectObject && !PERSON_ONLY.has(sense.id) && rnd() < objectChance;

      if (useDirect && useIndirect) {
        // with an indirect object the direct one is a thing: I gave *it* to her
        objectSets = { direct: THING_OPTIONS, indirect: people };
      } else if (useDirect && directAlone.length) {
        objectSets = { direct: directAlone, indirect: null };
      } else if (useIndirect && INDIRECT_ALONE.has(sense.id)) {
        objectSets = { direct: null, indirect: people };
      }
      if (objectSets) {
        objects = {
          object: objectSets.direct ? pick(objectSets.direct) : undefined,
          indirectObject: objectSets.indirect ? pick(objectSets.indirect) : undefined,
        };
      }
    }

    const mood: Mood = subjunctive && rnd() < subjunctiveChance ? "subjunctive" : "indicative";
    // English can't drop the subject after that / if / when ("that laugh")
    const drop = rnd() < dropSubjectChance && !(mood === "subjunctive" && answerLang === "en");
    // subjunctive phrases start with their conjunction: que eu ande / that I walk
    const conjunction = (lang: Language) =>
      mood === "subjunctive" ? (lang === "en" ? EN_CONJUNCTIONS : PT_CONJUNCTIONS)[pair[0]] + " " : "";

    const subjectFor = (lang: Language) => (lang === "en" ? subject.en : subject[lang]);
    const conj = (lang: Language, o: ObjectOptions) =>
      predicate(lang, sense[lang], pair, subjectFor(lang), o, mood);

    let hintPred: string;
    let answerPred: string;
    try {
      hintPred = conj(hintLang, objects);
      answerPred = conj(answerLang, objects);
    } catch {
      continue;
    }

    let objectNote = "";
    if (objectSets && hintLang === "en") {
      hintPred = markGender(hintPred, objects, answerLang);
    } else if (objectSets) {
      // does another choice of pronouns give the same hint but a different answer?
      // (o = him or it, lhe = him or her...) then say which is meant
      const directs: (ObjectPronoun | undefined)[] = objectSets.direct ?? [undefined];
      const indirects: (ObjectPronoun | undefined)[] = objectSets.indirect ?? [undefined];
      const alternatives: ObjectOptions[] = directs.flatMap((d) =>
        indirects.map((i) => ({ object: d, indirectObject: i }))
      );
      const clash = alternatives.some((alt) => {
        if (alt.object === objects.object && alt.indirectObject === objects.indirectObject) return false;
        try {
          return conj(hintLang, alt) === hintPred && toAnswer(conj(answerLang, alt)) !== toAnswer(answerPred);
        } catch {
          return false;
        }
      });
      if (clash) objectNote = ` (${englishObjects(objects)})`;
    }

    const answerSubject = answerLang === "en" ? subject.en : subject[answerLang];
    const word = conjunction(answerLang) + (drop ? answerPred : `${answerSubject} ${answerPred}`);
    let hint = `${conjunction(hintLang)}${subjectText(subject, hintLang, drop)} ${hintPred}${objectNote}`;
    // English barely marks the subjunctive ("when I walk" looks indicative), so say it
    if (mood === "subjunctive" && hintLang === "en") hint += " (subjunctive)";

    // nothing to translate (e.g. Brazil and Portugal spell it the same)
    if (toAnswer(hintPred) === toAnswer(answerPred)) continue;

    // the hint verb has several translations here: say which one is meant
    const targets = ambiguous.get(`${hintLang}>${answerLang}`)?.get(sense[hintLang]);
    if (targets && targets.size > 1) {
      hint += answerLang === "en" ? ` — to ${sense.en}` : ` — ${sense.sense ?? sense[answerLang]}`;
    }

    accept({
      word,
      hint,
      languageOrigin: answerLang,
      hintLanguageOrigin: hintLang,
      partOfSpeech: "verb",
      verbTense: `${mood === "subjunctive" ? "subjunctive " : ""}${pair[0]} ${pair[1]}`,
      ...enumerate(word),
    });
  }
  return entries;
}

/* ---------------- other vocabulary ---------------- */

/** How a vocabulary entry reads in one language (nouns with their article). */
function vocabText(entry: VocabEntry, lang: Language, gender: "m" | "f"): string {
  if (entry.type === "adjective" && lang !== "en") return adjectiveForm(entry, lang, gender);
  return withArticle(entry, lang);
}

/**
 * For each hint -> answer language pair: clue text -> the different answers it could
 * have. A clue with more than one answer gets the entry's sense note.
 */
function vocabAmbiguity(vocab: VocabEntry[], pairs: [Language, Language][]) {
  const maps = new Map<string, Map<string, Set<string>>>();
  for (const [from, to] of pairs) {
    const map = new Map<string, Set<string>>();
    for (const e of vocab) {
      const key = `${e.type}|${e[from]}`;
      const set = map.get(key) ?? new Set<string>();
      set.add(e[to]);
      map.set(key, set);
    }
    maps.set(`${from}>${to}`, map);
  }
  return maps;
}

function vocabClue(
  entry: VocabEntry,
  [hintLang, answerLang]: [Language, Language],
  rnd: () => number,
  ambiguous: Map<string, Map<string, Set<string>>>
): WordEntry | null {
  // adjectives come in either gender; English needs a note when the forms differ
  let gender: "m" | "f" = "m";
  let genderNote = "";
  if (entry.type === "adjective" && entry.feminine) {
    gender = rnd() < 0.5 ? "f" : "m";
    const differs = (lang: Language) => lang !== "en" && entry.feminine![lang] !== entry[lang];
    if (hintLang === "en" && differs(answerLang)) genderNote = ` (${gender}.)`;
  }

  const hintText = vocabText(entry, hintLang, gender);
  const word = vocabText(entry, answerLang, gender);
  if (toAnswer(hintText) === toAnswer(word)) return null; // same in both (e.g. BR and PT)

  let hint = hintText + genderNote;
  const answers = ambiguous.get(`${hintLang}>${answerLang}`)?.get(`${entry.type}|${entry[hintLang]}`);
  if (answers && answers.size > 1 && entry.sense) hint += ` — ${entry.sense}`;

  return {
    word,
    hint,
    languageOrigin: answerLang,
    hintLanguageOrigin: hintLang,
    partOfSpeech: entry.type,
    ...enumerate(word),
  };
}
