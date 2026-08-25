import { describe, expect, it } from "vitest"
import {
  benchPrototypeContinuityThresholds,
  benchPrototypeFixtureHarness,
  type BenchPrototypeContinuityEvidence
} from "./bench-prototype-fixture-harness.js"
import {
  blankBp104FixturePhysicalEvidenceIntake,
  toBenchPrototypeFixturePhysicalEvidence,
  evaluateBp104FixturePhysicalEvidenceIntake,
  validateBp104FixturePhysicalEvidenceIntake
} from "./bp104-fixture-physical-evidence-intake.js"

const reviewer = "root-final-reviewer"
const timestamp = "2026-08-24T01:02:03.000Z"

function makeSyntheticAcceptedIntake() {
  const intake = structuredClone(blankBp104FixturePhysicalEvidenceIntake)
  let hashCounter = 1
  const nextHash = () => (hashCounter++).toString(16).padStart(64, "0")
  const artifact = (
    artifactId: string,
    mediaType: "pdf" | "photo" | "review-record" | "measurement-record" | "calibration-certificate",
    contentSha256 = nextHash()
  ) => ({
    artifactId,
    contentSha256,
    capturedAtUtc: timestamp,
    reviewer,
    mediaType,
    reviewStatus: "accepted" as const
  })
  Reflect.set(intake, "intakeId", "BP-104-SYNTHETIC-ACCEPTED")
  Reflect.set(intake, "status", "accepted")
  Reflect.set(intake, "recordedAtUtc", timestamp)
  Reflect.set(intake, "operator", "synthetic-test-operator")
  Reflect.set(intake, "reviewer", reviewer)

  benchPrototypeFixtureHarness.evidence.manufacturerDrawingDiscovery.candidates.forEach((candidate, index) => {
    const review = intake.sourceReviews[index]!
    Reflect.set(
      review,
      "cadDisposition",
      candidate.mpn === "43030-0007" ? "not-acquired-pattern-probe-returned-404" : "exact-retained-cad-artifact"
    )
    Reflect.set(review.source, "drawingUrl", candidate.sourceUrl)
    Reflect.set(review.source, "drawingPath", candidate.retainedAsset)
    Reflect.set(review.source, "drawingSha256", candidate.contentSha256)
    Reflect.set(review.source, "cadUrl", candidate.cadSourceUrl)
    Reflect.set(review.source, "cadPath", candidate.cadRetainedAsset)
    Reflect.set(review.source, "cadSha256", candidate.cadContentSha256)
    Reflect.set(review, "drawingArtifact", artifact(`${candidate.mpn}-drawing`, "pdf", candidate.contentSha256))
    if (candidate.cadContentSha256 !== null) {
      Reflect.set(review, "cadArtifact", artifact(`${candidate.mpn}-cad`, "pdf", candidate.cadContentSha256))
    }
    Reflect.set(review, "reviewArtifact", artifact(`${candidate.mpn}-review`, "review-record"))
    Reflect.set(review, "reviewer", reviewer)
    Reflect.set(review, "result", "accepted")
  })

  intake.receivedParts.forEach((part) => {
    Reflect.set(part, "receivedQuantity", part.mpn === "43030-0007" ? 7 : 1)
    Reflect.set(part.identity, "manufacturer", "Molex")
    Reflect.set(part.identity, "materialNumber", part.mpn.replaceAll("-", ""))
    Reflect.set(part.identity, "marking", part.mpn)
    Reflect.set(part.identity, "photo", artifact(`${part.mpn}-identity`, "photo"))
    Reflect.set(part, "receiptPhoto", artifact(`${part.mpn}-receipt`, "photo"))
    Reflect.set(part, "reviewer", reviewer)
    Reflect.set(part, "result", "accepted")
  })

  const fit = intake.matingFitOrientationLabels
  Reflect.set(fit, "powerState", "off-and-discharged")
  Reflect.set(fit, "sampleFitPhoto", artifact("fit-photo", "photo"))
  Reflect.set(fit, "circuitOneAligned", true)
  Reflect.set(fit, "latchLockSeated", true)
  Reflect.set(fit, "independentFixtureStopVerified", true)
  Reflect.set(fit, "namedSignalLabelsLegible", true)
  Reflect.set(fit, "pinOneMarkerLegible", true)
  Reflect.set(fit, "forcedMateObserved", false)
  Reflect.set(fit, "reviewer", reviewer)
  Reflect.set(fit, "result", "accepted")

  intake.miswireRejection.forEach((result) => {
    Reflect.set(result, "artifact", artifact(`${result.id}-measurement`, "measurement-record"))
    Reflect.set(result, "result", "rejected")
    Reflect.set(result, "observation", `synthetic ${result.id} rejection`)
    Reflect.set(result, "reviewer", reviewer)
  })
  intake.crimpAndRetention.forEach((record) => {
    Reflect.set(record, "cavity", intake.crimpAndRetention.indexOf(record) + 1)
    Reflect.set(record, "terminalMpn", "43030-0007")
    Reflect.set(record, "crimpArtifact", artifact(`${record.signal}-crimp`, "photo"))
    Reflect.set(record, "retentionArtifact", artifact(`${record.signal}-retention`, "photo"))
    Reflect.set(record, "reviewer", reviewer)
    Reflect.set(record, "result", "accepted")
  })

  const strain = intake.strainRelief
  Reflect.set(strain, "artifact", artifact("strain-relief", "photo"))
  Reflect.set(strain, "pullLoadPathBypassesCrimpAndPcb", true)
  Reflect.set(strain, "bendPathVerified", true)
  Reflect.set(strain, "reviewer", reviewer)
  Reflect.set(strain, "result", "accepted")

  const continuityRecord: BenchPrototypeContinuityEvidence = {
    artifactKind: "bench-prototype-fixture-continuity-evidence",
    evidenceId: "BP-104-SYNTHETIC-CONTINUITY",
    status: "measured",
    recordedAtUtc: timestamp,
    operator: "synthetic-test-operator",
    boardId: "synthetic-board",
    harnessId: "synthetic-harness",
    testPlugMpn: "44242-0005",
    equipment: {
      manufacturer: "Synthetic Instruments",
      model: "Synthetic Model",
      serialNumber: "SYN-001",
      calibrationCertificate: "SYN-CAL-001",
      calibrationDueDate: "2027-08-24"
    },
    method: {
      powerState: "off-and-discharged",
      continuityTestVoltageV: 1,
      isolationTestVoltageV: 5,
      leadCompensationMethod: "zeroed-with-same-leads-at-fixture",
      compensatedLeadResidualOhms: 0.05
    },
    endToEnd: [
      "LEFT_WEAPON_A",
      "LEFT_WEAPON_B",
      "LEFT_WEAPON_C",
      "RIGHT_WEAPON_A",
      "RIGHT_WEAPON_B",
      "RIGHT_WEAPON_C",
      "PISTE"
    ].map((signal, index) => ({
      boardPin: index + 1,
      harnessCircuit: index + 1,
      signal,
      resistanceOhms: 0.4
    })),
    isolation: Array.from({ length: 12 }, (_, index) => index + 1).flatMap((boardPinA) =>
      Array.from({ length: 12 - boardPinA }, (_, offset) => ({
        boardPinA,
        boardPinB: boardPinA + offset + 1,
        resistanceOhms: benchPrototypeContinuityThresholds.minimumIsolationResistanceOhms,
        testVoltageV: 5 as const
      }))
    ),
    openCircuitChecks: Array.from({ length: 5 }, (_, index) => ({
      boardPin: index + 8,
      harnessCircuit: index + 8,
      resistanceOhms: benchPrototypeContinuityThresholds.minimumIsolationResistanceOhms
    })),
    negativeTests: (
      ["BP104-NEG-SWAP", "BP104-NEG-OPEN", "BP104-NEG-RETURN-BOND", "BP104-NEG-REVERSED-MATE"] as const
    ).map((id) => ({
      id,
      result: "rejected" as const,
      observation: `synthetic ${id} rejection`
    }))
  }
  const continuity = intake.continuity
  Reflect.set(continuity, "record", continuityRecord)
  Reflect.set(continuity, "measurementArtifact", artifact("continuity-measurement", "measurement-record"))
  Reflect.set(continuity.instrumentAndCalibration, "manufacturer", continuityRecord.equipment.manufacturer)
  Reflect.set(continuity.instrumentAndCalibration, "model", continuityRecord.equipment.model)
  Reflect.set(continuity.instrumentAndCalibration, "serialNumber", continuityRecord.equipment.serialNumber)
  Reflect.set(
    continuity.instrumentAndCalibration,
    "calibrationCertificate",
    continuityRecord.equipment.calibrationCertificate
  )
  Reflect.set(continuity.instrumentAndCalibration, "calibrationDueDate", continuityRecord.equipment.calibrationDueDate)
  Reflect.set(
    continuity.instrumentAndCalibration,
    "calibrationArtifact",
    artifact("calibration-certificate", "calibration-certificate")
  )
  Reflect.set(continuity, "reviewer", reviewer)
  Reflect.set(continuity, "result", "accepted")
  return intake
}

describe("BP-104 received-part and harness physical-evidence intake", () => {
  it("exports a frozen blank template that makes no hardware claim", () => {
    expect(Object.isFrozen(blankBp104FixturePhysicalEvidenceIntake)).toBe(true)
    expect(Object.isFrozen(blankBp104FixturePhysicalEvidenceIntake.sourceReviews)).toBe(true)
    expect(Object.isFrozen(blankBp104FixturePhysicalEvidenceIntake.receivedParts)).toBe(true)
    expect(blankBp104FixturePhysicalEvidenceIntake.statement).toContain("No received hardware")
    expect(blankBp104FixturePhysicalEvidenceIntake.sourceReviews[2].cadDisposition).toBeNull()

    const evaluation = evaluateBp104FixturePhysicalEvidenceIntake(blankBp104FixturePhysicalEvidenceIntake)
    expect(evaluation.accepted).toBe(false)
    expect(evaluation.status).toBe("incomplete")
    expect(evaluation.reasons).toContain("intakeId is required")
    expect(evaluation.reasons).toContain(
      "all intake sections must be complete before physical evidence can be evaluated"
    )
    expect(() => validateBp104FixturePhysicalEvidenceIntake(blankBp104FixturePhysicalEvidenceIntake)).toThrow(
      RangeError
    )
  })

  it("does not let an incomplete record claim accepted status", () => {
    const intake = structuredClone(blankBp104FixturePhysicalEvidenceIntake)
    Reflect.set(intake, "intakeId", "BP-104-INTAKE-001")
    Reflect.set(intake, "recordedAtUtc", "2026-08-24T00:00:00Z")
    Reflect.set(intake, "operator", "operator")
    Reflect.set(intake, "reviewer", "root-final-reviewer")
    Reflect.set(intake, "status", "accepted")

    const evaluation = evaluateBp104FixturePhysicalEvidenceIntake(intake)
    expect(evaluation.accepted).toBe(false)
    expect(evaluation.status).toBe("incomplete")
    expect(evaluation.reasons).toContain("recordedAtUtc must be a real UTC ISO timestamp")
    expect(evaluation.reasons).toContain("accepted status requires every intake section and evaluator gate to pass")
  })

  it("requires the canonical independent root reviewer for the intake", () => {
    const intake = structuredClone(blankBp104FixturePhysicalEvidenceIntake)
    Reflect.set(intake, "intakeId", "BP-104-INTAKE-002")
    Reflect.set(intake, "recordedAtUtc", "2026-08-24T00:00:00.000Z")
    Reflect.set(intake, "operator", "same-person")
    Reflect.set(intake, "reviewer", "same-person")

    const evaluation = evaluateBp104FixturePhysicalEvidenceIntake(intake)
    expect(evaluation.accepted).toBe(false)
    expect(evaluation.reasons).toContain("intake reviewer must differ from the operator")

    Reflect.set(intake, "operator", "operator")
    Reflect.set(intake, "reviewer", "other-reviewer")
    const nonRootEvaluation = evaluateBp104FixturePhysicalEvidenceIntake(intake)
    expect(nonRootEvaluation.accepted).toBe(false)
    expect(nonRootEvaluation.reasons).toContain("intake reviewer must be root-final-reviewer")
  })

  it("rejects aliases and extra enumerable keys before evaluating evidence", () => {
    const alias = structuredClone(blankBp104FixturePhysicalEvidenceIntake)
    Reflect.set(alias.receivedParts[0], "identity", alias.receivedParts[1].identity)
    const aliasEvaluation = evaluateBp104FixturePhysicalEvidenceIntake(alias)
    expect(aliasEvaluation.accepted).toBe(false)
    expect(aliasEvaluation.reasons.some((reason) => reason.includes("cycle or object alias"))).toBe(true)

    const extraKey = structuredClone(blankBp104FixturePhysicalEvidenceIntake)
    Object.defineProperty(extraKey, "unexpected", { enumerable: true, value: true })
    const extraKeyEvaluation = evaluateBp104FixturePhysicalEvidenceIntake(extraKey)
    expect(extraKeyEvaluation.accepted).toBe(false)
    expect(extraKeyEvaluation.reasons).toContain("intake must contain only the exact BP-104 enumerable data keys")

    const malformed = structuredClone(blankBp104FixturePhysicalEvidenceIntake)
    Reflect.set(malformed, "sourceReviews", null)
    expect(() => evaluateBp104FixturePhysicalEvidenceIntake(malformed)).not.toThrow()
    expect(evaluateBp104FixturePhysicalEvidenceIntake(malformed).accepted).toBe(false)
  })

  it("keeps the 43030-0007 CAD state fail-closed when a guessed URL is supplied", () => {
    const intake = structuredClone(blankBp104FixturePhysicalEvidenceIntake)
    const source = intake.sourceReviews[2].source
    Reflect.set(intake.sourceReviews[2], "cadDisposition", "not-acquired-pattern-probe-returned-404")
    Reflect.set(
      source,
      "cadUrl",
      "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/3dcadmodelspdf/430/43030/430300007.pdf"
    )
    Reflect.set(source, "cadPath", "docs/evidence/bp-104/assets/43030-0007-cad-preview.pdf")
    Reflect.set(source, "cadSha256", "0".repeat(64))

    const evaluation = evaluateBp104FixturePhysicalEvidenceIntake(intake)
    expect(evaluation.accepted).toBe(false)
    expect(evaluation.reasons).toContain(
      "CAD source binding for 43030-0007 must remain null until a source artifact is acquired"
    )
  })

  it("accepts a complete synthetic intake and maps the terminal no-CAD disposition", () => {
    const intake = makeSyntheticAcceptedIntake()
    const evaluation = evaluateBp104FixturePhysicalEvidenceIntake(intake)
    expect(evaluation).toEqual({ accepted: true, status: "accepted", reasons: [] })
    expect(validateBp104FixturePhysicalEvidenceIntake(intake)).toBe(true)

    const mapped = toBenchPrototypeFixturePhysicalEvidence(intake)
    expect(mapped).toMatchObject({
      drawingCadReviews: [
        { mpn: "43045-1200", cadDisposition: "exact-retained-cad-artifact", cadArtifactId: "43045-1200-cad" },
        { mpn: "43025-1200", cadDisposition: "exact-retained-cad-artifact", cadArtifactId: "43025-1200-cad" },
        {
          mpn: "43030-0007",
          cadDisposition: "not-acquired-pattern-probe-returned-404",
          cadArtifactId: null,
          cadSha256: null
        },
        { mpn: "44242-0005", cadDisposition: "exact-retained-cad-artifact", cadArtifactId: "44242-0005-cad" }
      ]
    })
  })
})
