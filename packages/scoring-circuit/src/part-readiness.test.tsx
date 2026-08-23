import { Circuit } from "tscircuit"
import { beforeAll, describe, expect, it } from "vitest"
import CommunicationsModuleCircuit from "./communications-module.circuit.js"
import ScoringCircuit from "./index.circuit.js"
import { interboardArchitectureVerdict } from "./interboard-interface.js"
import {
  criticalPartReadiness,
  summarizeCriticalPartReadiness,
  validateCriticalPartReadiness,
  type CriticalPartReadiness
} from "./part-readiness.js"

let architectureJson: ReturnType<InstanceType<typeof Circuit>["getCircuitJson"]> | undefined
let communicationsModuleJson: ReturnType<InstanceType<typeof Circuit>["getCircuitJson"]> | undefined

function renderArchitecture() {
  if (architectureJson !== undefined) return architectureJson
  const circuit = new Circuit()
  circuit.pcbRoutingDisabled = true
  circuit.schematicDisabled = true
  circuit.setPlatform({ partsEngineDisabled: true })
  circuit.add(<ScoringCircuit />)
  circuit.render()
  architectureJson = circuit.getCircuitJson()
  return architectureJson
}

function renderCommunicationsModule() {
  if (communicationsModuleJson !== undefined) return communicationsModuleJson
  const circuit = new Circuit()
  circuit.pcbRoutingDisabled = true
  circuit.schematicDisabled = true
  circuit.setPlatform({ partsEngineDisabled: true })
  circuit.add(<CommunicationsModuleCircuit />)
  circuit.render()
  communicationsModuleJson = circuit.getCircuitJson()
  return communicationsModuleJson
}

beforeAll(() => {
  // The two rendered circuit fixtures are intentionally cached before the
  // assertions run. Rendering them together can exceed Vitest's per-test
  // default even though neither render is an asynchronous test operation.
  renderArchitecture()
  renderCommunicationsModule()
}, 20_000)

describe("critical-part readiness", () => {
  it("passes the readiness contract without claiming fabrication approval", () => {
    expect(validateCriticalPartReadiness(criticalPartReadiness)).toEqual([])
    expect(summarizeCriticalPartReadiness(criticalPartReadiness)).toEqual({
      candidateSelections: 1,
      manufacturerVerifiedCad: 1,
      productionApproved: 0,
      selectedParts: 10,
      total: 11,
      verifiedFootprints: 0,
      verifiedMechanical: 0
    })
  })

  it("covers critical references in their declared assembly without masking duplicate board ownership", () => {
    const circuitJson = renderArchitecture()
    const communicationsCircuitJson = renderCommunicationsModule()
    const carrierComponents = circuitJson.filter((element) => element.type === "source_component")
    const communicationsComponents = communicationsCircuitJson.filter((element) => element.type === "source_component")
    const sourceComponents = [...carrierComponents, ...communicationsComponents]
    const sourcesByAssembly = {
      "application-carrier": carrierComponents,
      "communications-module": communicationsComponents,
      // The external-panel module has no independent circuit artifact yet.
      // Its electrical entry points remain represented on the carrier model.
      "external-panel-module": carrierComponents
    } as const

    for (const part of criticalPartReadiness) {
      const assemblySources = new Set(sourcesByAssembly[part.assembly].map((component) => component.name))
      for (const reference of part.references) expect(assemblySources).toContain(reference)
    }

    const esp32 = sourceComponents.find((component) => component.name === "U_ESP32")
    const ethernet = sourceComponents.find((component) => component.name === "U_ETHERNET")
    const v5Buck = sourceComponents.find((component) => component.name === "U_V5_BUCK")
    const v5Sense = sourceComponents.find((component) => component.name === "R_V5_SENSE")
    const ethernetPcbComponent = communicationsCircuitJson.find(
      (element) => element.type === "pcb_component" && element.source_component_id === ethernet?.source_component_id
    )
    const ethernetPcbComponentId =
      ethernetPcbComponent !== undefined && "pcb_component_id" in ethernetPcbComponent
        ? ethernetPcbComponent.pcb_component_id
        : undefined
    const ethernetPads = communicationsCircuitJson.filter(
      (element) => element.type === "pcb_smtpad" && element.pcb_component_id === ethernetPcbComponentId
    )
    expect(esp32?.manufacturer_part_number).toBe("ESP32-S3-WROOM-1U-N16R2")
    expect(v5Buck?.manufacturer_part_number).toBe("TPS56A37RPAR")
    expect(v5Sense?.manufacturer_part_number).toBe("CRE2512-FZ-R002E-3")
    expect(ethernet?.manufacturer_part_number).toBe("W5500")
    expect(ethernetPads).toHaveLength(0)

    const carrierReferenceNames = new Set(carrierComponents.map((component) => component.name))
    const communicationsReferenceNames = new Set(communicationsComponents.map((component) => component.name))
    const duplicatedAcrossCircuitArtifacts = [...carrierReferenceNames].filter((reference) =>
      communicationsReferenceNames.has(reference)
    )
    expect(duplicatedAcrossCircuitArtifacts).toEqual(expect.arrayContaining(["J_USB_C", "U_USB_PD", "U_EFUSE"]))
    expect(carrierReferenceNames.has("J_PWR")).toBe(false)
    expect(carrierReferenceNames.has("J_USB2")).toBe(false)
    expect(interboardArchitectureVerdict).toMatchObject({
      canonicalCircuitStatus: "carrier-ownership-conflict",
      integrationStatus: "not-integrated",
      releaseState: "deny"
    })
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
        "U_DUPLICATE: circuit reference ownership conflicts between application-carrier/DUPLICATE and application-carrier/DUPLICATE",
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

  it("requires physical evidence for physical connectors and rejects blank or duplicate claims", () => {
    const readiness: readonly CriticalPartReadiness[] = criticalPartReadiness
    const powerInput = readiness.find((part) => part.references.some((reference) => reference === "J_USB_C"))
    if (powerInput === undefined || powerInput.physical === undefined) {
      throw new Error("The selected power input must carry physical evidence")
    }

    const missingPhysical = { ...powerInput, physical: undefined }
    expect(validateCriticalPartReadiness([missingPhysical])).toContain(
      "10177070-00011LF: connector references require physical evidence"
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

  it("assigns Ethernet and USB-C physical interfaces to the communications module", () => {
    const powerInput = criticalPartReadiness.find((part) =>
      part.references.some((reference) => reference === "J_USB_C")
    )
    const reelSockets = criticalPartReadiness.find((part) => part.references.some((reference) => reference === "J_L"))

    const ethernet = criticalPartReadiness.find((part) =>
      part.references.some((reference) => reference === "J_ETHERNET_MAGJACK")
    )
    expect(powerInput?.assembly).toBe("communications-module")
    expect(ethernet?.assembly).toBe("communications-module")
    expect(powerInput?.footprint.status).toBe("source-identified")
    expect(powerInput?.cad.status).toBe("pending")
    if (powerInput !== undefined && "url" in powerInput.cad) {
      expect(powerInput.cad.url).toContain("s10177070c.zip")
    } else {
      throw new Error("The selected power inlet must retain its manufacturer CAD source")
    }
    expect(reelSockets?.assembly).toBe("external-panel-module")
    expect(reelSockets?.footprint.status).toBe("not-applicable")
  })

  it("rejects physical-interface ownership on the wrong assembly", () => {
    const usb: CriticalPartReadiness | undefined = criticalPartReadiness.find((part) =>
      part.references.some((reference) => reference === "J_USB_C")
    )
    const reelSocket: CriticalPartReadiness | undefined = criticalPartReadiness.find((part) =>
      part.references.some((reference) => reference === "J_L")
    )
    if (usb?.physical === undefined || reelSocket?.physical === undefined) {
      throw new Error("Selected physical interfaces must retain physical evidence")
    }

    expect(validateCriticalPartReadiness([{ ...usb, assembly: "application-carrier" }])).toEqual(
      expect.arrayContaining([
        "10177070-00011LF: connector physical evidence cannot be assigned to the application-carrier assembly",
        "10177070-00011LF: usb-c physical evidence belongs to the communications-module assembly"
      ])
    )
    expect(validateCriticalPartReadiness([{ ...reelSocket, assembly: "communications-module" }])).toContain(
      "XUB-G 66.9684-*: reel-socket physical evidence belongs to the external-panel-module assembly"
    )
  })

  it("records exact reel sample suffixes and keeps every physical interface gated", () => {
    const readiness: readonly CriticalPartReadiness[] = criticalPartReadiness
    const reelSockets = readiness.find((part) => part.references.some((reference) => reference === "J_L"))
    const ethernet = readiness.find((part) => part.references.some((reference) => reference === "J_ETHERNET_MAGJACK"))
    const usb = readiness.find((part) => part.references.some((reference) => reference === "J_USB_C"))
    const power = readiness.find((part) => part.references.some((reference) => reference === "J_USB_C"))

    expect(reelSockets?.physical?.exactSampleMpns).toEqual(["66.9684-22", "66.9684-25"])
    expect(reelSockets?.physical?.mounting).toBe("panel-chassis")
    expect(reelSockets?.physical?.cycleRating).toContain("Not published")
    expect(ethernet?.physical?.shield).toContain("shell-tab")
    expect(ethernet?.physical?.cycleRating).toBe("750 mating cycles")
    expect(usb?.physical?.contactRating).toContain("40 milliohms")
    expect(usb?.physical?.cycleRating).toBe("20,000 mating cycles")
    expect(power?.physical?.retention).toContain("communications module")
    expect(power?.physical?.contactRating).toContain("40 milliohms")

    for (const part of [reelSockets, ethernet, usb, power]) {
      expect(part?.physical?.openGates.length).toBeGreaterThan(0)
      expect(part?.productionApproved).toBe(false)
    }
  })

  it("keeps generic connector models from passing selected-part verification", () => {
    const circuitJson = renderCommunicationsModule()
    const sourceComponents = circuitJson.filter((element) => element.type === "source_component")
    const ethernet = sourceComponents.find((component) => component.name === "J_ETHERNET_MAGJACK")
    const usb = sourceComponents.find((component) => component.name === "J_USB_C")

    expect(ethernet).toMatchObject({ manufacturer_part_number: "7499011121A" })
    expect(usb).toMatchObject({ manufacturer_part_number: "10177070-00011LF" })
    for (const source of [ethernet, usb]) {
      const pcbComponent = circuitJson.find(
        (element) =>
          element.type === "pcb_component" &&
          source !== undefined &&
          element.source_component_id === source.source_component_id
      )
      expect(pcbComponent).toMatchObject({ do_not_place: true })
    }
    for (const reference of ["J_ETHERNET_MAGJACK", "J_USB_C"]) {
      const part = criticalPartReadiness.find((candidate) =>
        candidate.references.some((candidateReference) => candidateReference === reference)
      )

      expect(part?.productionApproved).toBe(false)
      expect(part?.footprint.status).not.toBe("verified")
      expect(part?.mechanical.status).not.toBe("verified")
    }
  })
})
