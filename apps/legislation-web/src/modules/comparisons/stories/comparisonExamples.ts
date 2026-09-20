import { compareDocuments, type DiffGranularity } from "@repo/legislation-diffing/comparison"
import invariant from "tiny-invariant"
import capture from "./fixtures/databaseDocuments.json"

function storedDocument(id: string) {
  const document = capture.documents.find((item) => item.id === id)
  invariant(document, "The captured database document must exist.")
  return document
}

const stateEarlier = storedDocument("bill:ca:20232024:ab:2652:document:a68274b474573935310f4581")
const stateLater = storedDocument("bill:ca:20232024:ab:2652:document:771ee9be4ef47c237a0fb3f9")
const federalIntroduced = storedDocument("bill:us:116:hr:2513:document:fc26ffd733c4ac6aa23a518c")
const federalReported = storedDocument("bill:us:116:hr:2513:document:ea796d8bb1f54ad8c6eef884")
const federalReferred = storedDocument("bill:us:116:hr:2513:document:096b6282328ed5df75d83ddb")

function createExample(left: typeof stateEarlier, right: typeof stateLater, granularity: DiffGranularity = "word") {
  return {
    state: { status: "ready" as const, comparison: compareDocuments({ left, right, granularity }) },
    leftDisplayLabel: `${left.billIdentifier}: ${left.title} (${left.documentDate})`,
    rightDisplayLabel: `${right.billIdentifier}: ${right.title} (${right.documentDate})`,
    leftValidatedSourceUrl: left.sourceUrl,
    rightValidatedSourceUrl: right.sourceUrl
  }
}

export const stateWordingExample = createExample(stateEarlier, stateLater)
export const federalRevisionExample = createExample(federalIntroduced, federalReported)
export const chapterCollisionExample = createExample(federalIntroduced, federalReferred, "paragraph")
export const unchangedExample = createExample(stateEarlier, stateEarlier)
export const pendingDocuments = {
  left: stateWordingExample.state.comparison.left,
  right: stateWordingExample.state.comparison.right
}
export const capturedAt = capture.capturedAt
export const chapterCollisionDescription =
  "H.R. 2513, introduced May 3, 2019 and referred to the Senate October 23, 2019. Full stored texts retain ownership reporting and the separate whistleblower provision despite both referencing Chapter 53."
export const stateWordingDescription =
  "California AB 2652, artificial intelligence working group: Assembly-amended texts dated April 8 and April 18, 2024. These are full database snapshots, including the PDF extractor's layout and amendment-markup artifacts."
export const federalRevisionDescription =
  "H.R. 2513: introduced House text from May 3, 2019 compared with the reported House text from October 8, 2019."
