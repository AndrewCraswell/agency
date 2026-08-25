import { describe, expect, it } from "vitest"
import {
  bp143ReceivedPanelPhysicalEvidenceIntake,
  evaluateBp143ReceivedPanelPhysicalEvidence
} from "./bp-143-received-panel-evidence.js"

const sha256 = (index: number) => index.toString(16).padStart(64, "0")

describe("BP-143 received-panel physical-evidence intake", () => {
  it("keeps the canonical intake absent and every release authority denied", () => {
    expect(bp143ReceivedPanelPhysicalEvidenceIntake).toMatchObject({
      state: "absent",
      receivedPanelEvidence: null,
      authority: {
        physicalEvidenceAccepted: false,
        schematicIntegrationAuthorized: false,
        footprintAuthorized: false,
        layoutAuthorized: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    expect(Object.isFrozen(bp143ReceivedPanelPhysicalEvidenceIntake)).toBe(true)
    expect(Object.isFrozen(bp143ReceivedPanelPhysicalEvidenceIntake.requiredSections)).toBe(true)
    expect(Object.isFrozen(bp143ReceivedPanelPhysicalEvidenceIntake.authority)).toBe(true)
    expect(Reflect.set(bp143ReceivedPanelPhysicalEvidenceIntake.requiredSections, 0, "forged")).toBe(false)
    expect(bp143ReceivedPanelPhysicalEvidenceIntake.requiredSections[0]).toBe("identity")
    const invalid = evaluateBp143ReceivedPanelPhysicalEvidence({})
    expect(invalid).toMatchObject({
      intakeComplete: false,
      releaseState: "deny"
    })
    expect(Object.isFrozen(invalid.reasons)).toBe(true)
    expect(Reflect.set(invalid.reasons, 0, "forged")).toBe(false)
  })

  it("requires all exact received identities, calibrated instruments, artifact hashes, and physical capture classes", () => {
    // Synthetic evaluator input only. It is intentionally not retained as physical evidence.
    const submission = () => {
      let artifact = 0
      const evidence = (prefix: string) => ({ artifactId: `${prefix}-${artifact}`, contentSha256: sha256(artifact++) })
      return {
        artifactKind: "bp143-received-panel-physical-evidence" as const,
        evidenceId: "bp143-ev-001",
        receivedAtUtc: "2026-08-24T10:00:00.000Z",
        recordedAtUtc: "2026-08-24T12:00:00.000Z",
        operator: "test operator",
        panel: {
          manufacturer: "Adafruit Industries" as const,
          productId: "2277" as const,
          model: "64x32 RGB LED Matrix - 5mm pitch" as const,
          pcbRevision: "panel-rev-a",
          panelSerialOrAssetId: "panel-001",
          receiptArtifact: evidence("panel-receipt")
        },
        prototype: {
          assemblyId: "prototype-001",
          boardRevision: "board-rev-a",
          boardSerialOrAssetId: "board-001",
          hub75BoardHeaderMpn: "TST-108-04-G-D-RA" as const
        },
        signalCable: {
          manufacturer: "Adafruit Industries" as const,
          productId: "4170" as const,
          cableSerialOrAssetId: "signal-cable-001",
          pinOneMarker: "white stripe" as const,
          receiptArtifact: evidence("signal-receipt")
        },
        powerCable: {
          manufacturer: "Adafruit Industries" as const,
          productId: "4767" as const,
          cableSerialOrAssetId: "power-cable-001",
          panelSideHousingMpn: "SMR-04V-N" as const,
          cableSideHousingMpn: "SMP-04V-NC" as const,
          receiptArtifact: evidence("power-receipt")
        },
        procedure: { revision: "procedure-r1", ...evidence("procedure") },
        setupArtifact: evidence("setup"),
        instruments: ["continuity-meter", "current-meter", "voltage-meter", "thermal-imager"].map((kind) => ({
          instrumentId: kind,
          kind: kind as "continuity-meter" | "current-meter" | "voltage-meter" | "thermal-imager",
          manufacturer: "instrument maker",
          model: "instrument model",
          serialNumber: `serial-${kind}`,
          calibrationArtifact: evidence(`calibration-${kind}`),
          calibrationValidFromUtc: "2026-01-01T00:00:00.000Z",
          calibrationValidUntilUtc: "2026-12-31T23:59:59.000Z"
        })),
        continuity: {
          status: "measured" as const,
          instrumentId: "continuity-meter",
          acceptanceCriteriaArtifact: evidence("continuity-criteria"),
          captureArtifact: evidence("continuity-capture"),
          signalPins: [
            "R1",
            "G1",
            "B1",
            "GND1",
            "R2",
            "G2",
            "B2",
            "GND2",
            "A",
            "B",
            "C",
            "D",
            "CLK",
            "LAT",
            "OE",
            "GND3"
          ].map((label, index) => ({
            boardPin: index + 1,
            panelPin: index + 1,
            label,
            resistanceOhms: 0.1
          })),
          powerBranches: [1, 2].map((branch) => ({
            branch: branch as 1 | 2,
            contacts: [
              { contact: 1, conductorColor: "red", net: "V5_DISPLAY_LIMITED", resistanceOhms: 0.1 },
              { contact: 2, conductorColor: "red", net: "V5_DISPLAY_LIMITED", resistanceOhms: 0.1 },
              { contact: 3, conductorColor: "black", net: "APP_GND", resistanceOhms: 0.1 },
              { contact: 4, conductorColor: "black", net: "APP_GND", resistanceOhms: 0.1 }
            ]
          }))
        },
        mating: {
          status: "measured" as const,
          captureArtifact: evidence("mating-capture"),
          signalCableMatedToPanelInput: true as const,
          signalCableMatedToPanelOutput: false as const,
          signalKeyFullySeated: true as const,
          powerBranchOneLatchEngaged: true as const,
          powerBranchTwoLatchEngaged: true as const
        },
        orientation: {
          status: "measured" as const,
          captureArtifact: evidence("orientation-capture"),
          panelInputPinOneIdentified: true as const,
          boardHeaderPinOneIdentified: true as const,
          cableWhiteStripeAtPinOne: true as const,
          powerPolarityConfirmed: true as const
        },
        current: {
          status: "measured" as const,
          instrumentId: "current-meter",
          declaredDisplayPatternArtifact: evidence("pattern"),
          captureArtifact: evidence("current-capture"),
          averageCurrentA: 2,
          peakCurrentA: 3,
          panelEndVoltageV: 4.9
        },
        cableDrop: {
          status: "measured" as const,
          voltageInstrumentId: "voltage-meter",
          branchCurrentInstrumentId: "current-meter",
          declaredDisplayPatternArtifactId: "pattern-13",
          captureArtifact: evidence("drop-capture"),
          supplyEndVoltageV: 5,
          panelEndVoltageV: 4.9,
          dropV: 0.1,
          powerBranchOneCurrentA: 1.5,
          powerBranchTwoCurrentA: 1.5
        },
        connectorTemperature: {
          status: "measured" as const,
          instrumentId: "thermal-imager",
          captureArtifact: evidence("temperature-capture"),
          ambientTemperatureC: -20,
          panelPowerConnectorTemperatureC: -10,
          harnessPowerConnectorTemperatureC: -11
        },
        fit: {
          status: "measured" as const,
          fixtureOrEnclosureId: "fit-fixture-001",
          captureArtifact: evidence("fit-capture"),
          panelInputAccessible: true as const,
          panelOutputUnconnected: true as const,
          signalCableNoForcedBend: true as const,
          powerCableNoForcedBend: true as const,
          connectorLatchesAccessible: true as const,
          interferenceObserved: false as const
        }
      }
    }
    const valid = submission()
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(valid)).toEqual({
      intakeComplete: true,
      fabricationAuthorized: false,
      releaseState: "deny",
      reasons: []
    })
    expect(Object.isFrozen(evaluateBp143ReceivedPanelPhysicalEvidence(valid).reasons)).toBe(true)

    const wrongPanel = submission()
    wrongPanel.panel.productId = "other" as never
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(wrongPanel).intakeComplete).toBe(false)

    const swappedSignal = submission()
    swappedSignal.continuity.signalPins[0]!.label = "G1"
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(swappedSignal).reasons).toContain(
      "continuity must prove all 16 exact straight-through HUB75 pins with finite resistance"
    )

    const missingPowerBranch = submission()
    missingPowerBranch.continuity.powerBranches.pop()
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(missingPowerBranch).intakeComplete).toBe(false)

    const wrongMating = submission()
    wrongMating.mating.signalCableMatedToPanelOutput = true as never
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(wrongMating).intakeComplete).toBe(false)

    const staleCalibration = submission()
    staleCalibration.instruments[0]!.calibrationValidUntilUtc = "2026-08-24T11:59:59.000Z"
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(staleCalibration).intakeComplete).toBe(false)

    const wrongDrop = submission()
    wrongDrop.cableDrop.dropV = 0.2
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(wrongDrop).intakeComplete).toBe(false)

    const wrongVoltageInstrument = submission()
    wrongVoltageInstrument.cableDrop.voltageInstrumentId = "current-meter"
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(wrongVoltageInstrument).intakeComplete).toBe(false)

    const inconsistentPanelEndVoltage = submission()
    inconsistentPanelEndVoltage.cableDrop.panelEndVoltageV = 4.8
    inconsistentPanelEndVoltage.cableDrop.dropV = 0.2
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(inconsistentPanelEndVoltage).intakeComplete).toBe(false)

    const wrongInstrument = submission()
    wrongInstrument.current.instrumentId = "thermal-imager"
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(wrongInstrument).intakeComplete).toBe(false)

    const duplicatedArtifact = submission()
    duplicatedArtifact.fit.captureArtifact = duplicatedArtifact.mating.captureArtifact
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(duplicatedArtifact).intakeComplete).toBe(false)

    const extraSignalField = submission()
    Reflect.set(extraSignalField.continuity.signalPins[0]!, "unreviewed", true)
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(extraSignalField).intakeComplete).toBe(false)

    const extraPowerContactField = submission()
    Reflect.set(extraPowerContactField.continuity.powerBranches[0]!.contacts[0]!, "unreviewed", true)
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(extraPowerContactField).intakeComplete).toBe(false)

    const extraPowerBranchField = submission()
    Reflect.set(extraPowerBranchField.continuity.powerBranches[0]!, "unreviewed", true)
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(extraPowerBranchField).intakeComplete).toBe(false)

    const futureRecord = submission()
    futureRecord.recordedAtUtc = "2099-01-01T00:00:00.000Z"
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(futureRecord).intakeComplete).toBe(false)

    const impossibleReceipt = submission()
    impossibleReceipt.receivedAtUtc = "2026-02-30T00:00:00.000Z"
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(impossibleReceipt).intakeComplete).toBe(false)

    const impossibleCalibration = submission()
    impossibleCalibration.instruments[0]!.calibrationValidFromUtc = "2026-02-30T00:00:00.000Z"
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(impossibleCalibration).intakeComplete).toBe(false)

    const accessor = submission()
    Object.defineProperty(accessor.fit, "interferenceObserved", { enumerable: true, get: () => false })
    expect(evaluateBp143ReceivedPanelPhysicalEvidence(accessor).intakeComplete).toBe(false)
  })
})
