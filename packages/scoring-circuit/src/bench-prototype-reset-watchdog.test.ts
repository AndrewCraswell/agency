import { describe, expect, it } from "vitest"
import { defaultApplicationRailInputs } from "./application-rail.js"
import { benchPrototypeResetWatchdog, validateBenchPrototypeResetWatchdog } from "./bench-prototype-reset-watchdog.js"

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
