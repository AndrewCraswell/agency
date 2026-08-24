import { describe, expect, it } from "vitest"
import {
  benchPrototypeIrReceiverProjectFootprintGeometry,
  BenchPrototypeIrReceiverProjectFootprint
} from "./bench-prototype-ir-receiver-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

function renderProjectFootprint() {
  return renderTestCircuit(<BenchPrototypeIrReceiverProjectFootprint />)
}

describe("BP-146 TSOP38438 project footprint", () => {
  it("keeps the candidate geometry bounded and denied", () => {
    expect(benchPrototypeIrReceiverProjectFootprintGeometry).toMatchObject({
      workUnit: "BP-146",
      manufacturerPartNumber: "TSOP38438",
      pitchMm: 2.54,
      finishedDrillDiameterMm: 1.1,
      copperPadDiameterMm: 2.2,
      copperPadGeometry: {
        representation: "rounded-rectangle-equivalent-to-circle",
        primitive: "circular_hole_with_rect_pad",
        widthMm: 2.2,
        heightMm: 2.2,
        cornerRadiusMm: 1.1,
        status: "runtime-workaround-for-zero-paste"
      },
      solderMaskOpeningDiameterMm: 2.3,
      pasteOpeningDiameterMm: 0,
      pinOne: { pin: 1, name: "OUT", coordinatesMm: { x: 0, y: 0 } },
      lensDatum: { coordinatesMm: { x: 2.5, y: 0 }, opticalAxis: "negative-y" },
      bodyDatum: { widthMm: 5, heightMm: 6.95, depthMm: 4.8, frontFaceYMm: 0, extendsPositiveY: true },
      manufacturerCad: { state: "not-acquired", authority: "deny" },
      opticalAuthority: "deny",
      physicalAuthority: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(benchPrototypeIrReceiverProjectFootprintGeometry.pins).toEqual([
      { pin: 1, name: "OUT", xMm: 0, yMm: 0 },
      { pin: 2, name: "GND", xMm: 2.54, yMm: 0 },
      { pin: 3, name: "VS", xMm: 5.08, yMm: 0 }
    ])
  })

  it("renders exactly three plated holes at 2.54 mm pitch with no paste", () => {
    const json = renderProjectFootprint()
    const holes = json.filter((element) => element.type === "pcb_plated_hole")
    expect(holes).toHaveLength(3)
    expect(holes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shape: "circular_hole_with_rect_pad",
          x: 0,
          y: 0,
          hole_diameter: 1.1,
          rect_pad_width: 2.2,
          rect_pad_height: 2.2,
          rect_border_radius: 1.1,
          soldermask_margin: 0.05
        }),
        expect.objectContaining({
          shape: "circular_hole_with_rect_pad",
          x: 2.54,
          y: 0,
          hole_diameter: 1.1,
          rect_pad_width: 2.2,
          rect_pad_height: 2.2,
          rect_border_radius: 1.1,
          soldermask_margin: 0.05
        }),
        expect.objectContaining({
          shape: "circular_hole_with_rect_pad",
          x: 5.08,
          y: 0,
          hole_diameter: 1.1,
          rect_pad_width: 2.2,
          rect_pad_height: 2.2,
          rect_border_radius: 1.1,
          soldermask_margin: 0.05
        })
      ])
    )
    for (const hole of holes) {
      if (
        hole.type !== "pcb_plated_hole" ||
        !("rect_pad_width" in hole) ||
        typeof hole.soldermask_margin !== "number"
      ) {
        continue
      }
      expect(hole.rect_pad_width + 2 * hole.soldermask_margin).toBeCloseTo(2.3, 10)
    }
    expect(json.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(0)
  })

  it("maps pin one/output and the remaining receiver pins through the rendered soup", () => {
    const json = renderProjectFootprint()
    const holes = json.filter((element) => element.type === "pcb_plated_hole")
    const ports = new Map(
      json.filter((element) => element.type === "pcb_port").map((element) => [element.pcb_port_id, element])
    )
    expect(holes).toHaveLength(3)
    for (const hole of holes) {
      if (hole.type !== "pcb_plated_hole") continue
      const pcbPortId = hole.pcb_port_id
      expect(pcbPortId).toBeDefined()
      if (!pcbPortId) continue
      expect(ports.get(pcbPortId)).toMatchObject({
        pcb_port_id: pcbPortId
      })
    }
    expect(json.filter((element) => element.type === "source_port")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin_number: 1, name: "OUT", port_hints: expect.arrayContaining(["pin1"]) }),
        expect.objectContaining({ pin_number: 2, name: "GND", port_hints: expect.arrayContaining(["pin2"]) }),
        expect.objectContaining({ pin_number: 3, name: "VS", port_hints: expect.arrayContaining(["pin3"]) })
      ])
    )
  })

  it("renders review-only body and lens datum graphics without asserting manufacturer CAD", () => {
    const json = renderProjectFootprint()
    expect(json.filter((element) => element.type === "pcb_silkscreen_rect")).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 2.5, y: 3.475 }, width: 5, height: 6.95 })])
    )
    expect(json.filter((element) => element.type === "pcb_silkscreen_line")).toEqual(
      expect.arrayContaining([expect.objectContaining({ x1: 0, y1: 0, x2: 5, y2: 0 })])
    )
    expect(benchPrototypeIrReceiverProjectFootprintGeometry.manufacturerCad.authority).toBe("deny")
    expect(benchPrototypeIrReceiverProjectFootprintGeometry.accepted).toBe(false)
  })
})
