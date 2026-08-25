import { createElement } from "react"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeDisplayPowerBranch,
  validateBenchPrototypeDisplayPowerBranch
} from "./bench-prototype-display-power-branch.js"
import P0DisplayPowerCircuit, {
  p0DisplayPowerCircuitContract,
  validateP0DisplayPowerCircuitContract
} from "./p0-display-power.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

function renderCircuit() {
  return renderTestCircuit(createElement(P0DisplayPowerCircuit))
}

function componentNames(circuitJson: ReturnType<typeof renderCircuit>): string[] {
  return circuitJson.flatMap((element) =>
    element.type === "source_component" && typeof element.name === "string" ? [element.name] : []
  )
}

function manufacturerPartNumbers(circuitJson: ReturnType<typeof renderCircuit>): string[] {
  return circuitJson.flatMap((element) =>
    element.type === "source_component" && typeof element.manufacturer_part_number === "string"
      ? [element.manufacturer_part_number]
      : []
  )
}

function traceNames(circuitJson: ReturnType<typeof renderCircuit>): string[] {
  return circuitJson.flatMap((element) =>
    element.type === "source_trace" && typeof element.display_name === "string" ? [element.display_name] : []
  )
}

describe("P0 protected HUB75 display-power circuit", () => {
  it("renders the exact selected branch components without tscircuit errors", () => {
    const circuitJson = renderCircuit()
    expect(circuitJson.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(componentNames(circuitJson)).toEqual(
      expect.arrayContaining([
        "J_DISPLAY_DISCONNECT",
        "U_DISPLAY_LIMITER",
        "R_DISPLAY_ILM",
        "C_DISPLAY_BYPASS",
        "C_DISPLAY_IN",
        "C_DISPLAY_OUT",
        "C_DISPLAY_DVDT",
        "C_DISPLAY_ITIMER",
        "R_DISPLAY_PG_PULLUP",
        "R_DISPLAY_PG_LOWER",
        "R_DISPLAY_PG_UPPER",
        "F_DISPLAY",
        "J_LINK_DISPLAY",
        "J_DISPLAY_POWER_PIGTAIL"
      ])
    )
    expect(manufacturerPartNumbers(circuitJson)).toEqual(
      expect.arrayContaining(["43650-0200", "TPS259474ARPWR", "RC0402FR-07698RL", "045106.3MRL", "39-28-1023", "4767"])
    )
  })

  it("renders the limiter, fuse, measurement boundary, and dual-branch output path", () => {
    const traces = traceNames(renderCircuit())
    expect(traces).toEqual(
      expect.arrayContaining([
        "J_DISPLAY_DISCONNECT.V5_SOURCE to net.V5",
        "J_DISPLAY_DISCONNECT.V5_DISPLAY_IN to U_DISPLAY_LIMITER.IN",
        "U_DISPLAY_LIMITER.IN to net.V5_DISPLAY_IN",
        "U_DISPLAY_LIMITER.OUT to net.V5_DISPLAY_LIMITED",
        "U_DISPLAY_LIMITER.OUT to F_DISPLAY.FUSED_IN",
        "F_DISPLAY.FUSED_OUT to J_LINK_DISPLAY.V5_DISPLAY_LIMITED",
        "J_LINK_DISPLAY.V5_DISPLAY_LOAD to net.V5_DISPLAY_LOAD",
        "J_LINK_DISPLAY.V5_DISPLAY_LOAD to J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_1_A",
        "J_LINK_DISPLAY.V5_DISPLAY_LOAD to J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_1_B",
        "J_LINK_DISPLAY.V5_DISPLAY_LOAD to J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_2_A",
        "J_LINK_DISPLAY.V5_DISPLAY_LOAD to J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_2_B",
        "J_DISPLAY_POWER_PIGTAIL.APP_GND_BRANCH_1_A to net.APP_GND",
        "J_DISPLAY_POWER_PIGTAIL.APP_GND_BRANCH_1_B to net.APP_GND",
        "J_DISPLAY_POWER_PIGTAIL.APP_GND_BRANCH_2_A to net.APP_GND",
        "J_DISPLAY_POWER_PIGTAIL.APP_GND_BRANCH_2_B to net.APP_GND"
      ])
    )
    expect(traces).not.toContain("net.V5 to J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_1_A")
    expect(traces).not.toContain("net.V5 to J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_2_A")
  })

  it("retains the upstream identities and default safe-off deny state", () => {
    expect(validateBenchPrototypeDisplayPowerBranch(benchPrototypeDisplayPowerBranch)).toBe(true)
    expect(validateP0DisplayPowerCircuitContract()).toBe(true)
    expect(p0DisplayPowerCircuitContract.safeOff).toEqual({
      state: "safe-off",
      releaseState: "deny",
      fabricationAuthorized: false,
      disconnect: "J_DISPLAY_DISCONNECT open",
      measurementLink: "J_LINK_DISPLAY removed or open; never a power-injection point",
      output: "J_DISPLAY_POWER_PIGTAIL disconnected from the panel",
      signal: "HUB75 buffers disabled, outputs high impedance, and panel OE inactive/high"
    })
    expect(benchPrototypeDisplayPowerBranch.authority.releaseState).toBe("deny")
    expect(benchPrototypeDisplayPowerBranch.evidence.fabricationAuthorized).toBe(false)
  })
})
