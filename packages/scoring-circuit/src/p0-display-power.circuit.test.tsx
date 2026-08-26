import { createElement } from "react"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeDisplayPowerBranch,
  validateBenchPrototypeDisplayPowerBranch
} from "./bench-prototype-display-power-branch.js"
import { p0DisplayPowerFootprintMetadata } from "./p0-display-power-footprints.js"
import {
  P0DisplayPowerCircuit,
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

function pcbFootprintElements(name: string) {
  const circuit = renderCircuit()
  const source = circuit.find((element) => element.type === "source_component" && element.name === name)
  if (source?.type !== "source_component") return []
  const pcbComponent = circuit.find(
    (element) => element.type === "pcb_component" && element.source_component_id === source.source_component_id
  )
  if (pcbComponent?.type !== "pcb_component") return []
  return circuit.filter(
    (element) =>
      (element.type === "pcb_smtpad" || element.type === "pcb_plated_hole") &&
      element.pcb_component_id === pcbComponent.pcb_component_id
  )
}

describe("P0 protected HUB75 display-power circuit", () => {
  it("renders the exact selected branch components without tscircuit errors", () => {
    const circuitJson = renderCircuit()
    expect(circuitJson.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(componentNames(circuitJson)).toEqual(
      expect.arrayContaining([
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
        "J_DISPLAY_POWER_PIGTAIL"
      ])
    )
    expect(manufacturerPartNumbers(circuitJson)).toEqual(
      expect.arrayContaining(["TPS259474ARPWR", "RC0402FR-07698RL", "045106.3MRL"])
    )
    expect(manufacturerPartNumbers(circuitJson)).not.toEqual(
      expect.arrayContaining(["43650-0200", "39-28-1023", "4767"])
    )
  })

  it("renders the limiter, fuse, measurement boundary, and dual-branch output path", () => {
    const traces = traceNames(renderCircuit())
    expect(traces).toEqual(
      expect.arrayContaining([
        "U_DISPLAY_LIMITER.IN to net.V5",
        "U_DISPLAY_LIMITER.OUT to net.V5_DISPLAY_LIMITED",
        "U_DISPLAY_LIMITER.OUT to F_DISPLAY.FUSED_IN",
        "F_DISPLAY.FUSED_OUT to net.V5_DISPLAY_LOAD",
        "F_DISPLAY.FUSED_OUT to J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_1_A",
        "F_DISPLAY.FUSED_OUT to J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_1_B",
        "F_DISPLAY.FUSED_OUT to J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_2_A",
        "F_DISPLAY.FUSED_OUT to J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_2_B",
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
      output: "display panel wires disconnected from the eight board landings",
      signal: "HUB75 buffers disabled, outputs high impedance, and panel OE inactive/high"
    })
    expect(benchPrototypeDisplayPowerBranch.authority.releaseState).toBe("deny")
    expect(benchPrototypeDisplayPowerBranch.evidence.fabricationAuthorized).toBe(false)
  })

  it("reconciles retained footprints and preserves the pigtail wire boundary", () => {
    expect(pcbFootprintElements("U_DISPLAY_LIMITER").filter((element) => element.type === "pcb_smtpad")).toHaveLength(
      10
    )
    expect(pcbFootprintElements("F_DISPLAY").filter((element) => element.type === "pcb_smtpad")).toHaveLength(2)
    expect(
      pcbFootprintElements("J_DISPLAY_POWER_PIGTAIL").filter((element) => element.type === "pcb_plated_hole")
    ).toHaveLength(8)
    expect(p0DisplayPowerFootprintMetadata.limiter).toMatchObject({
      manufacturerPartNumber: "TPS259474ARPWR",
      pinCount: 10,
      sourceState: "evidence-complete-pending-root-placement-approval",
      evidenceArtifact: "docs/evidence/p0-06/ti-tps259474a-datasheet.pdf",
      evidenceSha256: "051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC",
      releaseState: "deny"
    })
    expect(p0DisplayPowerFootprintMetadata.fuse).toMatchObject({
      sourceState: "evidence-complete-pending-root-placement-approval",
      evidenceArtifact: "docs/evidence/p0-06/littelfuse-451-453-datasheet.pdf",
      evidenceSha256: "399D3CC9DA991AA3192638F807FB568F137407D10A4B0D35D106A82B5C2BACE2"
    })
    expect(p0DisplayPowerFootprintMetadata.pigtail).toMatchObject({ inBom: false, onBoard: true })
    expect(p0DisplayPowerFootprintMetadata.pigtail).not.toHaveProperty("manufacturerPartNumber")
  })
})
