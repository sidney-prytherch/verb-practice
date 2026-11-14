/**
 * Brazilian Portuguese conjugator. Same API and types as conjugator.ts.
 *
 *   conjugate("andar", [["past", "continuous"]], ["eu", "você"]);
 *   // past continuous -> "eu estava andando", "você estava andando"
 *
 * Brazilian specifics: gerund for progressive forms (estou andando), "nós andamos" in the
 * preterite, and você/vocês in the default subjects.
 *
 * Object pronouns follow everyday Brazilian speech:
 *   conjugate("ver", [["past", "simple"]], ["eu"], { object: "him" });   // "eu vi ele"
 *   conjugate("dar", [["past", "simple"]], ["eu"], { object: "it-m", indirectObject: "her" });
 *   // "eu dei pra ela"
 *
 * Reflexive verbs: conjugate("levantar-se", [["present", "simple"]], ["eu", "nós"]);
 *   -> "eu me levanto", "nós nos levantamos"  (pronoun goes before the verb)
 */

import { conjugate as conjugateCore, DEFAULT_SUBJECTS_BY_VARIANT } from "./conjugator-portuguese";
import type { TenseAspectPair, ConjugationResult, ObjectOptions } from "./conjugator-portuguese";

export type {
  Tense,
  Aspect,
  TenseAspectPair,
  TenseConjugations,
  ConjugationResult,
  ObjectPronoun,
  ObjectOptions,
} from "./conjugator-portuguese";

export const DEFAULT_SUBJECTS = DEFAULT_SUBJECTS_BY_VARIANT.br;

export function conjugate(
  verb: string,
  tenseAspects: TenseAspectPair[],
  subjects: string[] = DEFAULT_SUBJECTS,
  objects: ObjectOptions = {}
): ConjugationResult {
  return conjugateCore(verb, tenseAspects, subjects, { ...objects, variant: "br" });
}

export { conjugate as conjugateBrazilian };
