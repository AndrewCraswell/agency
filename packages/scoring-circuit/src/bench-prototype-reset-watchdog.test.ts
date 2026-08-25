import { describe, expect, it } from "vitest"
import {
  benchPrototypeResetWatchdog,
  evaluateBenchPrototypeResetWatchdogPhysicalEvidence,
  validateBenchPrototypeResetWatchdog
} from "./bench-prototype-reset-watchdog.js"

describe("BP-123 single-domain reset and watchdog contract", () => {
  it("uses one supervisor and watchdog for the ESP32-only P0", () => {
    expect(validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)).toBe(true)
    expect(benchPrototypeResetWatchdog.parts.filter((part) => part.mpn === "TPS389033DSER")).toHaveLength(1)
    expect(benchPrototypeResetWatchdog.parts.filter((part) => part.mpn === "TPS3431SDRBR")).toHaveLength(1)
    expect(benchPrototypeResetWatchdog.parts.map((part) => part.mpn)).not.toContain("SN74LVC2G07DCKR")
    expect(benchPrototypeResetWatchdog.resetTopology.application).toMatchObject({
      resetNet: "EN_RESET",
      commonResetNet: "APP_RESET_N",
      consumers: ["U_ESP32.EN", "U_W5500.RST_N", "PRIMARY_OUTPUT_DISABLE_N", "HUB75_SAFE_N"]
    })
  })

  it("allows GPIO12 kicks only after the aggregate health epoch and times out fail closed", () => {
    expect(benchPrototypeResetWatchdog.watchdogKick).toMatchObject({
      source: "ESP32-S3-WROOM-1U-N16R2 GPIO12 APP_WD_KICK",
      activeEdge: "falling",
      maximumFirmwareKickIntervalMs: 100
    })
    expect(benchPrototypeResetWatchdog.watchdogKick.healthRule).toContain("reference")
    expect(benchPrototypeResetWatchdog.watchdogKick.failureSemantics).toContain("stuck-low")
    expect(benchPrototypeResetWatchdog.timingEvidence.watchdog).toMatchObject({
      watchdogTimeoutMs: { minimum: 170, nominal: 200, maximum: 230 },
      resetPulseMs: { minimum: 170, nominal: 200, maximum: 230 }
    })
  })

  it("requires the five physical capture classes and no cross-domain capture", () => {
    expect(
      benchPrototypeResetWatchdog.physicalEvidenceIntake.requiredCaptures.map((capture) => capture.captureId)
    ).toEqual([
      "BP123-COLD-START",
      "BP123-BROWNOUT",
      "BP123-WATCHDOG",
      "BP123-MANUAL-COMMON-RESET",
      "BP123-POWER-OFF-BACKFEED"
    ])
    expect(benchPrototypeResetWatchdog.resetTopology.removedPaths).toEqual(
      expect.arrayContaining(["No STM32", "No cross-domain reset", "No processor isolation"])
    )
    expect(benchPrototypeResetWatchdog.physicalEvidenceIntake.authority.releaseState).toBe("deny")
  })

  it("evaluates a complete physical submission and rejects metric and provenance drift", () => {
    const digest = (index: number) => index.toString(16).padStart(64, "0")
    const makeSubmission = () => ({
      artifactKind: "bench-prototype-reset-watchdog-physical-evidence" as const,
      evidenceId: "bp123-fixture",
      captures: benchPrototypeResetWatchdog.physicalEvidenceIntake.requiredCaptures.map((requirement, index) => ({
        captureId: requirement.captureId,
        status: "measured" as const,
        recordedAtUtc: "2026-08-25T12:00:00.000Z",
        operator: "test operator",
        prototype: { assemblyId: "p0", boardRevision: "A", serialNumber: "001" },
        instrument: {
          manufacturer: "scope maker",
          model: "scope",
          serialNumber: `scope-${index}`,
          calibrationArtifact: { artifactId: `cal-${index}`, contentSha256: digest(index + 10) },
          calibrationDueDate: "2026-12-31T00:00:00.000Z"
        },
        captureArtifact: { artifactId: `capture-${index}`, contentSha256: digest(index + 20) },
        setupArtifact: { artifactId: `setup-${index}`, contentSha256: digest(index + 30) },
        procedure: { revision: "r1", artifactId: `procedure-${index}`, contentSha256: digest(index + 40) },
        injectedInputProfile: { artifactId: `input-${index}`, contentSha256: digest(index + 50) },
        observedSignals: [...requirement.requiredObservedSignals],
        measurements: requirement.requiredMetrics.map((metric) => ({
          id: metric.id,
          unit: metric.unit,
          value: (metric.minimum + metric.maximum) / 2
        }))
      }))
    })
    expect(evaluateBenchPrototypeResetWatchdogPhysicalEvidence(makeSubmission())).toMatchObject({ accepted: true })
    const invalid = makeSubmission()
    invalid.captures[2]!.measurements[0]!.value = Number.POSITIVE_INFINITY
    expect(evaluateBenchPrototypeResetWatchdogPhysicalEvidence(invalid).accepted).toBe(false)
    const duplicate = makeSubmission()
    duplicate.captures[1]!.captureArtifact.artifactId = duplicate.captures[0]!.captureArtifact.artifactId
    duplicate.captures[1]!.captureArtifact.contentSha256 = duplicate.captures[0]!.captureArtifact.contentSha256
    expect(evaluateBenchPrototypeResetWatchdogPhysicalEvidence(duplicate).accepted).toBe(false)
  })

  it("fails closed for mutation, aliases, accessors, and relaxed reset consumers", () => {
    const changedMpn = structuredClone(benchPrototypeResetWatchdog)
    Reflect.set(changedMpn.parts[0]!, "mpn", "FORGED")
    expect(() => validateBenchPrototypeResetWatchdog(changedMpn)).toThrow(RangeError)
    const changedConsumer = structuredClone(benchPrototypeResetWatchdog)
    Reflect.set(changedConsumer.resetTopology.application.consumers, "0", "U_STM32.NRST")
    expect(() => validateBenchPrototypeResetWatchdog(changedConsumer)).toThrow(RangeError)
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
  })

  it("deep-freezes the canonical contract", () => {
    expect(Object.isFrozen(benchPrototypeResetWatchdog)).toBe(true)
    expect(Object.isFrozen(benchPrototypeResetWatchdog.parts)).toBe(true)
    expect(Object.isFrozen(benchPrototypeResetWatchdog.parts[0])).toBe(true)
  })
})
