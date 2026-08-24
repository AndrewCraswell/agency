import { describe, expect, it } from "vitest"
import {
  benchPrototypeIrReceiverSelection,
  validateBenchPrototypeIrReceiverSelection
} from "./bench-prototype-ir-receiver-selection.js"

describe("BP-146 encrypted-IR receiver selection", () => {
  it("selects the exact 38 kHz Vishay receiver and keeps release denied", () => {
    expect(validateBenchPrototypeIrReceiverSelection(benchPrototypeIrReceiverSelection)).toBe(true)
    expect(benchPrototypeIrReceiverSelection.receiver).toMatchObject({
      manufacturer: "Vishay Semiconductors",
      mpn: "TSOP38438",
      carrierFrequencyKHz: 38,
      agcVariant: "AGC4, recommended for long-burst codes",
      package: expect.stringContaining("Minicast")
    })
    expect(benchPrototypeIrReceiverSelection.receiver.pinout).toEqual([
      { pin: 1, name: "OUT", electrical: "active-low demodulated output" },
      { pin: 2, name: "GND", net: "APP_GND" },
      { pin: 3, name: "VS", net: "IR_3V3_FILTERED" }
    ])
    expect(benchPrototypeIrReceiverSelection.releaseState).toBe("deny")
  })

  it("freezes the exact support network, output protection, and probe point", () => {
    expect(benchPrototypeIrReceiverSelection.supportNetwork).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: "R_IR_VS", mpn: "RC0603FR-07100RL" }),
        expect.objectContaining({ reference: "C_IR_VS", mpn: "C0603C104K3RACTU" }),
        expect.objectContaining({ reference: "R_IR_OUT", mpn: "RC0603FR-07100RL" }),
        expect.objectContaining({ reference: "R_IR_PULLUP", mpn: "RC0603FR-0710KL" })
      ])
    )
    expect(benchPrototypeIrReceiverSelection.observation.testPoint).toMatchObject({
      reference: "TP_IR_RX",
      manufacturer: "Keystone Electronics",
      mpn: "5001",
      net: "IR_RX_GPIO35"
    })
    expect(benchPrototypeIrReceiverSelection.observation.forbiddenTestPointConnections).toHaveLength(5)
    expect(benchPrototypeIrReceiverSelection.supportNetworkBasis.manufacturerGuidance).toContain(
      "does not prescribe the selected 100 ohm/100 nF values"
    )
    expect(benchPrototypeIrReceiverSelection.supportNetworkBasis.designChoice).toContain("bench-prototype")
  })

  it("records measurable range, angle, latency, flood, and reset gates", () => {
    expect(benchPrototypeIrReceiverSelection.receiver.publishedTimingLimits).toMatchObject({
      outputDelayMinimumUs: 184,
      outputDelayMaximumUs: 342
    })
    expect(benchPrototypeIrReceiverSelection.benchGates.range.setup).toContain("actual representative handheld")
    expect(benchPrototypeIrReceiverSelection.benchGates.range.pass).toContain("1000/1000")
    expect(benchPrototypeIrReceiverSelection.benchGates.range.pass).toContain("20 m and 0 degrees")
    expect(benchPrototypeIrReceiverSelection.benchGates.range.pass).toContain("20 m and +/-15 degrees")
    expect(benchPrototypeIrReceiverSelection.evidence.range20mEvidence).toBe(false)
    expect(benchPrototypeIrReceiverSelection.benchGates.angle.pass).toContain("+/-45")
    expect(benchPrototypeIrReceiverSelection.benchGates.latency.systemGate).toContain("50 ms")
    expect(benchPrototypeIrReceiverSelection.benchGates.flood.pass).toContain("zero accepted commands")
    expect(benchPrototypeIrReceiverSelection.benchGates.resetPowerOff.pass).toContain("100 power cycles")
  })

  it("does not claim that a demodulator provides encrypted security", () => {
    expect(benchPrototypeIrReceiverSelection.securityBoundary).toContain("firmware")
    expect(benchPrototypeIrReceiverSelection.resetPowerOffAndFaultBehavior.stuckOrFlooded).toEqual(
      expect.arrayContaining([expect.stringContaining("authenticated command queue")])
    )
  })

  it("rejects substitutions and any fabrication-evidence relaxation", () => {
    for (const mutate of [
      (candidate: any) => (candidate.receiver.mpn = "TSOP38238"),
      (candidate: any) => (candidate.receiver.carrierFrequencyKHz = 40),
      (candidate: any) => (candidate.receiver.pinout[0].electrical = "active-high"),
      (candidate: any) => (candidate.evidence.range20mEvidence = true),
      (candidate: any) => (candidate.evidence.fabricationAuthorized = true),
      (candidate: any) => (candidate.benchGates.flood.pass = "accept all frames")
    ]) {
      const candidate = structuredClone(benchPrototypeIrReceiverSelection)
      mutate(candidate)
      expect(() => validateBenchPrototypeIrReceiverSelection(candidate)).toThrow(RangeError)
    }
    expect(Object.isFrozen(benchPrototypeIrReceiverSelection)).toBe(true)
    expect(Object.isFrozen(benchPrototypeIrReceiverSelection.receiver)).toBe(true)
    expect(Object.isFrozen(benchPrototypeIrReceiverSelection.supportNetwork)).toBe(true)
  })
})
