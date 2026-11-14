/**
 * English verb conjugator.
 *
 * Example:
 *   conjugate("walk", [["past", "continuous"], ["present", "perfect"]], ["I", "he"]);
 *   // {
 *   //   verb: "walk",
 *   //   conjugations: [
 *   //     { past: [{ continuous: ["I was walking", "he was walking"] }] },
 *   //     { present: [{ perfect: ["I have walked", "he has walked"] }] },
 *   //   ],
 *   // }
 */

export type Tense = "past" | "present" | "future";
export type Aspect = "simple" | "continuous" | "perfect" | "perfectContinuous";

export type TenseAspectPair =
  | [Tense, Aspect]
  | { tense: Tense; aspect: Aspect };

export type TenseConjugations = {
  [T in Tense]?: Array<{ [A in Aspect]?: string[] }>;
};

export interface ConjugationResult {
  verb: string;
  conjugations: TenseConjugations[];
}

export const DEFAULT_SUBJECTS = ["I", "you", "he", "she", "it", "we", "they"];

const TENSES: Tense[] = ["past", "present", "future"];
const ASPECTS: Aspect[] = ["simple", "continuous", "perfect", "perfectContinuous"];

/* ------------------------------------------------------------------ */
/* Irregular verbs: base -> [simple past, past participle]            */
/* ------------------------------------------------------------------ */

const IRREGULAR: Record<string, [string, string]> = {
  arise: ["arose", "arisen"],
  awake: ["awoke", "awoken"],
  be: ["was", "been"], // handled specially for person agreement
  bear: ["bore", "borne"],
  beat: ["beat", "beaten"],
  become: ["became", "become"],
  begin: ["began", "begun"],
  bend: ["bent", "bent"],
  bet: ["bet", "bet"],
  bind: ["bound", "bound"],
  bite: ["bit", "bitten"],
  bleed: ["bled", "bled"],
  blow: ["blew", "blown"],
  break: ["broke", "broken"],
  breed: ["bred", "bred"],
  bring: ["brought", "brought"],
  build: ["built", "built"],
  burn: ["burnt", "burnt"],
  burst: ["burst", "burst"],
  buy: ["bought", "bought"],
  cast: ["cast", "cast"],
  catch: ["caught", "caught"],
  choose: ["chose", "chosen"],
  cling: ["clung", "clung"],
  come: ["came", "come"],
  cost: ["cost", "cost"],
  creep: ["crept", "crept"],
  cut: ["cut", "cut"],
  deal: ["dealt", "dealt"],
  dig: ["dug", "dug"],
  do: ["did", "done"],
  draw: ["drew", "drawn"],
  dream: ["dreamt", "dreamt"],
  drink: ["drank", "drunk"],
  drive: ["drove", "driven"],
  eat: ["ate", "eaten"],
  fall: ["fell", "fallen"],
  feed: ["fed", "fed"],
  feel: ["felt", "felt"],
  fight: ["fought", "fought"],
  find: ["found", "found"],
  flee: ["fled", "fled"],
  fling: ["flung", "flung"],
  fly: ["flew", "flown"],
  forbid: ["forbade", "forbidden"],
  forget: ["forgot", "forgotten"],
  forgive: ["forgave", "forgiven"],
  freeze: ["froze", "frozen"],
  get: ["got", "gotten"],
  give: ["gave", "given"],
  go: ["went", "gone"],
  grind: ["ground", "ground"],
  grow: ["grew", "grown"],
  hang: ["hung", "hung"],
  have: ["had", "had"],
  hear: ["heard", "heard"],
  hide: ["hid", "hidden"],
  hit: ["hit", "hit"],
  hold: ["held", "held"],
  hurt: ["hurt", "hurt"],
  keep: ["kept", "kept"],
  kneel: ["knelt", "knelt"],
  know: ["knew", "known"],
  lay: ["laid", "laid"],
  lead: ["led", "led"],
  leap: ["leapt", "leapt"],
  learn: ["learnt", "learnt"],
  leave: ["left", "left"],
  lend: ["lent", "lent"],
  let: ["let", "let"],
  lie: ["lay", "lain"],
  light: ["lit", "lit"],
  lose: ["lost", "lost"],
  make: ["made", "made"],
  mean: ["meant", "meant"],
  meet: ["met", "met"],
  overcome: ["overcame", "overcome"],
  pay: ["paid", "paid"],
  put: ["put", "put"],
  quit: ["quit", "quit"],
  read: ["read", "read"],
  rid: ["rid", "rid"],
  ride: ["rode", "ridden"],
  ring: ["rang", "rung"],
  rise: ["rose", "risen"],
  run: ["ran", "run"],
  say: ["said", "said"],
  see: ["saw", "seen"],
  seek: ["sought", "sought"],
  sell: ["sold", "sold"],
  send: ["sent", "sent"],
  set: ["set", "set"],
  sew: ["sewed", "sewn"],
  shake: ["shook", "shaken"],
  shed: ["shed", "shed"],
  shine: ["shone", "shone"],
  shoot: ["shot", "shot"],
  show: ["showed", "shown"],
  shrink: ["shrank", "shrunk"],
  shut: ["shut", "shut"],
  sing: ["sang", "sung"],
  sink: ["sank", "sunk"],
  sit: ["sat", "sat"],
  sleep: ["slept", "slept"],
  slide: ["slid", "slid"],
  speak: ["spoke", "spoken"],
  speed: ["sped", "sped"],
  spend: ["spent", "spent"],
  spin: ["spun", "spun"],
  split: ["split", "split"],
  spread: ["spread", "spread"],
  spring: ["sprang", "sprung"],
  stand: ["stood", "stood"],
  steal: ["stole", "stolen"],
  stick: ["stuck", "stuck"],
  sting: ["stung", "stung"],
  stink: ["stank", "stunk"],
  strike: ["struck", "struck"],
  swear: ["swore", "sworn"],
  sweep: ["swept", "swept"],
  swim: ["swam", "swum"],
  swing: ["swung", "swung"],
  take: ["took", "taken"],
  teach: ["taught", "taught"],
  tear: ["tore", "torn"],
  tell: ["told", "told"],
  think: ["thought", "thought"],
  throw: ["threw", "thrown"],
  understand: ["understood", "understood"],
  undo: ["undid", "undone"],
  wake: ["woke", "woken"],
  wear: ["wore", "worn"],
  weave: ["wove", "woven"],
  weep: ["wept", "wept"],
  win: ["won", "won"],
  wind: ["wound", "wound"],
  withdraw: ["withdrew", "withdrawn"],
  write: ["wrote", "written"],
};

/**
 * Multi-syllable verbs whose final consonant doubles (stress on last syllable).
 * Single-syllable CVC verbs (stop, plan, hug) are doubled automatically.
 * Other multi-syllable verbs (visit, open, listen) are not doubled.
 */
const DOUBLING_MULTISYLLABLE = new Set([
  "admit", "begin", "commit", "compel", "confer", "control", "defer", "deter",
  "equip", "excel", "expel", "forget", "occur", "omit", "outwit", "patrol",
  "permit", "prefer", "propel", "rebel", "recur", "refer", "regret", "remit",
  "repel", "submit", "transfer", "transmit", "underwrite", "upset", "unwrap",
  "unzip", "overrun", "outrun", "rebut", "refit", "format", "program",
  "handicap", "kidnap", "worship", "travel", "cancel", "label", "model",
  "level", "signal", "total", "fuel",
]);

/* ------------------------------------------------------------------ */
/* Spelling helpers                                                    */
/* ------------------------------------------------------------------ */

const isVowel = (c: string | undefined): boolean => !!c && /[aeiou]/.test(c);

function countSyllables(word: string): number {
  const groups = word.match(/[aeiouy]+/g);
  if (!groups) return 1;
  let n = groups.length;
  // silent trailing "e" (make, hope) but not "le" (table) or "ee"
  if (/[^aeiouy]e$/.test(word) && !/le$/.test(word)) n--;
  return Math.max(1, n);
}

/** Does the final consonant double before -ed / -ing? */
function shouldDouble(verb: string): boolean {
  const len = verb.length;
  if (len < 2) return false;
  const [c3, c2, c1] = [verb[len - 3], verb[len - 2], verb[len - 1]];
  // must end consonant-vowel-consonant, last consonant not w/x/y
  if (isVowel(c1) || /[wxy]/.test(c1) || !isVowel(c2) || isVowel(c3)) {
    // handle 2-letter verbs like "go"/"do": not CVC
    if (!(len === 3 && !isVowel(c3) && isVowel(c2) && !isVowel(c1) && !/[wxy]/.test(c1))) {
      return false;
    }
  }
  // "qu" counts as one consonant (quit -> quitting): c3 === "u" after q
  if (c3 === "u" && verb[len - 4] === "q") {
    return countSyllables(verb) === 1 || DOUBLING_MULTISYLLABLE.has(verb);
  }
  if (countSyllables(verb) === 1) return true;
  return DOUBLING_MULTISYLLABLE.has(verb);
}

function toIng(verb: string): string {
  if (verb === "be") return "being";
  if (verb.endsWith("ie")) return verb.slice(0, -2) + "ying"; // lie -> lying
  if (/[^aeiouy]e$/.test(verb) || /ue$/.test(verb)) return verb.slice(0, -1) + "ing"; // make -> making
  if (verb.endsWith("ic")) return verb + "king"; // picnic -> picnicking
  if (shouldDouble(verb)) return verb + verb[verb.length - 1] + "ing";
  return verb + "ing";
}

function regularPast(verb: string): string {
  if (verb.endsWith("e")) return verb + "d";
  if (/[^aeiou]y$/.test(verb)) return verb.slice(0, -1) + "ied";
  if (verb.endsWith("ic")) return verb + "ked";
  if (shouldDouble(verb)) return verb + verb[verb.length - 1] + "ed";
  return verb + "ed";
}

function thirdPersonSingular(verb: string): string {
  if (verb === "have") return "has";
  if (verb === "be") return "is";
  if (/(s|x|z|ch|sh|o)$/.test(verb)) return verb + "es";
  if (/[^aeiou]y$/.test(verb)) return verb.slice(0, -1) + "ies";
  return verb + "s";
}

function pastForms(verb: string): { past: string; participle: string } {
  const irregular = IRREGULAR[verb];
  if (irregular) return { past: irregular[0], participle: irregular[1] };
  const regular = regularPast(verb);
  return { past: regular, participle: regular };
}

/* ------------------------------------------------------------------ */
/* Subjects                                                            */
/* ------------------------------------------------------------------ */

type Person = "1s" | "2" | "3s" | "1p" | "3p";

function personOf(subject: string): Person {
  const s = subject.trim().toLowerCase();
  if (s === "i") return "1s";
  if (s === "you" || s === "y'all" || s === "you all") return "2";
  if (s === "we") return "1p";
  if (s === "they" || / and /.test(s)) return "3p";
  // he, she, it, one, and any other noun phrase default to 3rd singular
  return "3s";
}

/* ------------------------------------------------------------------ */
/* Auxiliaries                                                         */
/* ------------------------------------------------------------------ */

/** Conjugated "be" for a tense and person. */
function auxBe(tense: Tense, person: Person): string {
  if (tense === "future") return "will be";
  if (tense === "present") {
    if (person === "1s") return "am";
    if (person === "3s") return "is";
    return "are";
  }
  return person === "1s" || person === "3s" ? "was" : "were";
}

/** Conjugated "have" (perfect auxiliary) for a tense and person. */
function auxHave(tense: Tense, person: Person): string {
  if (tense === "future") return "will have";
  if (tense === "past") return "had";
  return person === "3s" ? "has" : "have";
}

/* ------------------------------------------------------------------ */
/* Core                                                                */
/* ------------------------------------------------------------------ */

function buildPredicate(
  base: string,
  particle: string,
  tense: Tense,
  aspect: Aspect,
  person: Person
): string {
  const ing = toIng(base);
  const { past, participle } = pastForms(base);
  let words: string;

  switch (aspect) {
    case "simple":
      if (tense === "future") {
        words = `will ${base}`;
      } else if (tense === "present") {
        if (base === "be") {
          words = auxBe("present", person);
        } else {
          words = person === "3s" ? thirdPersonSingular(base) : base;
        }
      } else if (base === "be") {
        words = auxBe("past", person);
      } else {
        words = past;
      }
      break;
    case "continuous":
      words = `${auxBe(tense, person)} ${ing}`;
      break;
    case "perfect":
      words = `${auxHave(tense, person)} ${participle}`;
      break;
    case "perfectContinuous":
      words = `${auxHave(tense, person)} been ${ing}`;
      break;
  }

  return particle ? `${words} ${particle}` : words;
}

function normalizePair(pair: TenseAspectPair): [Tense, Aspect] {
  const [tense, aspect] = Array.isArray(pair) ? pair : [pair.tense, pair.aspect];
  if (!TENSES.includes(tense)) {
    throw new Error(`Invalid tense "${tense}". Expected one of: ${TENSES.join(", ")}`);
  }
  if (!ASPECTS.includes(aspect)) {
    throw new Error(`Invalid aspect "${aspect}". Expected one of: ${ASPECTS.join(", ")}`);
  }
  return [tense, aspect];
}

/**
 * Conjugate an English verb.
 *
 * @param verb          Base-form verb. Phrasal verbs work too ("give up").
 * @param tenseAspects  Pairs such as ["past", "continuous"].
 * @param subjects      Optional list of subjects. Defaults to I, you, he, she, it, we, they.
 */
export function conjugate(
  verb: string,
  tenseAspects: TenseAspectPair[],
  subjects: string[] = DEFAULT_SUBJECTS
): ConjugationResult {
  const cleaned = verb.trim().toLowerCase();
  if (!cleaned) throw new Error("A verb is required.");

  // Support phrasal verbs: conjugate the first word, keep the particle(s).
  const [base, ...rest] = cleaned.split(/\s+/);
  const particle = rest.join(" ");

  const conjugations: TenseConjugations[] = [];

  for (const pair of tenseAspects) {
    const [tense, aspect] = normalizePair(pair);

    const forms = subjects.map(
      (subject) =>
        `${subject} ${buildPredicate(base, particle, tense, aspect, personOf(subject))}`
    );

    // Group under the tense, preserving first-seen order.
    let entry = conjugations.find((c) => c[tense] !== undefined);
    if (!entry) {
      entry = { [tense]: [] };
      conjugations.push(entry);
    }
    entry[tense]!.push({ [aspect]: forms });
  }

  return { verb: cleaned, conjugations };
}
