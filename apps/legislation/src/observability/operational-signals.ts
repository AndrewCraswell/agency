import type { CoverageReport } from "../coverage/report.js"

const HOUR_MILLISECONDS = 60 * 60 * 1000

function ageHours(value: string | undefined, now: Date): number | null {
  if (value === undefined) {
    return null
  }
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? Math.max(0, (now.getTime() - timestamp) / HOUR_MILLISECONDS) : null
}

export interface OperationalReadinessSignals {
  congressCheckpointAgeHours: number | null
  congressCheckpointObserved: boolean
  documentFailureRate: number
  embeddingBacklog: number
  embeddingBacklogAgeHours: number | null
  generatedAt: string
}

export function operationalReadinessSignals(
  report: CoverageReport,
  now: Date = new Date()
): OperationalReadinessSignals {
  const congressCheckpoint = report.checkpoints.find(
    (checkpoint) => checkpoint.source === "congress" && checkpoint.stream === "bills"
  )
  const oldestEmbeddingBacklog = [
    report.embeddingCoverage.bills.oldestMissingAt,
    report.embeddingCoverage.sections.oldestMissingAt
  ]
    .filter((value): value is string => value !== undefined)
    .toSorted()
    .at(0)
  const embeddingBacklog =
    Math.max(0, report.embeddingCoverage.bills.total - report.embeddingCoverage.bills.embedded) +
    Math.max(0, report.embeddingCoverage.sections.total - report.embeddingCoverage.sections.embedded)

  return {
    congressCheckpointAgeHours: ageHours(congressCheckpoint?.updatedAt, now),
    congressCheckpointObserved: congressCheckpoint !== undefined,
    documentFailureRate:
      report.documentQuality.total === 0 ? 0 : report.documentQuality.extractionFailures / report.documentQuality.total,
    embeddingBacklog,
    embeddingBacklogAgeHours: embeddingBacklog === 0 ? null : ageHours(oldestEmbeddingBacklog, now),
    generatedAt: report.generatedAt
  }
}
