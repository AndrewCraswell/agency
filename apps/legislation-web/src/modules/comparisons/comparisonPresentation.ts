import type { DocumentComparison } from "@repo/legislation-diffing/comparison"
import { parseDiff } from "react-diff-view"

export function readComparisonDiff(comparison: DocumentComparison) {
  const files = parseDiff(comparison.unifiedDiff, { nearbySequences: "zip" })
  const file = files[0]
  if (files.length !== 1 || !file) {
    throw new Error("The comparison does not contain one valid document diff.")
  }
  const changes = file.hunks.flatMap((hunk) => hunk.changes)
  return {
    hunks: file.hunks,
    addedLines: changes.filter((change) => change.type === "insert").length,
    deletedLines: changes.filter((change) => change.type === "delete").length
  }
}

export type ComparisonDocumentReference = Pick<DocumentComparison["left"], "id" | "contentHash">

export type ComparisonState =
  | Readonly<{ status: "ready"; comparison: DocumentComparison }>
  | Readonly<{
      status: "loading" | "error" | "unavailable"
      left: ComparisonDocumentReference
      right: ComparisonDocumentReference
    }>

export type ComparisonPresentationProps = Readonly<{
  state: ComparisonState
  leftDisplayLabel?: string
  rightDisplayLabel?: string
  leftValidatedSourceUrl?: string
  rightValidatedSourceUrl?: string
  onRetry?: () => void
}>
