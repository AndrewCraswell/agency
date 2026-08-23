import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import { fabricationFootprintGates } from "./fabrication-footprint-gates.js"
import ScoringCircuit from "./index.circuit.js"
import { criticalPartReadiness } from "./part-readiness.js"

function renderPcbPlacements() {
  const circuit = new Circuit()
  circuit.pcbRoutingDisabled = true
  circuit.schematicDisabled = true
  circuit.setPlatform({ partsEngineDisabled: true })
  circuit.add(<ScoringCircuit />)
  circuit.render()
  return circuit.getCircuitJson()
}

describe("fabrication-critical footprint gates", () => {
  it("makes every generic or incomplete selected footprint non-placeable", () => {
    const circuitJson = renderPcbPlacements()
    const gatedArtifactTypes = new Set(["pcb_smtpad", "pcb_plated_hole", "pcb_hole", "pcb_solder_paste"])

    for (const gate of fabricationFootprintGates) {
      expect(gate.primaryEvidenceUrl).toMatch(/^https:\/\//)
      expect(gate.packageEvidence.terminals).toBeGreaterThan(0)
      expect(gate.releaseEvidence.length).toBeGreaterThan(1)

      for (const reference of gate.references) {
        const source = circuitJson.find((element) => element.type === "source_component" && element.name === reference)
        const sourceComponentId =
          source !== undefined && "source_component_id" in source ? source.source_component_id : undefined
        const pcbComponent = circuitJson.find(
          (element) =>
            element.type === "pcb_component" &&
            sourceComponentId !== undefined &&
            element.source_component_id === sourceComponentId
        )
        const fabricationArtifacts = circuitJson.filter(
          (element) =>
            gatedArtifactTypes.has(element.type) &&
            pcbComponent !== undefined &&
            "pcb_component_id" in pcbComponent &&
            "pcb_component_id" in element &&
            element.pcb_component_id === pcbComponent.pcb_component_id
        )

        expect(source).toBeDefined()
        expect(source).not.toHaveProperty("footprint")
        expect(pcbComponent).toMatchObject({ do_not_place: true })
        expect(fabricationArtifacts).toHaveLength(0)
        const sourceFootprint =
          source !== undefined && "footprint" in source && typeof source.footprint === "string"
            ? source.footprint
            : undefined
        for (const genericFootprint of gate.prohibitedGenericFootprints) {
          expect(sourceFootprint).not.toBe(genericFootprint)
        }
      }
    }

    const controlSource = circuitJson.find(
      (element) => element.type === "source_component" && element.name === "R_USB_DN"
    )
    const controlPcb = circuitJson.find(
      (element) =>
        element.type === "pcb_component" &&
        controlSource !== undefined &&
        "source_component_id" in controlSource &&
        element.source_component_id === controlSource.source_component_id
    )
    const controlPads = circuitJson.filter(
      (element) =>
        element.type === "pcb_smtpad" &&
        controlPcb !== undefined &&
        "pcb_component_id" in controlPcb &&
        element.pcb_component_id === controlPcb.pcb_component_id
    )
    expect(controlPcb).not.toMatchObject({ do_not_place: true })
    expect(controlPads.length).toBeGreaterThan(0)
  })

  it("maps every footprint gate to the exact selected circuit MPN", () => {
    const circuitJson = renderPcbPlacements()

    for (const gate of fabricationFootprintGates) {
      for (const reference of gate.references) {
        const source = circuitJson.find((element) => element.type === "source_component" && element.name === reference)
        expect(source).toBeDefined()

        if (reference === "J_USB_C") {
          const readiness = criticalPartReadiness.find((part) =>
            part.references.some((candidateReference) => candidateReference === reference)
          )
          expect(readiness?.mpn).toBe(gate.mpn)
        } else {
          expect(source).toMatchObject({ manufacturer_part_number: gate.mpn })
        }
      }
    }
  })

  it("keeps package-specific terminal, polarity, and thermal-pad requirements explicit", () => {
    const byMpn = new Map(fabricationFootprintGates.map((gate) => [gate.mpn, gate]))

    expect(byMpn.get("TPS25730ADREFR")?.packageEvidence).toMatchObject({
      terminals: 38,
      orientation: "pin-1",
      thermalPad: "required"
    })
    for (const mpn of ["TPS259474ARPWR", "TPS56A37RPAR"] as const) {
      expect(byMpn.get(mpn)?.packageEvidence).toMatchObject({
        terminals: 10,
        orientation: "pin-1",
        thermalPad: "required"
      })
    }
    expect(byMpn.get("10177070-00011LF")?.packageEvidence).toMatchObject({
      terminals: 16,
      orientation: "pin-1",
      thermalPad: "not-applicable"
    })
    expect(byMpn.get("LMR43620MSC3RPERQ1")?.packageEvidence).toMatchObject({
      terminals: 9,
      orientation: "pin-1",
      thermalPad: "required"
    })
    for (const mpn of ["T55A106M010C0200", "T523H107M035APE070"] as const) {
      expect(byMpn.get(mpn)?.packageEvidence.orientation).toBe("polarized")
    }
  })
})
