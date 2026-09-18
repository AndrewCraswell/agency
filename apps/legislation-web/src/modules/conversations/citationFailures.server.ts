import { createHash, randomUUID } from "node:crypto"
import { captureException } from "@sentry/core"
import { z } from "zod"
import type { EvalEvent } from "../evaluations/contracts"
import { createCitationPresentation } from "./components/citationPresentation"
import { evidenceSnapshotSchema, type EvidenceSnapshot } from "./evidence"

export type CitationTelemetryContext = { runId: string; model: string; promptVersion: number }
const toolEvidenceSchema = z.object({ evidence: z.array(evidenceSnapshotSchema).max(40) })

export function createCitationFailureReporter(context: CitationTelemetryContext) {
  const reported = new Set<string>()
  return (answer: {
    text: string
    events: EvalEvent[]
    termination: string
    isInterrupted: boolean
    retainedEvidence?: EvidenceSnapshot[]
  }) => {
    if (answer.isInterrupted || answer.termination !== "stop") {
      return
    }
    const evidence = new Map<string, EvidenceSnapshot>(
      (answer.retainedEvidence ?? []).map((source) => [source.id, source])
    )
    for (const event of answer.events) {
      if (event.type !== "result") {
        continue
      }
      const parsed = toolEvidenceSchema.safeParse(event.value)
      if (parsed.success) {
        for (const source of parsed.data.evidence) {
          evidence.set(source.id, source)
        }
      }
    }
    const presentation = createCitationPresentation(context.runId, answer.text, [...evidence.values()])
    for (const missing of presentation.missingReferences) {
      const referenceHash = createHash("sha256").update(missing).digest("hex")
      if (reported.has(referenceHash)) {
        continue
      }
      reported.add(referenceHash)
      captureException(new Error("Citation does not match retrieved evidence."), {
        fingerprint: ["citation_resolution", "unmatched_reference"],
        tags: {
          operation: "citation_resolution",
          category: "invalid_response",
          reference: randomUUID(),
          runId: context.runId,
          citationReferenceHash: referenceHash,
          model: context.model,
          promptVersion: String(context.promptVersion)
        },
        extra: { unresolvedCitationCount: presentation.missingReferences.length, evidenceCount: evidence.size }
      })
    }
  }
}
