/**
 * Brazilian Portuguese conjugator. Same API and types as conjugator.ts.
 *
 *   conjugate("andar", [["past", "continuous"]], ["eu", "você"]);
 *   // past continuous -> "eu estava andando", "você estava andando"
 *
 * Brazilian specifics: gerund for progressive forms (estou andando), "nós andamos" in the
 * preterite, and você/vocês in the default subjects.
 *
 * Reflexive verbs: conjugate("levantar-se", [["present", "simple"]], ["eu", "nós"]);
 *   -> "eu me levanto", "nós nos levantamos"  (pronoun goes before the verb)
 */

import { conjugate as conjugateCore, DEFAULT_SUBJECTS_BY_VARIANT } from "./conjugator-portuguese";
import type { TenseAspectPair, ConjugationResult } from "./conjugator-portuguese";

export type {
  Tense,
  Aspect,
  TenseAspectPair,
  TenseConjugations,
  ConjugationResult,
} from "./conjugator-portuguese";

export const DEFAULT_SUBJECTS = DEFAULT_SUBJECTS_BY_VARIANT.br;

export function conjugate(
  verb: string,
  tenseAspects: TenseAspectPair[],
  subjects: string[] = DEFAULT_SUBJECTS
): ConjugationResult {
  return conjugateCore(verb, tenseAspects, subjects, { variant: "br" });
}

export { conjugate as conjugateBrazilian };
