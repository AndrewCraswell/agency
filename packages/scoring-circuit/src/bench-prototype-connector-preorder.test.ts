import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeConnectorUpstreamProvenance,
  benchPrototypeConnectorPreorder,
  benchPrototypeWeaponPanelHarness,
  evaluateBenchPrototypeConnectorPreorderEvidence,
  evaluateBenchPrototypeWeaponPanelHarnessEvidence,
  evaluateBenchPrototypeWeaponPanelPairEvidence,
  validateBenchPrototypeConnectorPreorder,
  validateBenchPrototypeConnectorUpstreamProvenance,
  validateBenchPrototypeWeaponPanelHarness
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
      powerState: "off-and-discharged" as const,
      forcedMateObserved: false as const,
      noForceMateAndUnmateResult: "accepted" as const,
      retentionObserved: true as const,
      rejectedMateOrReversalArtifact: nextArtifact(`rejected-mate-${sample.id}`)
    })),
    retentionAndStrain: benchPrototypeConnectorPreorder.samples.map((sample) => ({
      id: sample.id,
      loadPath: "independent support",
      cableExitDirection: "recorded",
      retentionMethod: "documented pull fixture",
      retentionLoadN: 20,
      retentionResult: "accepted" as const,
      retentionArtifact: nextArtifact(`retention-${sample.id}`),
      strainMethod: "documented cable-exit pull fixture",
      strainLoadN: 20,
      strainResult: "accepted" as const,
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

function completeWeaponPanelHarnessEvidence(side: "left" | "right" = "left") {
  let sequence = 0
  const nextArtifact = (label: string) => artifact(`${side}-${label}-${++sequence}`, "B".repeat(64))
  return {
    artifactKind: "bench-prototype-custom-weapon-panel-harness-evidence" as const,
    status: "measured" as const,
    evidenceId: `BP034-WEAPON-PANEL-${side.toUpperCase()}-001`,
    recordedAtUtc: "2026-08-24T00:00:00.000Z",
    operator: "operator",
    ownerCableCompatibility: "accepted-not-blocker" as const,
    panel: {
      side,
      socketManufacturer: "OK Fencing",
      socketMpn: "supplier-confirmed-socket",
      socketQuantity: 3 as const,
      socketIdentityArtifact: nextArtifact("socket-identity"),
      circuitOrder: ["A", "B", "C"] as const,
      panelMountMethod: "insulated panel mount",
      insulationMethod: "individual insulating bushes",
      mountAndInsulationArtifact: nextArtifact("mount-insulation")
    },
    rearTerminations: ["A", "B", "C"].map((circuit) => ({
      circuit: circuit as "A" | "B" | "C",
      socketRearTermination: "crimped insulated terminal",
      boardEndContact: "crimped board-harness contact",
      artifact: nextArtifact(`rear-${circuit}`)
    })),
    prototypeImplementation: {
      approach: "separate-sockets-to-board-landing-pads" as const,
      landingPads: ["A", "B", "C"].map((circuit) => ({
        circuit: circuit as "A" | "B" | "C",
        reference: `TP_WEAPON_${side.toUpperCase()}_${circuit}`,
        labeled: true as const,
        platedThroughHole: true as const,
        testLandingPad: true as const
      })),
      conductorMaterial: "stranded copper",
      conductorGaugeAwg: 22,
      insulation: "individual insulated conductors",
      lengthMm: 150,
      strainReliefAnchor: "panel clamp",
      clearanceMethod: "insulated conductors separated from metal bracket",
      noExposedShorts: true as const,
      artifact: nextArtifact("prototype-landing-pads")
    },
    mate: {
      powerState: "off-and-discharged" as const,
      forcedMateObserved: false as const,
      noForceMateAndUnmateResult: "accepted" as const,
      artifact: nextArtifact("mate")
    },
    continuity: ["A", "B", "C"].map((circuit) => ({
      circuit: circuit as "A" | "B" | "C",
      from: `PANEL_${side.toUpperCase()}.${circuit}`,
      to: `J_WEAPON_PANEL_${side.toUpperCase()}.${circuit}`,
      resistanceOhms: 2,
      artifact: nextArtifact(`continuity-${circuit}`)
    })),
    isolation: {
      testVoltageV: 5,
      minimumResistanceOhms: 10_000_000,
      artifact: nextArtifact("isolation")
    },
    negativeTests: ["open", "swap", "reversal"].map((id) => ({
      id: id as "open" | "swap" | "reversal",
      result: "rejected" as const,
      artifact: nextArtifact(`negative-${id}`)
    }))
  }
}

function completeWeaponPanelPairEvidence() {
  return {
    artifactKind: "bench-prototype-custom-weapon-panel-pair-evidence" as const,
    status: "measured" as const,
    evidenceId: "BP034-WEAPON-PANEL-PAIR-001",
    recordedAtUtc: "2026-08-24T00:00:00.000Z",
    operator: "operator",
    pairArtifact: artifact("weapon-panel-pair", "C".repeat(64)),
    sides: [completeWeaponPanelHarnessEvidence("left"), completeWeaponPanelHarnessEvidence("right")] as const
  }
}

describe("BP-034 connector pre-order evidence", () => {
  it("binds the exact committed interface identities and retains every release blocker", () => {
    expect(validateBenchPrototypeConnectorUpstreamProvenance(benchPrototypeConnectorUpstreamProvenance)).toBe(true)
    expect(benchPrototypeConnectorUpstreamProvenance.bp050).toMatchObject({
      workUnit: "BP-050",
      displayDisconnectReference: "J_DISPLAY_DISCONNECT",
      normalInput: { receptacleMpn: "10177070-00011LF", contractVoltageV: 20, contractCurrentA: 3 },
      authority: {
        displayConnectedPermit: "deny-until-inrush-measured",
        physicalPresenceVerified: false,
        releaseState: "deny"
      }
    })
    expect(benchPrototypeConnectorUpstreamProvenance.bp104).toMatchObject({
      workUnit: "BP-104",
      fabricationDisposition: "DENY",
      releaseState: "deny",
      connector: {
        boardReference: "J_WEAPON_FIXTURE",
        header: { mpn: "43045-1200" },
        mate: { mpn: "43025-1200" },
        testPlug: { mpn: "44242-0005" }
      }
    })
    expect(benchPrototypeConnectorUpstreamProvenance.bp124).toMatchObject({
      workUnit: "BP-124",
      releaseState: "deny",
      stm32: { headerMpn: "FTSH-105-01-L-DV-007-K", matingCableMpn: "FFSD-05-D-06.00-01-N" },
      esp32: { headerMpn: "TSW-106-07-G-S", matingSocketMpn: "SSW-106-01-G-S" }
    })
    expect(benchPrototypeConnectorUpstreamProvenance.bp141).toMatchObject({
      releaseState: "deny",
      controller: { reference: "U_W5500", mpn: "W5500" },
      magJack: { reference: "J_ETH", mpn: "7499011121A" },
      noMdiHarnessCrossing: false
    })
    expect(benchPrototypeConnectorUpstreamProvenance.bp143).toMatchObject({
      task: "BP-143",
      fabricationDisposition: "DENY",
      releaseState: "deny",
      boardConnector: { reference: "J_HUB75", mpn: "TST-108-04-G-D-RA" },
      signalCable: { productId: "4170" },
      powerCable: { productId: "4767", panelSideHousingMpn: "SMR-04V-N", cableSideHousingMpn: "SMP-04V-NC" },
      panel: { productId: "2277" }
    })
  })

  it("defines the separate owner-validated OK Fencing cable scope without granting release", () => {
    expect(validateBenchPrototypeWeaponPanelHarness(benchPrototypeWeaponPanelHarness)).toBe(true)
    expect(benchPrototypeWeaponPanelHarness).toMatchObject({
      workUnit: "BP-034",
      targetAssembly: "per-side custom three-socket prototype weapon interface",
      cableCompatibility: { supplier: "OK Fencing", status: "owner-validated-not-a-blocker" },
      perPanelCircuitOrder: ["A", "B", "C"],
      productionHarness: { status: "later-gate", selectionState: "unselected" },
      fabricationDisposition: "DENY",
      releaseState: "deny"
    })
    for (const photo of benchPrototypeWeaponPanelHarness.ownerReferencePhotos) {
      const bytes = readFileSync(new URL(`../${photo.assetPath}`, import.meta.url))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(photo.sha256)
    }
    expect(benchPrototypeWeaponPanelHarness.photoNonClaims).toContain(
      "They do not identify a socket SKU, spacing, material, rating, final panel geometry, or board-side connector."
    )
  })

  it("fails closed when any upstream identity or release gate drifts", () => {
    const mutations: readonly ((candidate: typeof benchPrototypeConnectorUpstreamProvenance) => void)[] = [
      (candidate) => void Reflect.set(candidate.bp050.normalInput, "receptacleMpn", "FORGED"),
      (candidate) => void Reflect.set(candidate.bp104.connector.testPlug, "mpn", "FORGED"),
      (candidate) => void Reflect.set(candidate.bp124.esp32, "matingSocketMpn", "FORGED"),
      (candidate) => void Reflect.set(candidate.bp141.magJack, "mpn", "FORGED"),
      (candidate) => void Reflect.set(candidate.bp143.authority, "fabricationAuthorized", true)
    ]
    for (const mutate of mutations) {
      const candidate = structuredClone(benchPrototypeConnectorUpstreamProvenance)
      mutate(candidate)
      expect(() => validateBenchPrototypeConnectorUpstreamProvenance(candidate)).toThrow(RangeError)
    }
  })

  it("freezes aliases, exact component sets, and source-backed cable selections", () => {
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
    expect(benchPrototypeConnectorPreorder.samples.every((sample) => sample.selectionState === "exact")).toBe(true)
    expect(benchPrototypeConnectorPreorder.samples[0].requiredComponents[1]).toEqual({
      manufacturer: "StarTech.com",
      mpn: "USB2CC1M",
      quantity: 1
    })
    expect(benchPrototypeConnectorPreorder.samples[0].sourceEvidence).toEqual({
      sourceUrl: "https://media.startech.com/cms/pdfs/usb2cc1m_datasheet.pdf",
      assetPath: "docs/evidence/bp-034/startech-usb2cc1m-datasheet.pdf",
      sha256: "AE5241D2A65A5B64F737D4205FD428B0432567EA98FA1482520AB0D9F345FAE7"
    })
    const ethernetPaths = benchPrototypeConnectorPreorder.samples.find(
      (sample) => sample.id === "ethernet-magjack"
    )!.continuityMeasurements
    expect(ethernetPaths).toHaveLength(9)
    expect(ethernetPaths.map((row) => row.id)).toEqual([
      "8p8c-contact-1",
      "8p8c-contact-2",
      "8p8c-contact-3",
      "8p8c-contact-4",
      "8p8c-contact-5",
      "8p8c-contact-6",
      "8p8c-contact-7",
      "8p8c-contact-8",
      "shield-shell"
    ])
    expect(benchPrototypeConnectorPreorder.samples[0].selectionBasis).toMatchObject({
      cableEnds: "USB-C male to USB-C male",
      maximumVoltageV: 20,
      maximumCurrentA: 3
    })
    expect(benchPrototypeConnectorPreorder.samples[7].requiredComponents[1]).toEqual({
      manufacturer: "Eaton, Tripp Lite series",
      mpn: "N201-003-BL",
      quantity: 1
    })
    expect(benchPrototypeConnectorPreorder.samples[7].sourceEvidence).toEqual({
      sourceUrl: "https://assets.tripplite.com/product-pdfs/en/n201003bl.pdf",
      assetPath: "docs/evidence/bp-034/eaton-tripp-lite-n201-003-bl-datasheet.pdf",
      sha256: "BB81E709DFD1E57546379D2962431CD1D1C2445E038E81B053521B6231A14C12"
    })
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

  it("binds each exact cable selection to the retained primary-source bytes", () => {
    const sources = [
      benchPrototypeConnectorPreorder.samples[0].sourceEvidence,
      benchPrototypeConnectorPreorder.samples[7].sourceEvidence
    ]
    for (const source of sources) {
      if (source === undefined) throw new Error("Each selected cable requires retained primary-source evidence")
      const bytes = readFileSync(new URL(`../${source.assetPath}`, import.meta.url))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
    }
  })

  it("allows a complete physical-evidence fixture after cable selection", () => {
    const result = evaluateBenchPrototypeConnectorPreorderEvidence(completeEvidence())
    expect(result).toEqual({ accepted: true, reasons: [] })
  })

  it("requires a complete custom A/B/C panel harness evidence scope without changing BP-104", () => {
    expect(evaluateBenchPrototypeWeaponPanelHarnessEvidence(completeWeaponPanelHarnessEvidence())).toEqual({
      accepted: true,
      reasons: []
    })
    const candidate = completeWeaponPanelHarnessEvidence()
    expect(
      evaluateBenchPrototypeWeaponPanelHarnessEvidence({
        ...candidate,
        panel: { ...candidate.panel, circuitOrder: ["B", "A", "C"] }
      }).reasons
    ).toContain("panel must define one insulated A/B/C three-socket panel with immutable evidence")
    expect(
      evaluateBenchPrototypeWeaponPanelHarnessEvidence({
        ...candidate,
        mate: { ...candidate.mate, forcedMateObserved: true }
      }).reasons
    ).toContain("mate must be de-energized, non-forced, accepted for mate/unmate, and immutable")
    expect(
      evaluateBenchPrototypeWeaponPanelHarnessEvidence({
        ...candidate,
        negativeTests: candidate.negativeTests.slice(1)
      }).reasons
    ).toContain("open, swap, and reversal negative captures are required and must be rejected")
    expect(
      evaluateBenchPrototypeWeaponPanelHarnessEvidence({
        ...candidate,
        prototypeImplementation: {
          approach: "direct-carrier-pcb-mount" as const,
          mountingHoleReferences: ["MH_WEAPON_LEFT_1", "MH_WEAPON_LEFT_2"],
          mountingHardware: "documented screws and insulating hardware",
          insertionLoadPath: "carrier hardware into PCB mounting holes",
          solderJointsAreNotSoleMechanicalRetention: true as const,
          artifact: artifact("direct-carrier-mount", "C".repeat(64))
        }
      })
    ).toEqual({ accepted: true, reasons: [] })
    expect(
      evaluateBenchPrototypeWeaponPanelHarnessEvidence({
        ...candidate,
        prototypeImplementation: {
          ...candidate.prototypeImplementation,
          landingPads: candidate.prototypeImplementation.landingPads.map((row, index) =>
            index === 0 ? { ...row, platedThroughHole: false } : row
          )
        }
      }).reasons
    ).toContain("prototype implementation must be one complete reviewed direct mount or landing-pad alternative")
  })

  it("requires independent accepted left and right prototype interfaces", () => {
    const pair = completeWeaponPanelPairEvidence()
    expect(evaluateBenchPrototypeWeaponPanelPairEvidence(pair)).toEqual({ accepted: true, reasons: [] })
    expect(evaluateBenchPrototypeWeaponPanelPairEvidence({ ...pair, sides: [pair.sides[0]] }).reasons).toContain(
      "pair evidence must contain exactly one left and one right interface"
    )
    expect(
      evaluateBenchPrototypeWeaponPanelPairEvidence({
        ...pair,
        sides: [pair.sides[0], { ...pair.sides[1], panel: { ...pair.sides[1].panel, side: "left" } }]
      }).reasons
    ).toContain("pair side 2 must be the right interface")
    const duplicatedArtifactId = pair.sides[0].panel.socketIdentityArtifact.artifactId
    expect(
      evaluateBenchPrototypeWeaponPanelPairEvidence({
        ...pair,
        sides: [
          pair.sides[0],
          {
            ...pair.sides[1],
            panel: {
              ...pair.sides[1].panel,
              socketIdentityArtifact: {
                ...pair.sides[1].panel.socketIdentityArtifact,
                artifactId: duplicatedArtifactId
              }
            }
          }
        ]
      }).reasons
    ).toContain(`right reuses immutable artifact ID ${duplicatedArtifactId} across interfaces`)
    expect(
      evaluateBenchPrototypeWeaponPanelPairEvidence({
        ...pair,
        sides: [pair.sides[0], { ...pair.sides[1], evidenceId: pair.sides[0].evidenceId }]
      }).reasons
    ).toContain("right evidence ID must be unique across the left and right interfaces")
  })

  it("requires explicit non-forced mating and retention or strain methods, loads, and results", () => {
    const candidate = completeEvidence()
    const matingAndOrientation = candidate.matingAndOrientation.map((row, index) =>
      index === 0 ? { ...row, forcedMateObserved: true } : row
    )
    expect(evaluateBenchPrototypeConnectorPreorderEvidence({ ...candidate, matingAndOrientation }).reasons).toContain(
      "matingAndOrientation record 1 must be a complete usb-c-input record"
    )
    const retentionAndStrain = candidate.retentionAndStrain.map((row, index) =>
      index === 0 ? { ...row, strainLoadN: 0 } : row
    )
    expect(evaluateBenchPrototypeConnectorPreorderEvidence({ ...candidate, retentionAndStrain }).reasons).toContain(
      "retentionAndStrain record 1 must be a complete usb-c-input record"
    )
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
