import type { Calibration, Candidate, Cluster, Detector, DetectorContext } from "../types"
import { adequatelyCovered } from "./adequately-covered"
import { answerableQuestion } from "./answerable-question"
import { cannibalization } from "./cannibalization"
import { competitorGap } from "./competitor-gap"
import { decay } from "./decay"
import { partialCluster } from "./partial-cluster"
import { productPageTerritory } from "./product-page-territory"
import { risingDemand } from "./rising-demand"
import { seasonalLeadTime } from "./seasonal-lead-time"
import { strikingDistance } from "./striking-distance"

/**
 * Every rule the derived layer knows, in no particular order.
 *
 * A catalogue rather than one scoring function, so a rule can be added, reweighted, or switched off without
 * disturbing the others, and so every row can name the rule that produced it. The rules that say not to write sit in
 * the same list as the rules that say to write, because consolidation, retargeting, and no action are real outcomes
 * and a tool willing to say them is worth more than one that answers everything with another article.
 */
export const detectors: Detector[] = [
  strikingDistance,
  competitorGap,
  partialCluster,
  answerableQuestion,
  seasonalLeadTime,
  risingDemand,
  decay,
  cannibalization,
  productPageTerritory,
  adequatelyCovered
]

/**
 * Runs every rule whose evidence this store can actually supply.
 *
 * A store that ranks for nothing has no authority ceiling, and the rules that argue from one are skipped rather than
 * run against a guess. Skipping is the honest failure: a recommendation derived from an invented ceiling is
 * indistinguishable, to the merchant reading it, from one derived from a measurement.
 */
export function runDetectors(clusters: Cluster[], context: DetectorContext): Candidate[] {
  return detectors
    .filter((detector) => canRun(detector, context.calibration))
    .flatMap((detector) => detector.detect(clusters, context))
}

/** Whether the evidence a rule argues from exists for this store. */
export function canRun(detector: Detector, calibration: Calibration) {
  if (!detector.requiresAuthority) {
    return true
  }
  return calibration.wonAuthorityCeiling !== null && calibration.authorityConfidence !== "none"
}
