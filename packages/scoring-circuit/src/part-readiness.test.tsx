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
    const physicalGatePart: CriticalPartReadiness = {
      ...basePart,
      assembly: "external-panel-module",
      mpn: "OPEN-PHYSICAL-GATE",
      physical: {
        contactRating: "5 milliohms",
        cycleRating: "1000 cycles",
        interface: "locking-power",
        mounting: "panel-chassis",
        openGates: ["CAD overlay"],
        retention: "Latch",
        shield: "Metal shell"
      },
      references: ["J_OPEN_PHYSICAL_GATE"]
    }
    expect(validateCriticalPartReadiness([physicalGatePart])).toContain(
      "OPEN-PHYSICAL-GATE: production approval requires every readiness gate to pass"
    )
    const reviewedExternalPart: CriticalPartReadiness = {
      ...basePart,
      assembly: "external-panel-module",
      physical: {
        contactRating: "5 milliohms",
        cycleRating: "1000 cycles",
        interface: "locking-power",
        mounting: "panel-chassis",
        openGates: [],
        retention: "Latch",
        shield: "Metal shell"
      },
      references: ["J_REVIEWED"]
    }
    expect(validateCriticalPartReadiness([reviewedExternalPart])).toEqual([])
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

  it("requires physical evidence for external modules and rejects blank or duplicate claims", () => {
    const readiness: readonly CriticalPartReadiness[] = criticalPartReadiness
    const powerInput = readiness.find((part) => part.references.some((reference) => reference === "J_POWER_24V"))
    if (powerInput === undefined || powerInput.physical === undefined) {
      throw new Error("The selected power input must carry physical evidence")
    }

    const missingPhysical = { ...powerInput, physical: undefined }
    expect(validateCriticalPartReadiness([missingPhysical])).toContain(
      "NC4MD-LX: external-panel-module requires physical evidence"
    )

    const missingReelSamples: CriticalPartReadiness = {
      ...powerInput,
      mpn: "REEL-MISSING-SAMPLES",
      physical: {
        ...powerInput.physical,
        exactSampleMpns: [],
        interface: "reel-socket"
      }
    }
    expect(validateCriticalPartReadiness([missingReelSamples])).toEqual(
      expect.arrayContaining([
        "REEL-MISSING-SAMPLES: reel-socket physical evidence requires exact sample MPNs",
        "REEL-MISSING-SAMPLES: exactSampleMpns must not be empty when present"
      ])
    )

    const malformedPhysical: CriticalPartReadiness = {
      ...powerInput,
      mpn: "MALFORMED-PHYSICAL",
      physical: {
        ...powerInput.physical,
        contactRating: " ",
        cycleRating: "",
        exactSampleMpns: ["66.9684-22", "", "66.9684-22"],
        openGates: [""],
        retention: "\t",
        shield: ""
      }
    }
    expect(validateCriticalPartReadiness([malformedPhysical])).toEqual(
      expect.arrayContaining([
        "MALFORMED-PHYSICAL: physical contactRating must be nonblank",
        "MALFORMED-PHYSICAL: physical cycleRating must be nonblank",
        "MALFORMED-PHYSICAL: physical open gate must be nonblank",
        "MALFORMED-PHYSICAL: exact sample MPN must be nonblank",
        "MALFORMED-PHYSICAL: exact sample MPN is duplicated",
        "MALFORMED-PHYSICAL: physical retention must be nonblank",
        "MALFORMED-PHYSICAL: physical shield must be nonblank"
      ])
    )
  })

  it("keeps chassis connectors off the main-board footprint approval path", () => {
    const powerInput = criticalPartReadiness.find((part) =>
      part.references.some((reference) => reference === "J_POWER_24V")
    )
    const reelSockets = criticalPartReadiness.find((part) => part.references.some((reference) => reference === "J_L"))

    expect(powerInput?.assembly).toBe("external-panel-module")
    expect(powerInput?.footprint.status).toBe("not-applicable")
    expect(powerInput?.cad.status).toBe("pending")
    if (powerInput !== undefined && "url" in powerInput.cad) {
      expect(powerInput.cad.url).toContain("NC4MD-LX.stp")
    } else {
      throw new Error("The selected power inlet must retain its manufacturer CAD source")
    }
    expect(reelSockets?.assembly).toBe("external-panel-module")
    expect(reelSockets?.footprint.status).toBe("not-applicable")
  })

  it("records exact reel sample suffixes and keeps every physical interface gated", () => {
    const readiness: readonly CriticalPartReadiness[] = criticalPartReadiness
    const reelSockets = readiness.find((part) => part.references.some((reference) => reference === "J_L"))
    const ethernet = readiness.find((part) => part.references.some((reference) => reference === "J_ETHERNET_MAGJACK"))
    const usb = readiness.find((part) => part.references.some((reference) => reference === "J_USB_C"))
    const power = readiness.find((part) => part.references.some((reference) => reference === "J_POWER_24V"))

    expect(reelSockets?.physical?.exactSampleMpns).toEqual(["66.9684-22", "66.9684-25"])
    expect(reelSockets?.physical?.mounting).toBe("panel-chassis")
    expect(reelSockets?.physical?.cycleRating).toContain("Not published")
    expect(ethernet?.physical?.shield).toContain("shell-tab")
    expect(ethernet?.physical?.cycleRating).toBe("750 mating cycles")
    expect(usb?.physical?.contactRating).toContain("40 milliohms")
    expect(usb?.physical?.cycleRating).toBe("20,000 mating cycles")
    expect(power?.physical?.retention).toContain("Latch lock")
    expect(power?.physical?.contactRating).toContain("5 milliohms")

    for (const part of [reelSockets, ethernet, usb, power]) {
      expect(part?.physical?.openGates.length).toBeGreaterThan(0)
      expect(part?.productionApproved).toBe(false)
    }
  })

  it("keeps generic connector models from passing selected-part verification", () => {
    const circuitJson = renderArchitecture()
    const sourceComponents = circuitJson.filter((element) => element.type === "source_component")
    const ethernet = sourceComponents.find((component) => component.name === "J_ETHERNET_MAGJACK")
    const usb = sourceComponents.find((component) => component.name === "J_USB_C")
    const power = sourceComponents.find((component) => component.name === "J_POWER_24V")

    expect(ethernet?.ftype).toBe("simple_pin_header")
    expect(ethernet !== undefined && "pin_count" in ethernet ? ethernet.pin_count : undefined).toBe(8)
    expect(usb?.ftype).toBe("simple_connector")
    expect(usb !== undefined && "standard" in usb ? usb.standard : undefined).toBe("usb_c")
    expect(power?.ftype).toBe("simple_pin_header")
    expect(power !== undefined && "pin_count" in power ? power.pin_count : undefined).toBe(3)

    for (const reference of ["J_ETHERNET_MAGJACK", "J_USB_C", "J_POWER_24V"]) {
      const part = criticalPartReadiness.find((candidate) =>
        candidate.references.some((candidateReference) => candidateReference === reference)
      )

      expect(part?.productionApproved).toBe(false)
      expect(part?.footprint.status).not.toBe("verified")
      expect(part?.mechanical.status).not.toBe("verified")
    }
  })
})
