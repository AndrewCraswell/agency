import type { Detector } from "../types"
import { candidate, clearsDemandFloor, demand, holdsTopTen } from "./support"

/** The reading that says a search wants an answer rather than a shelf. */
const INFORMATIONAL = "informational"

/**
 * The search is a question, and the answer on the first page is not ours.
 *
 * Phrasing is the trigger because it costs nothing to compute and is unambiguous: a search that begins with "how" is
 * asking. The result page's own question block is confirmation at most and never the trigger, because nearly every
 * result page carries one and a signal that fires everywhere identifies nothing.
 */
export const answerableQuestion: Detector = {
  name: "answerable_question",
  verdict: "new_article",
  requiresAuthority: false,
  detect: (clusters, { calibration }) =>
    clusters
      .filter((cluster) => cluster.questionKeywords.length > 0)
      .filter((cluster) => cluster.mainIntent === INFORMATIONAL || cluster.intents.includes(INFORMATIONAL))
      .filter((cluster) => !holdsTopTen(cluster))
      .filter((cluster) => clearsDemandFloor(cluster, calibration.demandFloor))
      .map((cluster) => {
        const asked = cluster.questionKeywords[0] ?? cluster.headKeyword
        return candidate("answerable_question", cluster, "new_article", [
          `"${asked}" is a question, and the answer on the first page isn't ours.`,
          cluster.ourBestPosition === null
            ? `We don't rank anywhere across the ${String(cluster.keywords.length)} terms here.`
            : `Our best position across these terms is ${String(cluster.ourBestPosition)}.`,
          `${demand(cluster.demand)} searches a month are asking it.`
        ])
      })
}
