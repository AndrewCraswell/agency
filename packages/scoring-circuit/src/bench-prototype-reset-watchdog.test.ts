import { describe, expect, it } from "vitest"
import { defaultApplicationRailInputs } from "./application-rail.js"
import {
  benchPrototypeResetWatchdog,
  evaluateBenchPrototypeResetWatchdogPhysicalEvidence,
  validateBenchPrototypeResetWatchdog
} from "./bench-prototype-reset-watchdog.js"

describe("BP-123 reset, supervisor, and watchdog contract", () => {
  it("uses exact local reset parts and the committed processor allocations", () => {
    expect(validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)).toBe(true)
    expect(benchPrototypeResetWatchdog.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: "U_STM_SUPERVISOR", mpn: "TPS389033DSER" }),
        expect.objectContaining({ reference: "U_ESP_SUPERVISOR", mpn: "TPS389033DSER" }),
        expect.objectContaining({ reference: "U_STM_WATCHDOG", mpn: "TPS3431SDRBR" }),
        expect.objectContaining({ reference: "U_ESP_WATCHDOG", mpn: "TPS3431SDRBR" }),
        expect.objectContaining({ reference: "R_STM_WD_CWD", mpn: "RC0603FR-0710KL" }),
        expect.objectContaining({ reference: "R_STM_WDI_PULLUP", mpn: "RC0603FR-07100KL" }),
        expect.objectContaining({ reference: "R_ESP_WD_CWD", mpn: "RC0603FR-0710KL" }),
        expect.objectContaining({ reference: "R_ESP_WDI_PULLUP", mpn: "RC0603FR-07100KL" }),
        expect.objectContaining({ reference: "Q_ESP_RESET_STM", mpn: "BSS138AKA" }),
        expect.objectContaining({
          reference: "Q_ESP_DEBUG_RESET",
          mpn: "BSS138AKA",
          connections: "source to APP_GND; drain to EN_RESET; gate from MANUAL_RESET_ASSERT through R_DEBUG_RESET_GATE"
        }),
        expect.objectContaining({
          reference: "R_DEBUG_RESET_GATE",
          mpn: "RC0603FR-0710KL",
          connections: "MANUAL_RESET_ASSERT to Q_ESP_DEBUG_RESET gate"
        }),
        expect.objectContaining({
          reference: "R_DEBUG_RESET_GATE_PD",
          mpn: "RC0603FR-07100KL",
          connections: "Q_ESP_DEBUG_RESET gate to APP_GND"
        }),
        expect.objectContaining({ reference: "U_APP_RESET_FANOUT", mpn: "SN74LVC2G07DCKR" }),
        expect.objectContaining({ reference: "R_APP_SUPERVISOR_RESET_PULLUP", mpn: "RC0603FR-0710KL" })
      ])
    )
    expect(benchPrototypeResetWatchdog.prerequisites).toMatchObject({
      application3v3: { workUnit: "BP-142" },
      stm32Allocation: { watchdogWdi: "PC9" },
      esp32Allocation: { watchdogWdi: "GPIO12" },
      scoring3v3: { upstreamWorkUnits: ["BP-050", "BP-122"], evidenceState: "deny" }
    })
  })

  it("keeps local resets local and gives the STM32 a sink-only one-way ESP32 request", () => {
    expect(benchPrototypeResetWatchdog.resetTopology.scoring.sinks).toEqual(
      expect.arrayContaining(["U_STM_SUPERVISOR.RESET", "U_STM_WATCHDOG.WDO+ENOUT", "J_STM_SWD.NRST open-drain only"])
    )
    expect(benchPrototypeResetWatchdog.resetTopology.application.sinks).toEqual(
      expect.arrayContaining([
        "U_APP_RESET_FANOUT.Y1",
        "U_ESP_WATCHDOG.WDO+ENOUT",
        "Q_ESP_RESET_STM",
        "Q_ESP_DEBUG_RESET"
      ])
    )
    expect(benchPrototypeResetWatchdog.resetTopology.crossDomain.permittedPath).toContain("ISO7762FDWR")
    expect(benchPrototypeResetWatchdog.resetTopology.crossDomain.permittedPath).toContain("ESP32_RESET_ASSERT")
    expect(benchPrototypeResetWatchdog.resetTopology.crossDomain.permittedPath).toContain("RESET_REQUEST")
    expect(benchPrototypeResetWatchdog.resetTopology.crossDomain.prohibited.join(" ")).toContain("No ESP32 GPIO")
    expect(benchPrototypeResetWatchdog.resetTopology.crossDomain.prohibited.join(" ")).toContain("do not automatically")
    expect(benchPrototypeResetWatchdog.resetTopology.application.supervisorFanout).toMatchObject({
      part: "SN74LVC2G07DCKR",
      processorOutput: "Y1 open-drain to EN_RESET",
      ethernetOutput: "Y2 open-drain to APP_W5500_RESET_N"
    })
    expect(benchPrototypeResetWatchdog.resetTopology.application.supervisorFanout.isolationRule).toContain(
      "APP_W5500_RESET_N is supervisor-only"
    )
  })

  it("carries worst-case supervisor and watchdog timing into both domains", () => {
    expect(benchPrototypeResetWatchdog.timingEvidence.supervisor).toMatchObject({
      domains: ["scoring", "application"],
      fallingThresholdNominalV: 3.17,
      risingThresholdNominalV: 3.189,
      risingThresholdWorstHighV: 3.22089,
      ctNominalUf: 0.1,
      ctEffectiveMinimumUf: 0.0612,
      releaseDelayGuaranteedMinimumMs: 53.04,
      releaseDelayNominalMs: 106.98
    })
    expect(benchPrototypeResetWatchdog.timingEvidence.watchdog).toMatchObject({
      domains: ["scoring", "application"],
      watchdogTimeoutMs: { minimum: 170, nominal: 200, maximum: 230 },
      resetPulseMs: { minimum: 170, nominal: 200, maximum: 230 },
      startupVddMinimumV: 1.8,
      startupVddMinimumDurationUs: 300,
      wdiResponseSetupUs: 150
    })
    expect(benchPrototypeResetWatchdog.watchdogKick).toMatchObject({
      activeEdge: "falling",
      idleState: "high from the exact local 100 kOhm pull-up",
      gpioMode: "open-drain; briefly sink low, then release",
      maximumFirmwareKickIntervalMs: 100
    })
    expect(benchPrototypeResetWatchdog.watchdogKick.failureSemantics).toContain("High-Z, stuck-high, and stuck-low")
    expect(benchPrototypeResetWatchdog.watchdogKick.scoring.pullup).toContain("R_STM_WDI_PULLUP")
    expect(benchPrototypeResetWatchdog.watchdogKick.application.pullup).toContain("R_ESP_WDI_PULLUP")
  })

  it("specifies all required fault and service states, including power-off containment", () => {
    expect(benchPrototypeResetWatchdog.truthTable.map((row) => row.condition)).toEqual([
      "cold start",
      "application brownout",
      "scoring brownout",
      "processor watchdog timeout",
      "manual reset",
      "STM32 requested ESP32 reset",
      "application power off while scoring remains powered",
      "scoring power off while application remains powered"
    ])
    expect(benchPrototypeResetWatchdog.requiredBenchEvidence).toHaveLength(6)
    expect(benchPrototypeResetWatchdog.openGates.join(" ")).toContain("BP-144")
    expect(benchPrototypeResetWatchdog.deniedEvidence).toMatchObject({
      exactFootprintsApproved: false,
      scoringRailImplementationApproved: false,
      supervisorAndWatchdogTimingMeasured: false,
      layoutApproved: false,
      benchTruthTableVerified: false,
      fabricationApproved: false
    })
  })

  it("keeps physical evidence absent while freezing a calibrated, hash-bound capture intake", () => {
    const intake = benchPrototypeResetWatchdog.physicalEvidenceIntake
    expect(intake.state).toBe("absent")
    expect(intake.captures).toEqual([])
    expect(intake.requiredCaptures.map((capture) => capture.captureId)).toEqual([
      "BP123-COLD-START",
      "BP123-BROWNOUT",
      "BP123-WATCHDOG",
      "BP123-MANUAL-RESET",
      "BP123-CROSS-DOMAIN",
      "BP123-POWER-OFF"
    ])
    expect(
      intake.requiredCaptures.find((capture) => capture.captureId === "BP123-POWER-OFF")?.requiredObservedSignals
    ).toEqual(expect.arrayContaining(["INJECTED_CURRENT", "EN_RESET", "RESET_REQUEST"]))
    expect(intake.authority).toEqual({
      physicalEvidenceAccepted: false,
      benchTruthTableVerified: false,
      schematicIntegrationAuthorized: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
    expect(evaluateBenchPrototypeResetWatchdogPhysicalEvidence({}).accepted).toBe(false)
    expect(
      evaluateBenchPrototypeResetWatchdogPhysicalEvidence({
        artifactKind: "bench-prototype-reset-watchdog-physical-evidence",
        evidenceId: "not-a-capture",
        captures: []
      }).reasons
    ).toContain("all six required BP-123 capture classes are required")
  })

  it("calculates physical-capture acceptance from immutable provenance and frozen measurements", () => {
    const intake = benchPrototypeResetWatchdog.physicalEvidenceIntake
    const sha256 = (index: number) => index.toString(16).padStart(64, "0")
    // Synthetic evaluator input only. It is not stored in the canonical intake and is not physical evidence.
    const makeSubmission = () => ({
      artifactKind: "bench-prototype-reset-watchdog-physical-evidence" as const,
      evidenceId: "evaluator-fixture",
      captures: intake.requiredCaptures.map((requirement, index) => ({
        captureId: requirement.captureId,
        status: "measured" as const,
        recordedAtUtc: "2026-08-24T12:00:00.000Z",
        operator: "test operator",
        prototype: { assemblyId: "test-assembly", boardRevision: "test-revision", serialNumber: "test-serial" },
        instrument: {
          manufacturer: "test instrument maker",
          model: "test scope",
          serialNumber: `test-scope-${index}`,
          calibrationArtifact: { artifactId: `calibration-${index}`, contentSha256: sha256(100 + index) },
          calibrationDueDate: "2026-12-31"
        },
        captureArtifact: { artifactId: `capture-${index}`, contentSha256: sha256(200 + index) },
        setupArtifact: { artifactId: `setup-${index}`, contentSha256: sha256(300 + index) },
        procedure: {
          revision: "test-procedure-r1",
          artifactId: `procedure-${index}`,
          contentSha256: sha256(400 + index)
        },
        injectedInputProfile: { artifactId: `input-${index}`, contentSha256: sha256(500 + index) },
        observedSignals: [...requirement.requiredObservedSignals],
        measurements: requirement.requiredMetrics.map((metric) => ({
          id: metric.id,
          unit: metric.unit,
          value: (metric.minimum + metric.maximum) / 2
        }))
      }))
    })

    expect(evaluateBenchPrototypeResetWatchdogPhysicalEvidence(makeSubmission())).toMatchObject({ accepted: true })

    const missingCalibrationHash = makeSubmission()
    missingCalibrationHash.captures[0]!.instrument.calibrationArtifact.contentSha256 = "not-a-digest"
    expect(evaluateBenchPrototypeResetWatchdogPhysicalEvidence(missingCalibrationHash).accepted).toBe(false)

    const missingProcedure = makeSubmission()
    Reflect.deleteProperty(missingProcedure.captures[0]!, "procedure")
    expect(evaluateBenchPrototypeResetWatchdogPhysicalEvidence(missingProcedure).accepted).toBe(false)

    const outOfLimit = makeSubmission()
    outOfLimit.captures[2]!.measurements[0]!.value = Number.POSITIVE_INFINITY
    expect(evaluateBenchPrototypeResetWatchdogPhysicalEvidence(outOfLimit).accepted).toBe(false)

    const duplicateMetric = makeSubmission()
    duplicateMetric.captures[5]!.measurements[1]!.id = duplicateMetric.captures[5]!.measurements[0]!.id
    expect(evaluateBenchPrototypeResetWatchdogPhysicalEvidence(duplicateMetric).accepted).toBe(false)

    const extraMetric = makeSubmission()
    extraMetric.captures[4]!.measurements.push({ ...extraMetric.captures[4]!.measurements[0]! })
    expect(evaluateBenchPrototypeResetWatchdogPhysicalEvidence(extraMetric).accepted).toBe(false)

    const mismatchedPrototype = makeSubmission()
    mismatchedPrototype.captures[3]!.prototype.serialNumber = "other-prototype"
    expect(evaluateBenchPrototypeResetWatchdogPhysicalEvidence(mismatchedPrototype).accepted).toBe(false)
  })

  it("fails closed for forged graphs and a broken application 3V3 prerequisite", () => {
    const changedMpn = structuredClone(benchPrototypeResetWatchdog)
    Reflect.set(changedMpn.parts[0]!, "mpn", "FORGED")
    expect(() => validateBenchPrototypeResetWatchdog(changedMpn)).toThrow(RangeError)

    for (const mutate of [
      (candidate: typeof benchPrototypeResetWatchdog) => {
        Reflect.set(
          candidate.parts.find((part) => part.reference === "Q_ESP_DEBUG_RESET")!,
          "connections",
          "source to EN_RESET"
        )
      },
      (candidate: typeof benchPrototypeResetWatchdog) => {
        Reflect.set(candidate.parts.find((part) => part.reference === "R_DEBUG_RESET_GATE")!, "mpn", "FORGED")
      },
      (candidate: typeof benchPrototypeResetWatchdog) => {
        Reflect.set(
          candidate.parts.find((part) => part.reference === "R_DEBUG_RESET_GATE_PD")!,
          "connections",
          "gate to V3_3"
        )
      }
    ]) {
      const candidate = structuredClone(benchPrototypeResetWatchdog)
      mutate(candidate)
      expect(() => validateBenchPrototypeResetWatchdog(candidate)).toThrow(RangeError)
    }

    expect(() => validateBenchPrototypeResetWatchdog({ ...benchPrototypeResetWatchdog, extra: true })).toThrow(
      RangeError
    )

    const alias = structuredClone(benchPrototypeResetWatchdog)
    Reflect.set(alias.parts, "1", alias.parts[0])
    expect(() => validateBenchPrototypeResetWatchdog(alias)).toThrow(RangeError)

    const accessor = structuredClone(benchPrototypeResetWatchdog)
    let read = false
    Object.defineProperty(accessor, "workUnit", {
      enumerable: true,
      get: () => {
        read = true
        return "BP-123"
      }
    })
    expect(() => validateBenchPrototypeResetWatchdog(accessor)).toThrow(RangeError)
    expect(read).toBe(false)

    const original = defaultApplicationRailInputs.outputMinV
    try {
      Reflect.set(defaultApplicationRailInputs, "outputMinV", 3.1)
      expect(() => validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)).toThrow(RangeError)
    } finally {
      Reflect.set(defaultApplicationRailInputs, "outputMinV", original)
    }

    const originalCt = defaultApplicationRailInputs.ctNominalUf
    try {
      Reflect.set(defaultApplicationRailInputs, "ctNominalUf", 0.09)
      expect(() => validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)).toThrow(RangeError)
    } finally {
      Reflect.set(defaultApplicationRailInputs, "ctNominalUf", originalCt)
    }
    expect(validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)).toBe(true)
  })

  it("deep-freezes the canonical contract", () => {
    expect(Object.isFrozen(benchPrototypeResetWatchdog)).toBe(true)
    expect(Object.isFrozen(benchPrototypeResetWatchdog.parts)).toBe(true)
    expect(Object.isFrozen(benchPrototypeResetWatchdog.parts[0])).toBe(true)
    expect(Object.isFrozen(benchPrototypeResetWatchdog.truthTable)).toBe(true)
  })
})
