import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import CommunicationsModuleCircuit from "./communications-module.circuit.js"
import { fabricationFootprintGates } from "./fabrication-footprint-gates.js"
import ScoringCircuit from "./index.circuit.js"
import { criticalPartReadiness } from "./part-readiness.js"

function renderPcbPlacements(circuitElement: React.ReactElement) {
  const circuit = new Circuit()
  circuit.pcbRoutingDisabled = true
  circuit.schematicDisabled = true
  circuit.setPlatform({ partsEngineDisabled: true })
  circuit.add(circuitElement)
  circuit.render()
  return circuit.getCircuitJson()
}

const communicationsReferences = new Set([
  "U_USB_PORT_PROTECT",
  "D_USB_PD_VBUS_TVS",
  "D_USB_PD_VBUS_DISCONNECT",
  "J_USB_C",
  "U_USB_PD",
  "U_EFUSE",
  "C_USB_PD_LDO",
  "C_USB_PD_PPHV",
  "C_EFUSE_OUT"
])

function circuitForReference(
  carrierJson: ReturnType<typeof renderPcbPlacements>,
  communicationsJson: ReturnType<typeof renderPcbPlacements>,
  reference: string
) {
  return communicationsReferences.has(reference) ? communicationsJson : carrierJson
}

describe("fabrication-critical footprint gates", () => {
  it("makes every generic or incomplete selected footprint non-placeable", () => {
    const carrierJson = renderPcbPlacements(<ScoringCircuit />)
    const communicationsJson = renderPcbPlacements(<CommunicationsModuleCircuit />)
    const gatedArtifactTypes = new Set(["pcb_smtpad", "pcb_plated_hole", "pcb_hole", "pcb_solder_paste"])

    for (const gate of fabricationFootprintGates) {
      expect(gate.primaryEvidenceUrl).toMatch(/^https:\/\//)
      expect(gate.packageEvidence.terminals).toBeGreaterThan(0)
      expect(gate.releaseEvidence.length).toBeGreaterThan(1)

      for (const reference of gate.references) {
        const circuitJson = circuitForReference(carrierJson, communicationsJson, reference)
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

    const controlSource = carrierJson.find(
      (element) => element.type === "source_component" && element.name === "R_USB_DN_CARRIER"
    )
    const controlPcb = carrierJson.find(
      (element) =>
        element.type === "pcb_component" &&
        controlSource !== undefined &&
        "source_component_id" in controlSource &&
        element.source_component_id === controlSource.source_component_id
    )
    const controlPads = carrierJson.filter(
      (element) =>
        element.type === "pcb_smtpad" &&
        controlPcb !== undefined &&
        "pcb_component_id" in controlPcb &&
        element.pcb_component_id === controlPcb.pcb_component_id
    )
    expect(controlPcb).not.toMatchObject({ do_not_place: true })
    expect(controlPads.length).toBeGreaterThan(0)
  }, 20_000)

  it("maps every footprint gate to the exact selected circuit MPN", () => {
    const carrierJson = renderPcbPlacements(<ScoringCircuit />)
    const communicationsJson = renderPcbPlacements(<CommunicationsModuleCircuit />)

    for (const gate of fabricationFootprintGates) {
      for (const reference of gate.references) {
        const circuitJson = circuitForReference(carrierJson, communicationsJson, reference)
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
