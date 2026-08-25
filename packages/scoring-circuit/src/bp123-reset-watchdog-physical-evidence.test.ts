import { describe, expect, it } from "vitest"
import { benchPrototypeResetWatchdog } from "./bench-prototype-reset-watchdog.js"
import {
  bp123ResetWatchdogPhysicalCaptureRequirements,
  bp123ResetWatchdogPhysicalEvidenceTemplate,
  evaluateBp123ResetWatchdogPhysicalEvidence
} from "./bp123-reset-watchdog-physical-evidence.js"

const sha256 = (index: number) => index.toString(16).padStart(64, "0")

function completeStructuralFixture() {
  const sample = { assemblyId: "fixture-assembly", boardRevision: "fixture-revision", serialNumber: "fixture-serial" }
  return {
    artifactKind: "bp123-reset-watchdog-physical-capture-submission",
    captures: bp123ResetWatchdogPhysicalCaptureRequirements.map((requirement, index) => {
      const captureDigest = sha256(200 + index)
      return {
        record: {
          captureArtifact: { artifactId: `waveform-${index}`, contentSha256: captureDigest },
          captureId: requirement.captureId,
          injectedInputProfile: { artifactId: `input-${index}`, contentSha256: sha256(300 + index) },
          instrument: {
            calibrationArtifact: { artifactId: `calibration-${index}`, contentSha256: sha256(100 + index) },
            calibrationDueDate: "2026-12-31",
            manufacturer: "fixture manufacturer",
            model: "fixture scope",
            serialNumber: `fixture-scope-${index}`
          },
          measurements: requirement.requiredMetrics.map((metric) => ({
            id: metric.id,
            unit: metric.unit,
            value: (metric.minimum + metric.maximum) / 2
          })),
          observedSignals: [...requirement.requiredObservedSignals],
          operator: "fixture operator",
          procedure: { artifactId: `procedure-${index}`, contentSha256: sha256(400 + index), revision: "fixture-r1" },
          prototype: { ...sample },
          recordedAtUtc: "2026-08-24T12:00:00.000Z",
          setupArtifact: { artifactId: `setup-${index}`, contentSha256: sha256(500 + index) },
          status: "measured"
        },
        waveform: { artifactId: `waveform-${index}`, contentSha256: captureDigest, fileName: `capture-${index}.wfm` }
      }
    }),
    evidenceId: "fixture-evidence",
    reviewer: {
      reviewArtifact: { artifactId: "fixture-review", contentSha256: sha256(700) },
      reviewedAtUtc: "2026-08-24T13:00:00.000Z",
      reviewerId: "fixture-reviewer"
    },
    sample
  }
}

describe("BP-123 reset/watchdog physical-capture intake", () => {
  it("keeps a deep-frozen blank template and derives all exact capture requirements", () => {
    expect(bp123ResetWatchdogPhysicalCaptureRequirements).toBe(
      benchPrototypeResetWatchdog.physicalEvidenceIntake.requiredCaptures
    )
    expect(bp123ResetWatchdogPhysicalEvidenceTemplate).toEqual({
      artifactKind: "bp123-reset-watchdog-physical-capture-intake",
      authority: {
        fabricationAuthorized: false,
        physicalEvidenceAccepted: false,
        schematicIntegrationAuthorized: false
      },
      captures: [],
      reviewer: null,
      sample: null,
      state: "blank"
    })
    expect(Object.isFrozen(bp123ResetWatchdogPhysicalEvidenceTemplate)).toBe(true)
    expect(Object.isFrozen(bp123ResetWatchdogPhysicalEvidenceTemplate.authority)).toBe(true)
    expect(evaluateBp123ResetWatchdogPhysicalEvidence({})).toEqual({
      canonicalReconciliationAccepted: false,
      physicalEvidenceAccepted: false,
      reasons: ["submission must contain the exact BP-123 intake envelope"],
      state: "incomplete"
    })
  })

  it("requires canonical metrics, waveform hashes, sample identity, calibration, timestamps, and reviewer provenance", () => {
    const incomplete = completeStructuralFixture()
    incomplete.captures[5]!.waveform.contentSha256 = sha256(999)
    incomplete.captures[4]!.record.prototype.serialNumber = "wrong-sample"
    incomplete.reviewer.reviewedAtUtc = "not-a-timestamp"

    const evaluation = evaluateBp123ResetWatchdogPhysicalEvidence(incomplete)
    expect(evaluation.canonicalReconciliationAccepted).toBe(false)
    expect(evaluation.physicalEvidenceAccepted).toBe(false)
    expect(evaluation.state).toBe("incomplete")
    expect(evaluation.reasons.join(" ")).toContain("matching hashed capture artifact")
    expect(evaluation.reasons.join(" ")).toContain("submitted sample identity")
    expect(evaluation.reasons.join(" ")).toContain("reviewer requires identity")
  })

  it("rejects normalized-invalid reviewer UTC dates", () => {
    const invalidDate = completeStructuralFixture()
    invalidDate.reviewer.reviewedAtUtc = "2026-02-31T13:00:00.000Z"

    const evaluation = evaluateBp123ResetWatchdogPhysicalEvidence(invalidDate)
    expect(evaluation.canonicalReconciliationAccepted).toBe(false)
    expect(evaluation.reasons).toContain(
      "reviewer requires identity, canonical UTC timestamp, and a hashed review artifact"
    )
  })

  it("requires an independent reviewer and non-reused reviewer artifact", () => {
    const conflictedReviewer = completeStructuralFixture()
    const captureArtifact = conflictedReviewer.captures[0]!.record.captureArtifact
    conflictedReviewer.reviewer.reviewerId = conflictedReviewer.captures[0]!.record.operator
    conflictedReviewer.reviewer.reviewArtifact = {
      artifactId: captureArtifact.artifactId,
      contentSha256: captureArtifact.contentSha256
    }

    const evaluation = evaluateBp123ResetWatchdogPhysicalEvidence(conflictedReviewer)
    expect(evaluation.canonicalReconciliationAccepted).toBe(false)
    expect(evaluation.reasons).toContain("reviewerId must differ from every capture operator")
    expect(evaluation.reasons).toContain("reviewer review artifact ID must not reuse a capture waveform artifact")
    expect(evaluation.reasons).toContain("reviewer review artifact digest must not reuse a capture waveform artifact")
  })

  it("never turns a structurally complete fixture into accepted physical evidence", () => {
    const evaluation = evaluateBp123ResetWatchdogPhysicalEvidence(completeStructuralFixture())

    expect(evaluation.canonicalReconciliationAccepted).toBe(true)
    expect(evaluation.physicalEvidenceAccepted).toBe(false)
    expect(evaluation.state).toBe("ready-for-independent-review")
    expect(evaluation.reasons).toEqual([
      "static reconciliation is complete; physical evidence remains denied pending independent review and real artifacts"
    ])
    expect(Object.isFrozen(evaluation)).toBe(true)
    expect(Object.isFrozen(evaluation.reasons)).toBe(true)
  })
})
