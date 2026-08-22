import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import ScoringCircuit from "./index.circuit.js"
import {
  criticalPartReadiness,
  summarizeCriticalPartReadiness,
  validateCriticalPartReadiness,
  type CriticalPartReadiness
} from "./part-readiness.js"

function renderArchitecture() {
  const circuit = new Circuit()
  circuit.pcbRoutingDisabled = true
  circuit.schematicDisabled = true
  circuit.setPlatform({ partsEngineDisabled: true })
  circuit.add(<ScoringCircuit />)
  circuit.render()
  return circuit.getCircuitJson()
}

describe("critical-part readiness", () => {
  it("passes the readiness contract without claiming fabrication approval", () => {
    expect(validateCriticalPartReadiness(criticalPartReadiness)).toEqual([])
    expect(summarizeCriticalPartReadiness(criticalPartReadiness)).toEqual({
      candidateSelections: 1,
      manufacturerVerifiedCad: 1,
      productionApproved: 0,
      selectedParts: 5,
      total: 6,
      verifiedFootprints: 0,
      verifiedMechanical: 0
    })
  })

  it("covers every critical circuit reference and matches placed part numbers", () => {
    const circuitJson = renderArchitecture()
    const sourceComponents = circuitJson.filter((element) => element.type === "source_component")
    const sourceNames = new Set(sourceComponents.map((component) => component.name))

    for (const part of criticalPartReadiness) {
      for (const reference of part.references) expect(sourceNames).toContain(reference)
    }

    const esp32 = sourceComponents.find((component) => component.name === "U_ESP32")
    const ethernet = sourceComponents.find((component) => component.name === "U_ETHERNET")
    const ethernetPcbComponent = circuitJson.find(
      (element) => element.type === "pcb_component" && element.source_component_id === ethernet?.source_component_id
    )
    const ethernetPcbComponentId =
      ethernetPcbComponent !== undefined && "pcb_component_id" in ethernetPcbComponent
        ? ethernetPcbComponent.pcb_component_id
        : undefined
    const ethernetPads = circuitJson.filter(
      (element) => element.type === "pcb_smtpad" && element.pcb_component_id === ethernetPcbComponentId
    )
    expect(esp32?.manufacturer_part_number).toBe("ESP32-S3-WROOM-1U-N16R2")
    expect(ethernet?.manufacturer_part_number).toBe("W5500")
    expect(ethernetPads).toHaveLength(48)
  })

  it("rejects premature production approval", () => {
    const incompletePart: CriticalPartReadiness = {
      ...criticalPartReadiness[0],
      productionApproved: true
    }

    expect(validateCriticalPartReadiness([incompletePart])).toContain(
      "ESP32-S3-WROOM-1U-N16R2: production approval requires every readiness gate to pass"
    )
  })

  it("rejects malformed records and duplicate assignments", () => {
    const basePart: CriticalPartReadiness = criticalPartReadiness[0]
    const malformedParts: CriticalPartReadiness[] = [
      { ...basePart, mpn: "NO-REFERENCE", references: [] },
      { ...basePart, mpn: "DUPLICATE", references: ["U_DUPLICATE"] },
      { ...basePart, mpn: "DUPLICATE", references: ["U_DUPLICATE"] },
      { ...basePart, mpn: "TBD MODULE", references: ["U_TBD"] },
      {
        ...basePart,
        evidenceUrls: ["http://example.invalid/evidence"],
        mpn: "BAD-EVIDENCE",
        references: ["U_BAD_EVIDENCE"]
      }
    ]

    expect(validateCriticalPartReadiness(malformedParts)).toEqual(
      expect.arrayContaining([
        "NO-REFERENCE: at least one circuit reference is required",
        "U_DUPLICATE: circuit reference is assigned more than once",
        "DUPLICATE: selected MPN is duplicated",
        "TBD MODULE: selected parts cannot use a placeholder MPN",
        "BAD-EVIDENCE: evidence URL must use HTTPS"
      ])
    )
  })

  it("requires each production-approval gate and accepts a fully verified record", () => {
    const basePart: CriticalPartReadiness = {
      ...criticalPartReadiness[0],
      blockers: [],
      cad: { status: "manufacturer-verified" },
      evidenceUrls: ["https://example.invalid/evidence"],
      footprint: { description: "Independently checked land pattern", status: "verified" },
      mechanical: { description: "Independently checked envelope", status: "verified" },
      mpn: "VERIFIED-PART",
      productionApproved: true,
      references: ["U_VERIFIED"],
      selectionStatus: "selected"
    }
    const incompleteParts: CriticalPartReadiness[] = [
      { ...basePart, mpn: "CANDIDATE", references: ["U_CANDIDATE"], selectionStatus: "candidate" },
      {
        ...basePart,
        footprint: { description: "Not checked", status: "pending" },
        mpn: "BAD-FOOTPRINT",
        references: ["U_BAD_FOOTPRINT"]
      },
      { ...basePart, cad: { status: "pending" }, mpn: "BAD-CAD", references: ["U_BAD_CAD"] },
      {
        ...basePart,
        mechanical: { description: "Not checked", status: "pending" },
        mpn: "BAD-MECHANICAL",
        references: ["U_BAD_MECHANICAL"]
      },
      { ...basePart, blockers: ["Open gate"], mpn: "BLOCKED", references: ["U_BLOCKED"] }
    ]

    expect(validateCriticalPartReadiness([basePart])).toEqual([])
    expect(validateCriticalPartReadiness(incompleteParts)).toHaveLength(incompleteParts.length)
    expect(summarizeCriticalPartReadiness([basePart])).toEqual({
      candidateSelections: 0,
      manufacturerVerifiedCad: 1,
      productionApproved: 1,
      selectedParts: 1,
      total: 1,
      verifiedFootprints: 1,
      verifiedMechanical: 1
    })
  })

  it("keeps chassis connectors off the main-board footprint approval path", () => {
    const powerInput = criticalPartReadiness.find((part) =>
      part.references.some((reference) => reference === "J_POWER_24V")
    )
    const reelSockets = criticalPartReadiness.find((part) => part.references.some((reference) => reference === "J_L"))

    expect(powerInput?.assembly).toBe("external-panel-module")
    expect(powerInput?.footprint.status).toBe("not-applicable")
    expect(reelSockets?.assembly).toBe("external-panel-module")
    expect(reelSockets?.footprint.status).toBe("not-applicable")
  })
})
