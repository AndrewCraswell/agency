import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import CommunicationsModuleCircuit from "./communications-module.circuit.js"
import { ethernetSupportNetwork } from "./ethernet-support-network.js"
import { fabricationFootprintGates } from "./fabrication-footprint-gates.js"
import ScoringCircuit from "./index.circuit.js"
import { criticalPartReadiness } from "./part-readiness.js"
import ScoringIoBoardCircuit from "./scoring-io-board.circuit.js"

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
  "C_EFUSE_OUT",
  "Y_W5500",
  "C_W5500_XI",
  "C_W5500_XO",
  "R_W5500_XTAL",
  "R_W5500_XO",
  "R_W5500_EXRES",
  "C_W5500_TOCAP",
  "C_W5500_1V2O",
  "C_ETH_AVDD_FERRITE_INPUT",
  "C_W5500_VDD",
  "C_W5500_AVDD_1",
  "C_W5500_AVDD_2",
  "C_W5500_AVDD_3",
  "C_W5500_AVDD_4",
  "C_W5500_AVDD_5",
  "C_W5500_AVDD_6",
  "FB_W5500_AVDD"
])
const scoringIoReferences = new Set([
  "J_WEAPON_HARNESS_L",
  "J_WEAPON_HARNESS_R",
  "J_PISTE_HARNESS",
  "J_PRIMARY_OUTPUTS_HARNESS"
])

function circuitForReference(
  carrierJson: ReturnType<typeof renderPcbPlacements>,
  communicationsJson: ReturnType<typeof renderPcbPlacements>,
  scoringIoJson: ReturnType<typeof renderPcbPlacements>,
  reference: string
) {
  if (communicationsReferences.has(reference)) return communicationsJson
  return scoringIoReferences.has(reference) ? scoringIoJson : carrierJson
}

describe("fabrication-critical footprint gates", () => {
  it("makes every generic or incomplete selected footprint non-placeable", () => {
    const carrierJson = renderPcbPlacements(<ScoringCircuit />)
    const communicationsJson = renderPcbPlacements(<CommunicationsModuleCircuit />)
    const scoringIoJson = renderPcbPlacements(<ScoringIoBoardCircuit />)
    const gatedArtifactTypes = new Set(["pcb_smtpad", "pcb_plated_hole", "pcb_hole", "pcb_solder_paste"])

    for (const gate of fabricationFootprintGates) {
      expect(gate.primaryEvidenceUrl).toMatch(/^https:\/\//)
      expect(gate.packageEvidence.terminals).toBeGreaterThan(0)
      expect(gate.releaseEvidence.length).toBeGreaterThan(1)

      for (const reference of gate.references) {
        const circuitJson = circuitForReference(carrierJson, communicationsJson, scoringIoJson, reference)
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
    const scoringIoJson = renderPcbPlacements(<ScoringIoBoardCircuit />)

    for (const gate of fabricationFootprintGates) {
      for (const reference of gate.references) {
        const circuitJson = circuitForReference(carrierJson, communicationsJson, scoringIoJson, reference)
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

  it("keeps every selected scoring harness header DNP until physical and harness evidence closes", () => {
    const scoringIoJson = renderPcbPlacements(<ScoringIoBoardCircuit />)
    const expected = [
      ["J_WEAPON_HARNESS_L", "43650-0300"],
      ["J_WEAPON_HARNESS_R", "43650-0400"],
      ["J_PISTE_HARNESS", "43650-0200"],
      ["J_PRIMARY_OUTPUTS_HARNESS", "39-29-1067"]
    ] as const
    for (const [reference, mpn] of expected) {
      const gate = fabricationFootprintGates.find((candidate) => candidate.mpn === mpn)
      const source = scoringIoJson.find((element) => element.type === "source_component" && element.name === reference)
      expect(gate?.references).toEqual([reference])
      expect(gate?.packageEvidence.thermalPad).toBe("not-applicable")
      expect(gate?.releaseEvidence.join(" ")).toMatch(/copper.*solder mask.*paste.*courtyard/u)
      expect(source).toMatchObject({ manufacturer_part_number: mpn })
      const sourceId = source?.type === "source_component" ? source.source_component_id : undefined
      const pcb = scoringIoJson.find(
        (element) => element.type === "pcb_component" && element.source_component_id === sourceId
      )
      const artifacts = scoringIoJson.filter(
        (element) =>
          ["pcb_smtpad", "pcb_plated_hole", "pcb_hole", "pcb_solder_paste"].includes(element.type) &&
          pcb?.type === "pcb_component" &&
          "pcb_component_id" in element &&
          element.pcb_component_id === pcb.pcb_component_id
      )
      expect(pcb).toMatchObject({ do_not_place: true })
      expect(artifacts).toEqual([])
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

  it("keeps every selected W5500 support reference DNP until its footprint and layout gates close", () => {
    const communicationsJson = renderPcbPlacements(<CommunicationsModuleCircuit />)
    const supportReferences = new Set<string>(ethernetSupportNetwork.references)
    const supportGates = fabricationFootprintGates.filter((gate) =>
      gate.references.some((reference) => supportReferences.has(reference))
    )
    expect(supportGates).toHaveLength(9)

    for (const gate of supportGates) {
      expect(gate.releaseEvidence.join(" ")).toMatch(/copper.*solder mask.*paste.*courtyard/u)
      for (const reference of gate.references) {
        const source = communicationsJson.find(
          (element) => element.type === "source_component" && element.name === reference
        )
        const sourceId = source?.type === "source_component" ? source.source_component_id : undefined
        const pcb = communicationsJson.find(
          (element) => element.type === "pcb_component" && element.source_component_id === sourceId
        )
        const artifacts = communicationsJson.filter(
          (element) =>
            ["pcb_smtpad", "pcb_plated_hole", "pcb_hole", "pcb_solder_paste"].includes(element.type) &&
            pcb?.type === "pcb_component" &&
            "pcb_component_id" in element &&
            element.pcb_component_id === pcb.pcb_component_id
        )
        expect(source).toMatchObject({ manufacturer_part_number: gate.mpn })
        expect(pcb).toMatchObject({ do_not_place: true })
        expect(artifacts).toEqual([])
      }
    }
  })
})
