import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { p0IrReceiverFootprintMetadata } from "./p0-ir-receiver-footprints.js"
import { P0IrReceiver } from "./p0-ir-receiver.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

function renderCircuit() {
  return renderTestCircuit(createElement(P0IrReceiver, { pcbX: 0, pcbY: 0 }))
}

function sourceComponents() {
  return renderCircuit().filter((element) => element.type === "source_component")
}

describe("P0 IR receiver footprint reconciliation", () => {
  it("renders the exact receiver and support population without circuit errors", () => {
    const circuit = renderCircuit()
    const components = sourceComponents()
    expect(circuit.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(components.map((component) => component.name)).toEqual(
      expect.arrayContaining(["U_IR_RX", "R_IR_VS", "C_IR_VS", "R_IR_OUT", "R_IR_PULLUP", "TP_IR_RX"])
    )
    expect(components.find((component) => component.name === "U_IR_RX")).toMatchObject({
      manufacturer_part_number: "TSOP38438"
    })
    expect(components.find((component) => component.name === "R_IR_VS")).toMatchObject({
      manufacturer_part_number: "RC0603FR-07100RL"
    })
    expect(components.find((component) => component.name === "C_IR_VS")).toMatchObject({
      manufacturer_part_number: "C0603C104K3RACTU"
    })
    expect(components.find((component) => component.name === "R_IR_OUT")).toMatchObject({
      manufacturer_part_number: "RC0603FR-07100RL"
    })
    expect(components.find((component) => component.name === "R_IR_PULLUP")).toMatchObject({
      manufacturer_part_number: "RC0603FR-0710KL"
    })
  })

  it("keeps exact pin order, package geometry, and root-review authority explicit", () => {
    expect(p0IrReceiverFootprintMetadata.receiver).toMatchObject({
      manufacturerPartNumber: "TSOP38438",
      pinCount: 3,
      pitchMm: 2.54,
      orientation: expect.stringContaining("pin 1 OUT, pin 2 GND, pin 3 VS"),
      sourceState: "evidence-complete-pending-root-placement-approval",
      evidenceArtifact: "docs/evidence/p0-06/vishay-tsop382-tsop384-datasheet.pdf",
      evidenceSha256: "5F81C36AA02E9901E51C749D03AEE75A23A29B8195B30BF1CBA95F536C865074",
      releaseState: "deny"
    })
    expect(p0IrReceiverFootprintMetadata.supportPassives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: "R_IR_VS", package: "0603" }),
        expect.objectContaining({ reference: "C_IR_VS", package: "0603" }),
        expect.objectContaining({ reference: "R_IR_OUT", package: "0603" }),
        expect.objectContaining({ reference: "R_IR_PULLUP", package: "0603" })
      ])
    )
    expect(p0IrReceiverFootprintMetadata.supportPassives.every((passive) => passive.releaseState === "deny")).toBe(true)
  })
})
