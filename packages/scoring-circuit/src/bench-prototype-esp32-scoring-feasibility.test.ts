import { describe, expect, it } from "vitest"
import {
  benchPrototypeEsp32ScoringFeasibility,
  validateBenchPrototypeEsp32ScoringFeasibility
} from "./bench-prototype-esp32-scoring-feasibility.js"

describe("BP-127 ESP32 scoring feasibility", () => {
  it("passes the conservative pin and cadence paper screens without claiming bench closure", () => {
    expect(validateBenchPrototypeEsp32ScoringFeasibility(benchPrototypeEsp32ScoringFeasibility)).toBe(true)
    expect(benchPrototypeEsp32ScoringFeasibility.acquisition).toMatchObject({
      frameBits: 140,
      sclkHz: 20_000_000,
      wireTimeUs: 7,
      scanPeriodUs: 8,
      minimumCompletedScansDuringSabreSignal: 12
    })
    expect(benchPrototypeEsp32ScoringFeasibility.preliminaryPinResult).toMatchObject({
      result: "paper-pin-screen-passes",
      uncommittedGpios: [10, 11, 15, 17, 36, 37, 47]
    })
    expect(benchPrototypeEsp32ScoringFeasibility.authority).toMatchObject({
      paperPinScreenPassed: true,
      paperCadenceScreenPassed: true,
      oneCellBenchPassed: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
  })

  it("fails unavailable instead of dropping or guessing data", () => {
    expect(benchPrototypeEsp32ScoringFeasibility.queueAndFaultModel.prohibited).toEqual(
      expect.arrayContaining(["drop-oldest", "partial frame", "guessed sample", "reordered channel"])
    )
    expect(benchPrototypeEsp32ScoringFeasibility.queueAndFaultModel.unavailableFaults).toHaveLength(6)
    expect(benchPrototypeEsp32ScoringFeasibility.watchdog.prohibitedFeeders).toEqual([
      "Ethernet",
      "HUB75",
      "IR",
      "USB",
      "OTA"
    ])
  })

  it("requires the one-cell load and boundary experiment", () => {
    expect(benchPrototypeEsp32ScoringFeasibility.oneCellExperiment.resistanceOhms).toEqual(
      expect.arrayContaining([445, 450, 455, 470, 475, 480, 495, 500, 505])
    )
    expect(benchPrototypeEsp32ScoringFeasibility.oneCellExperiment.concurrentLoads).toHaveLength(7)
    expect(benchPrototypeEsp32ScoringFeasibility.oneCellExperiment.state).toBe("not-run")
  })

  it.each([
    [
      "scan period",
      (copy: typeof benchPrototypeEsp32ScoringFeasibility) => Reflect.set(copy.acquisition, "scanPeriodUs", 20)
    ],
    [
      "drop policy",
      (copy: typeof benchPrototypeEsp32ScoringFeasibility) => Reflect.set(copy.queueAndFaultModel, "prohibited", [])
    ],
    [
      "false bench pass",
      (copy: typeof benchPrototypeEsp32ScoringFeasibility) => Reflect.set(copy.authority, "oneCellBenchPassed", true)
    ],
    [
      "release",
      (copy: typeof benchPrototypeEsp32ScoringFeasibility) => Reflect.set(copy.authority, "fabricationAuthorized", true)
    ]
  ])("rejects changed %s", (_name, mutate) => {
    const copy = structuredClone(benchPrototypeEsp32ScoringFeasibility)
    mutate(copy)
    expect(() => validateBenchPrototypeEsp32ScoringFeasibility(copy)).toThrow(RangeError)
  })
})
