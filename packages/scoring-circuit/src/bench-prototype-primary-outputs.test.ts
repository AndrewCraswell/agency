import { describe, expect, it } from "vitest"
import {
  benchPrototypePrimaryOutputs,
  validateBenchPrototypePrimaryOutputs
} from "./bench-prototype-primary-outputs.js"

describe("P0 primary-output boundary", () => {
  it("uses five direct GPIOs and eliminates the serialized latch", () => {
    expect(validateBenchPrototypePrimaryOutputs(benchPrototypePrimaryOutputs)).toBe(true)
    expect(benchPrototypePrimaryOutputs.controllerInterface).toMatchObject({
      kind: "five direct ESP32 GPIOs into logic-level driver inputs",
      gpio: [7, 15, 17, 10, 11],
      eliminatedComponent: "U_PRIMARY_OUTPUT_LATCH"
    })
    expect(benchPrototypePrimaryOutputs.controllerInterface.prohibited).toContain("stateful serial latch")
  })

  it("assigns five outputs and a separate common return to the evidence-backed connector candidate", () => {
    expect(benchPrototypePrimaryOutputs.channels).toEqual([
      { gpio: 7, channel: "LAMP_RED", connectorCircuit: 1 },
      { gpio: 15, channel: "LAMP_GREEN", connectorCircuit: 2 },
      { gpio: 17, channel: "LAMP_WHITE_LEFT", connectorCircuit: 3 },
      { gpio: 10, channel: "LAMP_WHITE_RIGHT", connectorCircuit: 4 },
      { gpio: 11, channel: "BUZZER", connectorCircuit: 5 }
    ])
    expect(benchPrototypePrimaryOutputs.connector).toMatchObject({
      mpn: "39-29-1067",
      status: "TBD-load-envelope",
      matingHousing: "39-01-2060",
      matingTerminal: "39-00-0039",
      dedicatedReturnCircuit: 6
    })
  })

  it("requires hardware safing independently of firmware and keeps the driver unselected", () => {
    expect(benchPrototypePrimaryOutputs.hardwareSafeState.inactiveDuring).toEqual(
      expect.arrayContaining(["power-up before firmware", "APP_RESET_N asserted", "watchdog fault", "brownout"])
    )
    expect(benchPrototypePrimaryOutputs.controllerInterface.prohibited).toContain("firmware-only output safing")
    expect(benchPrototypePrimaryOutputs.loadDriver).toMatchObject({ status: "TBD-load-envelope" })
  })

  it("fails closed for clones and changed hardware requirements", () => {
    expect(() => validateBenchPrototypePrimaryOutputs(structuredClone(benchPrototypePrimaryOutputs))).toThrow(
      RangeError
    )
    expect(() => Object.defineProperty(benchPrototypePrimaryOutputs.connector, "mpn", { value: "forged" })).toThrow(
      TypeError
    )
  })
})
