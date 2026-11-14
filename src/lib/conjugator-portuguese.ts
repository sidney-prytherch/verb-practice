/**
 * Shared Portuguese conjugation engine (Brazil + Portugal). Same input/output shape and
 * types as conjugator.ts.
 *
 * Most people should import one of the thin wrappers instead of this file:
 *   - conjugator-br.ts  (Brazilian Portuguese)
 *   - conjugator-pt.ts  (European Portuguese)
 *
 * Example:
 *   conjugate("andar", [["past", "continuous"], ["present", "perfect"]], ["eu", "ele"]);
 *   // {
 *   //   verb: "andar",
 *   //   conjugations: [
 *   //     { past:    [{ continuous: ["eu estava andando", "ele estava andando"] }] },
 *   //     { present: [{ perfect:    ["eu tenho andado",   "ele tem andado"] }] },
 *   //   ],
 *   // }
 *
 * How the English tense/aspect pairs map onto Portuguese (indicative mood):
 *
 *            simple                    continuous                 perfect                 perfectContinuous
 *   present  presente (ando)           estar + gerúndio           ter + particípio        ter estado + gerúndio
 *   past     pretérito perfeito        estar (imperfeito) + ger.  ter (imperfeito) + part. ter (imperfeito) estado + ger.
 *            (andei)                   (estava andando)           (tinha andado)          (tinha estado andando)
 *   future   futuro do presente        estar (futuro) + ger.      ter (futuro) + part.    ter (futuro) estado + ger.
 *            (andarei)                 (estarei andando)          (terei andado)          (terei estado andando)
 *
 * Notes:
 *  - "past simple" is the pretérito perfeito (andei). The imperfeito (andava) has no
 *    English-style pair, so it is only used inside the auxiliaries (estava, tinha).
 *  - Present perfect with "ter" implies repetition up to now (tenho andado), which is
 *    the closest Portuguese equivalent of the English present perfect.
 *  - Reflexive verbs: pass "levantar-se" (also "se levantar" or "levantar se"). The pronoun
 *    agrees with the subject (me, te, se, nos, vos, se) and is placed per variant:
 *      br: before the verb      -> eu me levanto, eu estou me levantando, eu tenho me levantado
 *      pt: after it, hyphenated -> eu levanto-me, nós levantámo-nos, eu estou a levantar-me,
 *                                  eu tenho-me levantado, and mesoclisis in the simple
 *                                  future -> eu levantar-me-ei
 *  - Options: { variant: "br" | "pt" }. "br" (default) uses the gerund (estou andando),
 *    "amos" in the preterite and você/vocês in the default subjects; "pt" uses
 *    "a + infinitive" (estou a andar), "ámos" and tu/vocês in the default subjects.
 */

import type {
  Tense,
  Aspect,
  TenseAspectPair,
  TenseConjugations,
  ConjugationResult,
} from "./conjugator";

export type { Tense, Aspect, TenseAspectPair, TenseConjugations, ConjugationResult };

export type PortugueseVariant = "br" | "pt";

export interface PortugueseOptions {
  variant?: PortugueseVariant;
}

export const DEFAULT_SUBJECTS_BY_VARIANT: Record<PortugueseVariant, string[]> = {
  br: ["eu", "você", "ele", "ela", "nós", "vocês", "eles", "elas"],
  pt: ["eu", "tu", "ele", "ela", "nós", "vocês", "eles", "elas"],
};

const TENSES: Tense[] = ["past", "present", "future"];
const ASPECTS: Aspect[] = ["simple", "continuous", "perfect", "perfectContinuous"];

/* ------------------------------------------------------------------ */
/* Types and small helpers                                             */
/* ------------------------------------------------------------------ */

/** Six forms in this order: eu, tu, ele/ela/você, nós, vós, eles/elas/vocês. */
type Forms = [string, string, string, string, string, string];
type Person = 0 | 1 | 2 | 3 | 4 | 5;
type Conjugation = "ar" | "er" | "ir";

interface Irregular {
  present: Forms;
  preterite: Forms;
  /** Stem the future endings attach to (defaults to the infinitive). */
  future?: string;
  gerund?: string;
  participle?: string;
}

interface VerbForms {
  infinitive: string;
  present: Forms;
  preterite: Forms;
  future: Forms;
  /** What the future endings attach to (infinitive, or e.g. "dir" for dizer). */
  futureStem: string;
  gerund: string;
  participle: string;
}

const has = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

/** Indexes (eu, tu, ele, eles) that carry the stress in the present tense. */
const STRESSED: Person[] = [0, 1, 2, 5];

/* ------------------------------------------------------------------ */
/* Irregular verbs                                                     */
/* ------------------------------------------------------------------ */

const IRREGULAR: Record<string, Irregular> = {
  ser: {
    present: ["sou", "és", "é", "somos", "sois", "são"],
    preterite: ["fui", "foste", "foi", "fomos", "fostes", "foram"],
    gerund: "sendo",
    participle: "sido",
  },
  ir: {
    present: ["vou", "vais", "vai", "vamos", "ides", "vão"],
    preterite: ["fui", "foste", "foi", "fomos", "fostes", "foram"],
    gerund: "indo",
    participle: "ido",
  },
  estar: {
    present: ["estou", "estás", "está", "estamos", "estais", "estão"],
    preterite: ["estive", "estiveste", "esteve", "estivemos", "estivestes", "estiveram"],
    gerund: "estando",
    participle: "estado",
  },
  ter: {
    present: ["tenho", "tens", "tem", "temos", "tendes", "têm"],
    preterite: ["tive", "tiveste", "teve", "tivemos", "tivestes", "tiveram"],
    gerund: "tendo",
    participle: "tido",
  },
  haver: {
    present: ["hei", "hás", "há", "havemos", "haveis", "hão"],
    preterite: ["houve", "houveste", "houve", "houvemos", "houvestes", "houveram"],
    gerund: "havendo",
    participle: "havido",
  },
  dar: {
    present: ["dou", "dás", "dá", "damos", "dais", "dão"],
    preterite: ["dei", "deste", "deu", "demos", "destes", "deram"],
    gerund: "dando",
    participle: "dado",
  },
  ver: {
    present: ["vejo", "vês", "vê", "vemos", "vedes", "veem"],
    preterite: ["vi", "viste", "viu", "vimos", "vistes", "viram"],
    gerund: "vendo",
    participle: "visto",
  },
  vir: {
    present: ["venho", "vens", "vem", "vimos", "vindes", "vêm"],
    preterite: ["vim", "vieste", "veio", "viemos", "viestes", "vieram"],
    gerund: "vindo",
    participle: "vindo",
  },
  ler: {
    present: ["leio", "lês", "lê", "lemos", "ledes", "leem"],
    preterite: ["li", "leste", "leu", "lemos", "lestes", "leram"],
    gerund: "lendo",
    participle: "lido",
  },
  crer: {
    present: ["creio", "crês", "crê", "cremos", "credes", "creem"],
    preterite: ["cri", "creste", "creu", "cremos", "crestes", "creram"],
    gerund: "crendo",
    participle: "crido",
  },
  rir: {
    present: ["rio", "ris", "ri", "rimos", "rides", "riem"],
    preterite: ["ri", "riste", "riu", "rimos", "ristes", "riram"],
    gerund: "rindo",
    participle: "rido",
  },
  saber: {
    present: ["sei", "sabes", "sabe", "sabemos", "sabeis", "sabem"],
    preterite: ["soube", "soubeste", "soube", "soubemos", "soubestes", "souberam"],
  },
  poder: {
    present: ["posso", "podes", "pode", "podemos", "podeis", "podem"],
    preterite: ["pude", "pudeste", "pôde", "pudemos", "pudestes", "puderam"],
  },
  querer: {
    present: ["quero", "queres", "quer", "queremos", "quereis", "querem"],
    preterite: ["quis", "quiseste", "quis", "quisemos", "quisestes", "quiseram"],
  },
  caber: {
    present: ["caibo", "cabes", "cabe", "cabemos", "cabeis", "cabem"],
    preterite: ["coube", "coubeste", "coube", "coubemos", "coubestes", "couberam"],
  },
  fazer: {
    present: ["faço", "fazes", "faz", "fazemos", "fazeis", "fazem"],
    preterite: ["fiz", "fizeste", "fez", "fizemos", "fizestes", "fizeram"],
    future: "far",
    gerund: "fazendo",
    participle: "feito",
  },
  dizer: {
    present: ["digo", "dizes", "diz", "dizemos", "dizeis", "dizem"],
    preterite: ["disse", "disseste", "disse", "dissemos", "dissestes", "disseram"],
    future: "dir",
    gerund: "dizendo",
    participle: "dito",
  },
  trazer: {
    present: ["trago", "trazes", "traz", "trazemos", "trazeis", "trazem"],
    preterite: ["trouxe", "trouxeste", "trouxe", "trouxemos", "trouxestes", "trouxeram"],
    future: "trar",
    gerund: "trazendo",
    participle: "trazido",
  },
  pôr: {
    present: ["ponho", "pões", "põe", "pomos", "pondes", "põem"],
    preterite: ["pus", "puseste", "pôs", "pusemos", "pusestes", "puseram"],
    future: "por",
    gerund: "pondo",
    participle: "posto",
  },
};

/** Prefixes that form compounds of an irregular root (e.g. man+ter = manter). */
const COMPOUND_PREFIXES: Record<string, string[]> = {
  ter: ["man", "con", "ob", "de", "re", "abs", "entre", "a"],
  vir: ["con", "inter", "ad", "pro", "sobre"],
  ver: ["pre", "re", "ante", "entre"],
  pôr: ["com", "dis", "ex", "im", "o", "pro", "re", "su", "de", "trans", "pos", "ante", "justa", "sobre", "contra"],
  fazer: ["des", "re", "satis", "contra"],
  dizer: ["des", "pre", "contra", "inter", "mal", "ben"],
  ler: ["re"],
  crer: ["des"],
  rir: ["sor"],
};

/** Compounds of ter/vir carry accents in tu/ele/eles: mantém, convéns, mantêm. */
const ACCENTED_COMPOUND_PRESENT: Record<string, (prefix: string) => Forms> = {
  ter: (p) => [p + "tenho", p + "téns", p + "tém", p + "temos", p + "tendes", p + "têm"],
  vir: (p) => [p + "venho", p + "véns", p + "vém", p + "vimos", p + "vindes", p + "vêm"],
};

const COMPOUND_INDEX = new Map<string, { root: string; prefix: string }>();
for (const [root, prefixes] of Object.entries(COMPOUND_PREFIXES)) {
  const key = root === "pôr" ? "por" : root;
  for (const prefix of prefixes) COMPOUND_INDEX.set(prefix + key, { root, prefix });
}

function resolveIrregular(verb: string): Irregular | undefined {
  if (has(IRREGULAR, verb)) return IRREGULAR[verb];
  const compound = COMPOUND_INDEX.get(verb);
  if (!compound) return undefined;

  const { root, prefix } = compound;
  const base = IRREGULAR[root];
  const pre = (forms: Forms): Forms => forms.map((f) => prefix + f) as Forms;

  return {
    present: has(ACCENTED_COMPOUND_PRESENT, root)
      ? ACCENTED_COMPOUND_PRESENT[root](prefix)
      : pre(base.present),
    preterite: pre(base.preterite),
    future: base.future ? prefix + base.future : undefined,
    gerund: base.gerund ? prefix + base.gerund : undefined,
    participle: base.participle ? prefix + base.participle : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Irregularities of otherwise regular verbs                           */
/* ------------------------------------------------------------------ */

/** Verbs whose stem vowel e becomes i in "eu" (pedir-type): sentir -> sinto. */
const E_TO_I_EU = new Set([
  "vestir", "revestir", "investir", "sentir", "consentir", "ressentir", "mentir",
  "desmentir", "servir", "repetir", "divertir", "despir", "ferir", "competir",
  "refletir", "sugerir", "digerir", "preferir", "aderir", "advertir", "seguir",
  "conseguir", "perseguir", "prosseguir", "agredir", "progredir", "regredir",
  "transgredir", "prevenir",
]);

/** Other irregular "eu" forms in the present. */
const PRESENT_EU: Record<string, string> = {
  pedir: "peço", despedir: "despeço", impedir: "impeço", expedir: "expeço",
  medir: "meço", ouvir: "ouço", perder: "perco", valer: "valho",
  equivaler: "equivalho", dormir: "durmo", cobrir: "cubro", descobrir: "descubro",
  encobrir: "encubro", recobrir: "recubro", engolir: "engulo", tossir: "tusso",
};

/** Verbs whose stem vowel changes (u -> o) in tu/ele/eles: subir -> sobes. */
const STRESSED_STEM: Record<string, string> = {
  subir: "sob", sumir: "som", consumir: "consom", fugir: "fog", sacudir: "sacod",
  acudir: "acod", cuspir: "cosp", bulir: "bol", escapulir: "escapol",
};

/** -iar verbs that take -ei- in stressed forms: odiar -> odeio. */
const MARIO = new Set(["mediar", "ansiar", "remediar", "incendiar", "odiar", "intermediar"]);

/** -uir verbs with "constróis": construir, destruir. */
const CONSTRUIR = new Set(["construir", "destruir", "reconstruir"]);

/** Short (irregular) past participles in common use. */
const SHORT_PARTICIPLES: Record<string, string> = {
  ganhar: "ganho", gastar: "gasto", pagar: "pago", pegar: "pego",
  morrer: "morto", imprimir: "impresso", eleger: "eleito",
};

/** Participles by verb ending: reabrir -> reaberto, descrever -> descrito. */
const PARTICIPLE_SUFFIXES: Array<[string, string]> = [
  ["abrir", "aberto"],
  ["cobrir", "coberto"],
  ["screver", "scrito"],
];

/* ------------------------------------------------------------------ */
/* Regular conjugation                                                 */
/* ------------------------------------------------------------------ */

const PRESENT_ENDINGS: Record<Conjugation, Forms> = {
  ar: ["o", "as", "a", "amos", "ais", "am"],
  er: ["o", "es", "e", "emos", "eis", "em"],
  ir: ["o", "es", "e", "imos", "is", "em"],
};

const FUTURE_ENDINGS: Forms = ["ei", "ás", "á", "emos", "eis", "ão"];

/** Verbs in -air / -uir (not -guir/-quir) keep the vowels apart: cair, incluir. */
function hasHiatus(verb: string): boolean {
  return verb.endsWith("air") || (verb.endsWith("uir") && !/[gq]uir$/.test(verb));
}

function regularPresent(verb: string, cls: Conjugation, stem: string): Forms {
  if (hasHiatus(verb)) {
    const eu = verb.endsWith("air") ? stem + "io" : stem + "o";
    const forms: Forms = [eu, stem + "is", stem + "i", stem + "ímos", stem + "ís", stem + "em"];
    if (CONSTRUIR.has(verb)) {
      const root = stem.slice(0, -1);
      forms[1] = root + "óis";
      forms[2] = root + "ói";
      forms[5] = root + "oem";
    }
    return forms;
  }

  const endings = PRESENT_ENDINGS[cls];
  const forms = endings.map((e) => stem + e) as Forms;

  if (cls === "ar") {
    if (stem.endsWith("e")) {
      // -ear verbs: passear -> passeio
      for (const i of STRESSED) forms[i] = stem + "i" + endings[i];
    } else if (MARIO.has(verb)) {
      for (const i of STRESSED) forms[i] = stem.slice(0, -1) + "ei" + endings[i];
    }
    return forms;
  }

  // -er / -ir: spelling of "eu"
  let euStem = stem;
  if (E_TO_I_EU.has(verb)) {
    const k = euStem.lastIndexOf("e");
    if (k >= 0) euStem = euStem.slice(0, k) + "i" + euStem.slice(k + 1);
  }
  if (euStem.endsWith("gu")) forms[0] = euStem.slice(0, -1) + "o"; // seguir -> sigo
  else if (euStem.endsWith("g")) forms[0] = euStem.slice(0, -1) + "jo"; // proteger -> protejo
  else if (euStem.endsWith("c")) forms[0] = euStem.slice(0, -1) + "ço"; // conhecer -> conheço
  else forms[0] = euStem + "o";

  if (verb.endsWith("uzir")) forms[2] = stem; // produzir -> produz

  if (has(PRESENT_EU, verb)) forms[0] = PRESENT_EU[verb];
  if (has(STRESSED_STEM, verb)) {
    for (const i of [1, 2, 5] as Person[]) forms[i] = STRESSED_STEM[verb] + endings[i];
  }
  return forms;
}

function regularPreterite(
  verb: string,
  cls: Conjugation,
  stem: string,
  variant: PortugueseVariant
): Forms {
  if (hasHiatus(verb)) {
    return [stem + "í", stem + "íste", stem + "iu", stem + "ímos", stem + "ístes", stem + "íram"];
  }

  const endings: Record<Conjugation, Forms> = {
    ar: ["ei", "aste", "ou", variant === "pt" ? "ámos" : "amos", "astes", "aram"],
    er: ["i", "este", "eu", "emos", "estes", "eram"],
    ir: ["i", "iste", "iu", "imos", "istes", "iram"],
  };
  const forms = endings[cls].map((e) => stem + e) as Forms;

  if (cls === "ar") {
    if (stem.endsWith("c")) forms[0] = stem.slice(0, -1) + "quei"; // tocar -> toquei
    else if (stem.endsWith("g")) forms[0] = stem + "uei"; // pagar -> paguei
    else if (stem.endsWith("ç")) forms[0] = stem.slice(0, -1) + "cei"; // começar -> comecei
  }
  return forms;
}

function regularParticiple(verb: string, cls: Conjugation, stem: string): string {
  if (has(SHORT_PARTICIPLES, verb)) return SHORT_PARTICIPLES[verb];
  for (const [suffix, replacement] of PARTICIPLE_SUFFIXES) {
    if (verb.endsWith(suffix)) return verb.slice(0, -suffix.length) + replacement;
  }
  if (hasHiatus(verb)) return stem + "ído"; // caído, construído
  return stem + (cls === "ar" ? "ado" : "ido");
}

function analyse(verb: string, variant: PortugueseVariant): VerbForms {
  const irregular = resolveIrregular(verb);

  const cls: Conjugation | null = verb.endsWith("ar")
    ? "ar"
    : verb.endsWith("er")
    ? "er"
    : verb.endsWith("ir")
    ? "ir"
    : null;

  if (irregular) {
    const base = verb.slice(0, -2);
    const futureStem = irregular.future ?? verb;
    return {
      infinitive: verb,
      present: irregular.present,
      preterite: irregular.preterite,
      future: FUTURE_ENDINGS.map((e) => futureStem + e) as Forms,
      futureStem,
      gerund: irregular.gerund ?? base + (cls === "ar" ? "ando" : cls === "er" ? "endo" : "indo"),
      participle: irregular.participle ?? regularParticiple(verb, cls ?? "er", base),
    };
  }

  if (!cls) {
    throw new Error(`"${verb}" does not look like a Portuguese infinitive (-ar, -er, -ir, pôr).`);
  }

  const stem = verb.slice(0, -2);
  return {
    infinitive: verb,
    present: regularPresent(verb, cls, stem),
    preterite: regularPreterite(verb, cls, stem, variant),
    future: FUTURE_ENDINGS.map((e) => verb + e) as Forms,
    futureStem: verb,
    gerund: stem + (cls === "ar" ? "ando" : cls === "er" ? "endo" : "indo"),
    participle: regularParticiple(verb, cls, stem),
  };
}

/* ------------------------------------------------------------------ */
/* Subjects                                                            */
/* ------------------------------------------------------------------ */

const PERSON_BY_PRONOUN = new Map<string, Person>([
  ["eu", 0], ["i", 0],
  ["tu", 1], ["you", 1],
  ["ele", 2], ["ela", 2], ["você", 2], ["voce", 2], ["a gente", 2],
  ["he", 2], ["she", 2], ["it", 2],
  ["nós", 3], ["nos", 3], ["we", 3],
  ["vós", 4], ["vos", 4],
  ["eles", 5], ["elas", 5], ["vocês", 5], ["voces", 5], ["they", 5],
]);

function personOf(subject: string): Person {
  const s = subject.trim().toLowerCase();
  const known = PERSON_BY_PRONOUN.get(s);
  if (known !== undefined) return known;
  if (/ (e|and) /.test(s)) return 5; // "Maria e João"
  return 2; // any other noun phrase is 3rd person singular
}

/* ------------------------------------------------------------------ */
/* Auxiliaries: estar (continuous) and ter (perfect)                   */
/* ------------------------------------------------------------------ */

const ESTAR: Record<Tense, Forms> = {
  present: ["estou", "estás", "está", "estamos", "estais", "estão"],
  past: ["estava", "estavas", "estava", "estávamos", "estáveis", "estavam"],
  future: ["estarei", "estarás", "estará", "estaremos", "estareis", "estarão"],
};

const TER: Record<Tense, Forms> = {
  present: ["tenho", "tens", "tem", "temos", "tendes", "têm"],
  past: ["tinha", "tinhas", "tinha", "tínhamos", "tínheis", "tinham"],
  future: ["terei", "terás", "terá", "teremos", "tereis", "terão"],
};

/* ------------------------------------------------------------------ */
/* Core                                                                */
/* ------------------------------------------------------------------ */

/** Reflexive pronouns by person: eu, tu, ele, nós, vós, eles. */
const CLITICS: Forms = ["me", "te", "se", "nos", "vos", "se"];

/** European enclisis: verb-pronoun. "nós" drops the final s: levantamos + nos -> levantamo-nos. */
function enclitic(form: string, clitic: string): string {
  const host = clitic === "nos" && form.endsWith("s") ? form.slice(0, -1) : form;
  return `${host}-${clitic}`;
}

/** European mesoclisis in the simple future: levantar-me-ei, dir-se-á, pôr-nos-emos. */
function mesoclitic(stem: string, clitic: string, ending: string): string {
  return `${stem === "por" ? "pôr" : stem}-${clitic}-${ending}`;
}

function buildPredicate(
  forms: VerbForms,
  particle: string,
  tense: Tense,
  aspect: Aspect,
  person: Person,
  variant: PortugueseVariant,
  reflexive: boolean
): string {
  const clitic = reflexive ? CLITICS[person] : null;
  const european = variant === "pt";

  // Progressive form; the reflexive pronoun is built in:
  //   pt: a levantar-me     br: me levantando
  let progressive: string;
  if (european) progressive = `a ${forms.infinitive}${clitic ? "-" + clitic : ""}`;
  else progressive = clitic ? `${clitic} ${forms.gerund}` : forms.gerund;

  let words: string;

  switch (aspect) {
    case "simple": {
      const form =
        tense === "present"
          ? forms.present[person]
          : tense === "past"
          ? forms.preterite[person]
          : forms.future[person];
      if (!clitic) words = form;
      else if (!european) words = `${clitic} ${form}`;
      else if (tense === "future") {
        words = mesoclitic(forms.futureStem, clitic, FUTURE_ENDINGS[person]);
      } else words = enclitic(form, clitic);
      break;
    }
    case "continuous":
      words = `${ESTAR[tense][person]} ${progressive}`;
      break;
    case "perfect": {
      const aux = TER[tense][person];
      if (!clitic) words = `${aux} ${forms.participle}`;
      else if (!european) words = `${aux} ${clitic} ${forms.participle}`;
      else {
        const host =
          tense === "future"
            ? mesoclitic("ter", clitic, FUTURE_ENDINGS[person])
            : enclitic(aux, clitic);
        words = `${host} ${forms.participle}`;
      }
      break;
    }
    case "perfectContinuous":
      words = `${TER[tense][person]} estado ${progressive}`;
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
 * Conjugate a Portuguese verb.
 *
 * @param verb          Infinitive ("andar", "comer", "partir", "pôr"). Reflexive verbs are
 *                      written with -se ("levantar-se"). Extra words are kept after the
 *                      conjugated verb ("dar certo" -> "eu dou certo").
 * @param tenseAspects  Pairs such as ["past", "continuous"].
 * @param subjects      Optional subjects. Defaults depend on the variant (see
 *                      DEFAULT_SUBJECTS_BY_VARIANT). English pronouns (I, you, he, ...) are
 *                      also understood.
 * @param options       { variant: "br" | "pt" }, defaults to "br".
 */
export function conjugate(
  verb: string,
  tenseAspects: TenseAspectPair[],
  subjects?: string[],
  options: PortugueseOptions = {}
): ConjugationResult {
  const cleaned = verb.trim().toLowerCase();
  if (!cleaned) throw new Error("A verb is required.");

  const variant = options.variant ?? "br";
  const subjectList = subjects ?? DEFAULT_SUBJECTS_BY_VARIANT[variant];
  const words = cleaned.split(/\s+/);

  // Reflexive verbs: "levantar-se", "se levantar" or "levantar se".
  let reflexive = false;
  if (words[0] === "se" && words.length > 1) {
    reflexive = true;
    words.shift();
  } else if (words[0].length > 3 && words[0].endsWith("-se")) {
    reflexive = true;
    words[0] = words[0].slice(0, -3);
  } else if (words[1] === "se") {
    reflexive = true;
    words.splice(1, 1);
  }

  const [head, ...rest] = words;
  const particle = rest.join(" ");
  const infinitive = head === "por" ? "pôr" : head;

  const forms = analyse(infinitive, variant);
  const conjugations: TenseConjugations[] = [];

  for (const pair of tenseAspects) {
    const [tense, aspect] = normalizePair(pair);

    const results = subjectList.map(
      (subject) =>
        `${subject} ${buildPredicate(forms, particle, tense, aspect, personOf(subject), variant, reflexive)}`
    );

    // Group under the tense, preserving first-seen order.
    let entry = conjugations.find((c) => c[tense] !== undefined);
    if (!entry) {
      entry = { [tense]: [] };
      conjugations.push(entry);
    }
    entry[tense]!.push({ [aspect]: results });
  }

  return { verb: cleaned, conjugations };
}

export { conjugate as conjugatePortuguese };
