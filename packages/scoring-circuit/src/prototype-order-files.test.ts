import type { CircuitJson } from "circuit-json"
import { describe, expect, it } from "vitest"
import {
  createPrototypeBomCsv,
  createPrototypeOrderFiles,
  createPrototypePlacementCsv
} from "./prototype-order-files.js"

function source(sourceComponentId: string, name: string, manufacturerPartNumber?: string, displayValue?: string) {
  return {
    type: "source_component",
    source_component_id: sourceComponentId,
    name,
    ...(manufacturerPartNumber === undefined ? {} : { manufacturer_part_number: manufacturerPartNumber }),
    ...(displayValue === undefined ? {} : { display_value: displayValue })
  }
}

function pcb(
  sourceComponentId: string,
  x: number,
  y: number,
  layer: "top" | "bottom",
  rotation: number,
  doNotPlace = false
) {
  return {
    type: "pcb_component",
    pcb_component_id: `pcb-${sourceComponentId}`,
    source_component_id: sourceComponentId,
    center: { x, y },
    layer,
    rotation,
    do_not_place: doNotPlace,
    obstructs_within_bounds: false
  }
}

describe("prototype order files", () => {
  it("groups populated parts by exact MPN and display value", () => {
    const circuitJson = [
      source("source-1", "R2", "RES-1K", "1k"),
      source("source-2", "R1", "RES-1K", "1k"),
      source("source-3", "R3", "RES-1K", "1 k"),
      source("source-4", "C1", "CAP-10UF", "10uF"),
      source("source-5", "TP1"),
      source("source-6", "R_DNP", "RES-1K", "1k"),
      pcb("source-1", 2, 3, "top", 0),
      pcb("source-2", 1, 3, "top", 90),
      pcb("source-3", 4, 3, "bottom", 180),
      pcb("source-4", 5, 6, "top", 270),
      pcb("source-6", 6, 6, "top", 0, true)
    ] as CircuitJson

    const files = createPrototypeOrderFiles(circuitJson)

    expect(files.bom).toEqual([
      { manufacturerPartNumber: "CAP-10UF", displayValue: "10uF", quantity: 1, references: ["C1"] },
      { manufacturerPartNumber: "RES-1K", displayValue: "1 k", quantity: 1, references: ["R3"] },
      { manufacturerPartNumber: "RES-1K", displayValue: "1k", quantity: 2, references: ["R1", "R2"] }
    ])
    expect(files.bomCsv).toBe(
      [
        '"manufacturer_part_number","display_value","quantity","references"',
        '"CAP-10UF","10uF","1","C1"',
        '"RES-1K","1 k","1","R3"',
        '"RES-1K","1k","2","R1;R2"'
      ].join("\n")
    )
  })

  it("emits populated placements in reference order and omits DNP and no-MPN sources", () => {
    const circuitJson = [
      source("source-1", "U2", "PART-2", "logic"),
      source("source-2", "U1", "PART-1", "controller"),
      source("source-3", "TP1"),
      source("source-4", "J_DNP", "PART-DNP"),
      pcb("source-1", 20.25, -3.5, "bottom", 180),
      pcb("source-2", 2, 4, "top", 0),
      pcb("source-3", 5, 6, "top", 0),
      pcb("source-4", 7, 8, "top", 90, true)
    ] as CircuitJson

    expect(createPrototypePlacementCsv(circuitJson)).toBe(
      [
        '"reference","center_x_mm","center_y_mm","layer","rotation_deg"',
        '"U1","2","4","top","0"',
        '"U2","20.25","-3.5","bottom","180"'
      ].join("\n")
    )
  })

  it("quotes CSV cells", () => {
    const circuitJson = [
      source("source-1", "R1", "RES-1K", '1,000 "precision"'),
      pcb("source-1", 1, 2, "top", 0)
    ] as CircuitJson

    expect(createPrototypeBomCsv(circuitJson)).toContain('"RES-1K","1,000 ""precision""","1","R1"')
  })
})
