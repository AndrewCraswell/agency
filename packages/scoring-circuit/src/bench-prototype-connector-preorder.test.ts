import { describe, expect, it } from "vitest"
import {
  benchPrototypeConnectorPreorder,
  evaluateBenchPrototypeConnectorPreorderEvidence,
  validateBenchPrototypeConnectorPreorder
} from "./bench-prototype-connector-preorder.js"

const artifact = (id: string, hash = "A".repeat(64)) => ({ artifactId: id, sha256: hash })

function weaponEvidence() {
  const signals = [
    "LEFT_WEAPON_A",
    "LEFT_WEAPON_B",
    "LEFT_WEAPON_C",
    "RIGHT_WEAPON_A",
    "RIGHT_WEAPON_B",
    "RIGHT_WEAPON_C",
    "PISTE"
  ]
  const isolation = Array.from({ length: 12 }, (_, index) => index + 1).flatMap((boardPinA) =>
    Array.from({ length: 12 - boardPinA }, (_, offset) => ({
      boardPinA,
      boardPinB: boardPinA + offset + 1,
      resistanceOhms: 10_000_000,
      testVoltageV: 5 as const
    }))
  )
  return {
    artifactKind: "bench-prototype-fixture-continuity-evidence" as const,
    evidenceId: "BP104-PHYSICAL-001",
    status: "measured" as const,
    recordedAtUtc: "2026-08-23T00:00:00.000Z",
    operator: "operator",
    boardId: "board-1",
    harnessId: "harness-1",
    testPlugMpn: "44242-0005" as const,
    equipment: {
      manufacturer: "meter maker",
      model: "meter model",
      serialNumber: "meter-1",
      calibrationCertificate: "certificate-1",
      calibrationDueDate: "2027-08-23"
    },
    method: {
      powerState: "off-and-discharged" as const,
      continuityTestVoltageV: 5,
      isolationTestVoltageV: 5 as const,
      leadCompensationMethod: "zeroed-with-same-leads-at-fixture" as const,
      compensatedLeadResidualOhms: 0.2
    },
    endToEnd: signals.map((signal, index) => ({
      boardPin: index + 1,
      harnessCircuit: index + 1,
      signal,
      resistanceOhms: 2
    })),
    isolation,
    openCircuitChecks: Array.from({ length: 5 }, (_, index) => ({
      boardPin: index + 8,
      harnessCircuit: index + 8,
      resistanceOhms: 10_000_000
    })),
    negativeTests: [
      { id: "BP104-NEG-SWAP" as const, result: "rejected" as const, observation: "swap rejected" },
      { id: "BP104-NEG-OPEN" as const, result: "rejected" as const, observation: "open rejected" },
      { id: "BP104-NEG-RETURN-BOND" as const, result: "rejected" as const, observation: "bond rejected" },
      { id: "BP104-NEG-REVERSED-MATE" as const, result: "rejected" as const, observation: "reverse rejected" }
    ]
  }
}

function completeEvidence() {
  let sequence = 0
  const nextArtifact = (label: string) => artifact(`${label}-${++sequence}`)
  const continuitySamples = benchPrototypeConnectorPreorder.samples.filter(
    (sample) => sample.continuityMeasurements.length > 0
  )
  return {
    artifactKind: "bench-prototype-connector-preorder-evidence" as const,
    status: "measured" as const,
    evidenceId: "BP034-001",
    recordedAtUtc: "2026-08-23T00:00:00.000Z",
    operator: "operator",
    samples: benchPrototypeConnectorPreorder.samples.map((sample) => ({
      id: sample.id,
      components: sample.requiredComponents.map((entry) => ({
        ...entry,
        supplier: "authorized supplier",
        receiptId: `receipt-${sample.id}-${entry.mpn}`,
        lotOrDateCode: "lot-1"
      }))
    })),
    drawingAndCad: benchPrototypeConnectorPreorder.samples.map((sample) => ({
      id: sample.id,
      drawingRevision: "rev-a",
      drawingArtifact: nextArtifact(`drawing-${sample.id}`),
      cadArtifact: nextArtifact(`cad-${sample.id}`),
      footprintReference: sample.interfaceReferences[0],
      pinOneOverlayAccepted: true as const,
      boardEdgeAndKeepoutAccepted: true as const,
      reviewer: "reviewer"
    })),
    matingAndOrientation: benchPrototypeConnectorPreorder.samples.map((sample) => ({
      id: sample.id,
      mates: sample.requiredComponents.slice(1).map((entry) => ({
        ...entry,
        pinOneOrKeyPhoto: nextArtifact(`key-${sample.id}-${entry.mpn}`),
        fullySeatedPhoto: nextArtifact(`seated-${sample.id}-${entry.mpn}`)
      })),
      insertionDirection: "recorded",
      retentionObserved: true as const,
      wrongMateOrReversalRejected: true as const
    })),
    retentionAndStrain: benchPrototypeConnectorPreorder.samples.map((sample) => ({
      id: sample.id,
      loadPath: "independent support",
      cableExitDirection: "recorded",
      retentionArtifact: nextArtifact(`retention-${sample.id}`),
      strainArtifact: nextArtifact(`strain-${sample.id}`),
      solderJointsAreNotSoleRetention: true as const
    })),
    continuity: continuitySamples.map((sample) => ({
      id: sample.id,
      checklistRevision: "rev-a",
      evidenceArtifact: nextArtifact(`continuity-${sample.id}`),
      equipment: {
        manufacturer: "meter maker",
        model: "meter model",
        serialNumber: "meter-1",
        calibrationCertificate: artifact("meter-certificate"),
        calibrationDueDate: "2027-08-23"
      },
      method: {
        powerState: "off-and-discharged" as const,
        testVoltageV: 5,
        leadCompensationMethod: "zeroed-with-same-leads-at-fixture" as const,
        compensatedLeadResidualOhms: 0.2
      },
      measurements: sample.continuityMeasurements.map((entry) => ({
        ...entry,
        resistanceOhms: 2
      })),
      negativeTests: ["open", "polarity", "reversal", "swap"].map((id) => ({
        id,
        result: "rejected",
        observation: `${id} rejected`,
        artifact: nextArtifact(`negative-${sample.id}-${id}`)
      }))
    })),
    weaponFixtureContinuity: weaponEvidence()
  }
}

describe("BP-034 connector pre-order evidence", () => {
  it("freezes aliases, exact component sets, and unresolved cable selections", () => {
    expect(validateBenchPrototypeConnectorPreorder(benchPrototypeConnectorPreorder)).toBe(true)
    expect(benchPrototypeConnectorPreorder.fabricationDisposition).toBe("DENY")
    expect(benchPrototypeConnectorPreorder.samples[1].interfaceReferences).toEqual(["J_LAB_INJECTION"])
    expect(benchPrototypeConnectorPreorder.samples[6].interfaceReferences).toEqual(["J_ESP32_SERVICE", "J_ESP_SERVICE"])
    expect(benchPrototypeConnectorPreorder.samples[9].requiredComponents.map((entry) => entry.mpn)).toContain(
      "SYM-001T-P0.6"
    )
    expect(benchPrototypeConnectorPreorder.samples[9].requiredComponents.map((entry) => entry.mpn)).toContain(
      "SHF-001T-0.8BS"
    )
    expect(
      benchPrototypeConnectorPreorder.samples
        .filter((sample) => sample.selectionState !== "exact")
        .map((sample) => sample.id)
    ).toEqual(["usb-c-input", "ethernet-magjack"])
    expect(benchPrototypeConnectorPreorder.samples[1].requiredComponents.map((entry) => entry.quantity)).toEqual([
      1, 1, 4
    ])
    expect(benchPrototypeConnectorPreorder.samples[2].requiredComponents.map((entry) => entry.quantity)).toEqual([
      4, 4, 8
    ])
    expect(benchPrototypeConnectorPreorder.samples[3].requiredComponents.map((entry) => entry.quantity)).toEqual([
      1, 1, 7
    ])
  })

  it("keeps otherwise complete physical evidence denied while exact cable selections are open", () => {
    const result = evaluateBenchPrototypeConnectorPreorderEvidence(completeEvidence())
    expect(result.accepted).toBe(false)
    expect(result.reasons).toEqual([
      expect.stringContaining("usb-c-input selection remains blocked"),
      expect.stringContaining("ethernet-magjack selection remains blocked")
    ])
  })

  it("rejects missing, extra, reordered, and duplicate mate components", () => {
    const candidate = completeEvidence()
    const target = candidate.samples[1]!
    for (const components of [
      target.components.slice(0, -1),
      [...target.components, target.components[0]],
      [target.components[1], target.components[0], target.components[2]],
      [target.components[0], target.components[1], target.components[1]]
    ]) {
      const result = evaluateBenchPrototypeConnectorPreorderEvidence({
        ...candidate,
        samples: candidate.samples.map((row, index) => (index === 1 ? { ...row, components } : row))
      })
      expect(result.accepted).toBe(false)
      expect(
        result.reasons.some(
          (reason) =>
            reason === "samples record 2 must be a complete lab-injection record" ||
            reason.includes("cycle or object alias")
        )
      ).toBe(true)
    }

    const mateRow = candidate.matingAndOrientation[1]!
    for (const mates of [
      mateRow.mates.slice(0, -1),
      [...mateRow.mates, mateRow.mates[0]],
      [mateRow.mates[1], mateRow.mates[0]],
      [mateRow.mates[0], mateRow.mates[0]]
    ]) {
      const result = evaluateBenchPrototypeConnectorPreorderEvidence({
        ...candidate,
        matingAndOrientation: candidate.matingAndOrientation.map((row, index) =>
          index === 1 ? { ...row, mates } : row
        )
      })
      expect(result.accepted).toBe(false)
      expect(
        result.reasons.some(
          (reason) =>
            reason === "matingAndOrientation record 2 must be a complete lab-injection record" ||
            reason.includes("cycle or object alias")
        )
      ).toBe(true)
    }
  })

  it("rejects artifact-ID hash conflicts and non-measurement continuity claims", () => {
    const candidate = completeEvidence()
    const drawingAndCad = candidate.drawingAndCad.map((row, index) =>
      index === 1
        ? {
            ...row,
            drawingArtifact: {
              artifactId: candidate.drawingAndCad[0]!.drawingArtifact.artifactId,
              sha256: "B".repeat(64)
            }
          }
        : row
    )
    const continuity = candidate.continuity.map((row, index) =>
      index === 0
        ? {
            ...row,
            measurements: row.measurements.map((measurement, measurementIndex) =>
              measurementIndex === 0 ? { ...measurement, resistanceOhms: 2.01 } : measurement
            )
          }
        : row
    )
    const result = evaluateBenchPrototypeConnectorPreorderEvidence({ ...candidate, drawingAndCad, continuity })
    expect(result.reasons.some((reason) => reason.includes("reuses artifact ID"))).toBe(true)
    expect(result.reasons).toContain("continuity record 1 must be a complete usb-c-input record")
  })

  it("rejects a correct measurement ID attached to the wrong frozen endpoint", () => {
    const candidate = completeEvidence()
    const continuity = candidate.continuity.map((row, index) =>
      index === 1
        ? {
            ...row,
            measurements: row.measurements.map((entry, measurementIndex) =>
              measurementIndex === 0 ? { ...entry, from: "J_LAB_INJECTION.2[LAB_20V]" } : entry
            )
          }
        : row
    )
    const result = evaluateBenchPrototypeConnectorPreorderEvidence({ ...candidate, continuity })
    expect(result.reasons).toContain("continuity record 2 must be a complete lab-injection record")

    const wrongNet = candidate.continuity.map((row, index) =>
      index === 2
        ? {
            ...row,
            measurements: row.measurements.map((entry, measurementIndex) =>
              measurementIndex === 0 ? { ...entry, to: "39-01-2020.1[WRONG_NET]" } : entry
            )
          }
        : row
    )
    expect(evaluateBenchPrototypeConnectorPreorderEvidence({ ...candidate, continuity: wrongNet }).reasons).toContain(
      "continuity record 3 must be a complete measurement-link record"
    )
  })

  it("requires exact received and mated quantities", () => {
    const candidate = completeEvidence()
    for (const quantity of [3, 5]) {
      const samples = candidate.samples.map((row, index) =>
        index === 1
          ? {
              ...row,
              components: row.components.map((entry, componentIndex) =>
                componentIndex === 2 ? { ...entry, quantity } : entry
              )
            }
          : row
      )
      expect(evaluateBenchPrototypeConnectorPreorderEvidence({ ...candidate, samples }).reasons).toContain(
        "samples record 2 must be a complete lab-injection record"
      )

      const matingAndOrientation = candidate.matingAndOrientation.map((row, index) =>
        index === 1
          ? {
              ...row,
              mates: row.mates.map((entry, mateIndex) => (mateIndex === 1 ? { ...entry, quantity } : entry))
            }
          : row
      )
      expect(evaluateBenchPrototypeConnectorPreorderEvidence({ ...candidate, matingAndOrientation }).reasons).toContain(
        "matingAndOrientation record 2 must be a complete lab-injection record"
      )
    }
  })

  it("rejects extra, hidden, symbol, accessor, sparse, subclass, cycle, and alias data", () => {
    const withExtra = completeEvidence()
    expect(evaluateBenchPrototypeConnectorPreorderEvidence({ ...withExtra, extra: true }).reasons).toContain(
      "evidence must contain only the exact BP-034 enumerable data keys"
    )

    const withNestedExtra = completeEvidence()
    const nestedSamples = withNestedExtra.samples.map((row, index) =>
      index === 0 ? { ...row, unexpected: true } : row
    )
    expect(
      evaluateBenchPrototypeConnectorPreorderEvidence({ ...withNestedExtra, samples: nestedSamples }).reasons
    ).toContain("samples record 1 must be a complete usb-c-input record")

    const withHidden = completeEvidence()
    Object.defineProperty(withHidden.samples[0]!, "hidden", { enumerable: false, value: true })
    expect(
      evaluateBenchPrototypeConnectorPreorderEvidence(withHidden).reasons.some((reason) =>
        reason.includes("must be an enumerable data property")
      )
    ).toBe(true)

    const withSymbol = completeEvidence()
    Object.defineProperty(withSymbol.samples[0]!, Symbol("unexpected"), { enumerable: true, value: true })
    expect(
      evaluateBenchPrototypeConnectorPreorderEvidence(withSymbol).reasons.some((reason) =>
        reason.includes("must not contain symbol keys")
      )
    ).toBe(true)

    const withAccessor = completeEvidence()
    let accessorInvoked = false
    Object.defineProperty(withAccessor, "unexpectedAccessor", {
      enumerable: true,
      get() {
        accessorInvoked = true
        return true
      }
    })
    expect(evaluateBenchPrototypeConnectorPreorderEvidence(withAccessor).accepted).toBe(false)
    expect(accessorInvoked).toBe(false)

    const withSparse = completeEvidence()
    const sparseContinuity = [...withSparse.continuity]
    delete sparseContinuity[1]
    expect(
      evaluateBenchPrototypeConnectorPreorderEvidence({ ...withSparse, continuity: sparseContinuity }).reasons.some(
        (reason) => reason.includes("dense plain array")
      )
    ).toBe(true)

    class EvidenceArray<T> extends Array<T> {}
    const withSubclass = completeEvidence()
    const subclassSamples = EvidenceArray.from(withSubclass.samples)
    expect(
      evaluateBenchPrototypeConnectorPreorderEvidence({ ...withSubclass, samples: subclassSamples }).reasons.some(
        (reason) => reason.includes("plain array")
      )
    ).toBe(true)

    const withCycle = completeEvidence()
    Object.defineProperty(withCycle.samples[0]!, "cycle", {
      enumerable: true,
      value: withCycle.samples[0]
    })
    expect(
      evaluateBenchPrototypeConnectorPreorderEvidence(withCycle).reasons.some((reason) =>
        reason.includes("cycle or object alias")
      )
    ).toBe(true)

    const withAlias = completeEvidence()
    const drawingAndCad = withAlias.drawingAndCad.map((row, index) =>
      index === 1 ? { ...row, drawingArtifact: withAlias.drawingAndCad[0]!.drawingArtifact } : row
    )
    expect(
      evaluateBenchPrototypeConnectorPreorderEvidence({ ...withAlias, drawingAndCad }).reasons.some((reason) =>
        reason.includes("cycle or object alias")
      )
    ).toBe(true)
  })

  it("rejects unrelated artifact reuse but explicitly allows one calibration certificate identity", () => {
    const candidate = completeEvidence()
    const drawingAndCad = candidate.drawingAndCad.map((row, index) =>
      index === 1 ? { ...row, drawingArtifact: { ...candidate.drawingAndCad[0]!.drawingArtifact } } : row
    )
    const result = evaluateBenchPrototypeConnectorPreorderEvidence({ ...candidate, drawingAndCad })
    expect(result.reasons.some((reason) => reason.includes("outside the explicit calibration-certificate rule"))).toBe(
      true
    )
    expect(
      evaluateBenchPrototypeConnectorPreorderEvidence(candidate).reasons.filter((reason) =>
        reason.includes("calibrationCertificate")
      )
    ).toEqual([])

    const crossInstrument = candidate.continuity.map((row, index) =>
      index === 1 ? { ...row, equipment: { ...row.equipment, serialNumber: "meter-2" } } : row
    )
    expect(
      evaluateBenchPrototypeConnectorPreorderEvidence({ ...candidate, continuity: crossInstrument }).reasons.some(
        (reason) => reason.includes("for a different instrument")
      )
    ).toBe(true)
  })

  it("delegates weapon acceptance to the exact BP-104 7+66+5 evaluator", () => {
    const candidate = completeEvidence()
    const result = evaluateBenchPrototypeConnectorPreorderEvidence({
      ...candidate,
      weaponFixtureContinuity: {
        ...candidate.weaponFixtureContinuity,
        isolation: candidate.weaponFixtureContinuity.isolation.slice(1)
      }
    })
    expect(result.reasons).toContain("weaponFixtureContinuity: all 66 unique pin-pair isolation readings are required")
  })
})
