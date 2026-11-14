/**
 * European (Portugal) Portuguese conjugator. Same API and types as conjugator.ts.
 *
 *   conjugate("andar", [["past", "continuous"]], ["eu", "tu"]);
 *   // past continuous -> "eu estava a andar", "tu estavas a andar"
 *
 * European specifics: "a + infinitive" for progressive forms (estou a andar), "nós andámos"
 * (with accent) in the preterite, and tu/vocês in the default subjects.
 *
 * Reflexive verbs: conjugate("levantar-se", [["present", "simple"]], ["eu", "nós"]);
 *   -> "eu levanto-me", "nós levantamo-nos"  (pronoun follows the verb, hyphenated;
 *   simple future uses mesoclisis: "eu levantar-me-ei")
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

export const DEFAULT_SUBJECTS = DEFAULT_SUBJECTS_BY_VARIANT.pt;

export function conjugate(
  verb: string,
  tenseAspects: TenseAspectPair[],
  subjects: string[] = DEFAULT_SUBJECTS
): ConjugationResult {
  return conjugateCore(verb, tenseAspects, subjects, { variant: "pt" });
}

export { conjugate as conjugateEuropean };
