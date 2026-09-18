import { mapConcurrent } from "@repo/legislation-core/concurrency/map-concurrent"
import { z } from "zod"

export type FrReconciliationUnit = {
  key: string
  nativeId: string
  issueDate: string
}

export type FrReconciliationSuccess = {
  unitKey: string
  issueDate: string
  status: "reconciled"
  matchedPublications: number
  metadataPublications: number
  outsideScope: number
  listedPdfsNotAcquired: number
  reportId: string
  reportPath: string
}

export type FrReconciliationFailure = {
  unitKey: string
  issueDate: string
  status: "failed"
  stage: "metadata" | "issue"
  error: string
}

export type FrReconciliationOutcome = FrReconciliationSuccess | FrReconciliationFailure

export function frIssueMonth(issueDate: string) {
  return z.iso.date().parse(issueDate).slice(0, 7)
}

function failure(unit: FrReconciliationUnit, stage: FrReconciliationFailure["stage"], error: unknown) {
  return {
    unitKey: unit.key,
    issueDate: unit.issueDate,
    status: "failed" as const,
    stage,
    error: error instanceof Error ? error.message.slice(0, 300) : "Unknown reconciliation failure"
  }
}

export async function runFrReconciliationBatch<Metadata>(input: {
  units: readonly FrReconciliationUnit[]
  concurrency: number
  loadMetadata: (month: string) => Promise<Metadata>
  reconcile: (unit: FrReconciliationUnit, metadata: Metadata) => Promise<FrReconciliationSuccess>
}) {
  const concurrency = z.int().min(1).max(16).parse(input.concurrency)
  const months = [...new Set(input.units.map((unit) => frIssueMonth(unit.issueDate)))].sort()
  const metadata = new Map<string, { value: Metadata } | { error: unknown }>()
  for (const month of months) {
    try {
      metadata.set(month, { value: await input.loadMetadata(month) })
    } catch (error) {
      metadata.set(month, { error })
    }
  }
  const outcomes = await mapConcurrent(input.units, concurrency, async (unit): Promise<FrReconciliationOutcome> => {
    const retained = metadata.get(frIssueMonth(unit.issueDate))
    if (retained === undefined || "error" in retained) {
      return failure(unit, "metadata", retained?.error ?? new Error("Missing monthly metadata result"))
    }
    try {
      return await input.reconcile(unit, retained.value)
    } catch (error) {
      return failure(unit, "issue", error)
    }
  })
  return { months, outcomes }
}

export function summarizeFrReconciliationBatch(outcomes: readonly FrReconciliationOutcome[]) {
  const reconciled = outcomes.filter((outcome): outcome is FrReconciliationSuccess => outcome.status === "reconciled")
  const failures = outcomes.filter((outcome): outcome is FrReconciliationFailure => outcome.status === "failed")
  return {
    expectedIssues: outcomes.length,
    reconciledIssues: reconciled.length,
    failedIssues: failures.length,
    matchedPublications: reconciled.reduce((sum, outcome) => sum + outcome.matchedPublications, 0),
    metadataPublications: reconciled.reduce((sum, outcome) => sum + outcome.metadataPublications, 0),
    outsideScope: reconciled.reduce((sum, outcome) => sum + outcome.outsideScope, 0),
    listedPdfsNotAcquired: reconciled.reduce((sum, outcome) => sum + outcome.listedPdfsNotAcquired, 0),
    failures
  }
}
