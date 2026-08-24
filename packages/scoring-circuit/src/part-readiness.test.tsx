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
import ScoringIoBoardCircuit from "./scoring-io-board.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

let architectureJson: ReturnType<typeof renderTestCircuit> | undefined
let communicationsModuleJson: ReturnType<typeof renderTestCircuit> | undefined
let scoringIoBoardJson: ReturnType<typeof renderTestCircuit> | undefined

function renderArchitecture() {
  if (architectureJson !== undefined) return architectureJson
  architectureJson = renderTestCircuit(<ScoringCircuit />)
  return architectureJson
}

function renderCommunicationsModule() {
  if (communicationsModuleJson !== undefined) return communicationsModuleJson
  communicationsModuleJson = renderTestCircuit(<CommunicationsModuleCircuit />)
  return communicationsModuleJson
}

function renderScoringIoBoard() {
  if (scoringIoBoardJson !== undefined) return scoringIoBoardJson
  scoringIoBoardJson = renderTestCircuit(<ScoringIoBoardCircuit />)
  return scoringIoBoardJson
}

function selectedEsp32(): CriticalPartReadiness {
  const part = criticalPartReadiness.find((candidate) => candidate.mpn === "ESP32-S3-WROOM-1U-N16R2")
  if (part === undefined) throw new Error("Expected the selected ESP32 readiness record")
  return part
}

beforeAll(() => {
  // The two rendered circuit fixtures are intentionally cached before the
  // assertions run. Rendering them together can exceed Vitest's per-test
  // default even though neither render is an asynchronous test operation.
  renderArchitecture()
  renderCommunicationsModule()
  renderScoringIoBoard()
}, 20_000)

describe("critical-part readiness", () => {
  it("passes the readiness contract without claiming fabrication approval", () => {
    expect(validateCriticalPartReadiness(criticalPartReadiness)).toEqual([])
    expect(summarizeCriticalPartReadiness(criticalPartReadiness)).toEqual({
      candidateSelections: 1,
      manufacturerVerifiedCad: 1,
      productionApproved: 0,
      selectedParts: 16,
      total: 17,
      verifiedFootprints: 0,
      verifiedMechanical: 0
    })
  })

  it("covers critical references in their declared assembly without masking duplicate board ownership", () => {
    const circuitJson = renderArchitecture()
    const communicationsCircuitJson = renderCommunicationsModule()
    const scoringIoCircuitJson = renderScoringIoBoard()
    const carrierComponents = circuitJson.filter((element) => element.type === "source_component")
    const communicationsComponents = communicationsCircuitJson.filter((element) => element.type === "source_component")
    const sourceComponents = [...carrierComponents, ...communicationsComponents]
    const sourcesByAssembly = {
      "application-carrier": carrierComponents,
      "communications-module": communicationsComponents,
      "scoring-io-board": scoringIoCircuitJson.filter((element) => element.type === "source_component"),
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
    expect(duplicatedAcrossCircuitArtifacts).toEqual([])
    expect(carrierReferenceNames.has("J_PWR_CARRIER")).toBe(true)
    expect(carrierReferenceNames.has("J_USB2_CARRIER")).toBe(true)
    expect(interboardArchitectureVerdict).toMatchObject({
      canonicalCircuitStatus: "carrier-boundary-integrated",
      integrationStatus: "integrated",
      releaseState: "deny"
    })
  })

  it("records selected scoring harness headers, mates, terminals, cables, and fail-closed board ownership", () => {
    const scoringHarnesses = criticalPartReadiness.filter((part) => part.assembly === "scoring-io-board")
    expect(
      scoringHarnesses.map((part) => ({
        cableMpn: part.physical?.cableMpn,
        interface: part.physical?.interface,
        mateHousingMpn: part.physical?.mateHousingMpn,
        mpn: part.mpn,
        pinAssignment: part.physical?.pinAssignment,
        terminalMpn: part.physical?.terminalMpn
      }))
    ).toEqual([
      {
        cableMpn: "45003",
        interface: "weapon-harness",
        mateHousingMpn: "43645-0300",
        mpn: "43650-0300",
        pinAssignment: "1 WEAPON_A, 2 WEAPON_B, 3 WEAPON_C",
        terminalMpn: "43030-0007"
      },
      {
        cableMpn: "45004",
        interface: "weapon-harness",
        mateHousingMpn: "43645-0400",
        mpn: "43650-0400",
        pinAssignment: "1 WEAPON_A, 2 WEAPON_B, 3 WEAPON_C, 4 EMPTY_CAVITY_NO_TERMINAL",
        terminalMpn: "43030-0007"
      },
      {
        cableMpn: "45002",
        interface: "piste-harness",
        mateHousingMpn: "43645-0200",
        mpn: "43650-0200",
        pinAssignment: "1 PISTE, 2 PISTE_RETURN",
        terminalMpn: "43030-0007"
      },
      {
        cableMpn: "45066",
        interface: "primary-output-harness",
        mateHousingMpn: "39-01-2060",
        mpn: "39-29-1067",
        pinAssignment: "1 LAMP_RED, 2 LAMP_GREEN, 3 LAMP_WHITE_L, 4 LAMP_WHITE_R, 5 BUZZER, 6 PRIMARY_RETURN",
        terminalMpn: "39-00-0039"
      }
    ])
    for (const harness of scoringHarnesses) {
      expect(harness.productionApproved).toBe(false)
      expect(harness.footprint.status).toBe("pending")
      expect(harness.physical?.openGates.length).toBeGreaterThan(0)
      expect(harness.physical?.retention).toContain("not load paths")
    }
    const malformedHarness: CriticalPartReadiness = {
      ...scoringHarnesses[0],
      physical: { ...scoringHarnesses[0].physical!, cableMpn: "", pinAssignment: "", terminalMpn: "" }
    }
    expect(validateCriticalPartReadiness([malformedHarness])).toEqual(
      expect.arrayContaining([
        "43650-0300: weapon-harness physical cableMpn must be nonblank",
        "43650-0300: weapon-harness physical pinAssignment must be nonblank",
        "43650-0300: weapon-harness physical terminalMpn must be nonblank"
      ])
    )
    expect(validateCriticalPartReadiness([{ ...scoringHarnesses[0], assembly: "application-carrier" }])).toContain(
      "43650-0300: weapon-harness physical evidence belongs to the scoring-io-board assembly"
    )
  })

  it("rejects premature production approval", () => {
    const incompletePart: CriticalPartReadiness = {
      ...selectedEsp32(),
      productionApproved: true
    }

    expect(validateCriticalPartReadiness([incompletePart])).toContain(
      "ESP32-S3-WROOM-1U-N16R2: production approval requires every readiness gate to pass"
    )
  })

  it("rejects malformed records and duplicate assignments", () => {
    const basePart: CriticalPartReadiness = selectedEsp32()
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
      ...selectedEsp32(),
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

  it("binds carrier interboard physical evidence to exact interfaces and MPNs", () => {
    const readiness: readonly CriticalPartReadiness[] = criticalPartReadiness
    const power = readiness.find((part) => part.references.includes("J_PWR_CARRIER"))
    const usb2 = readiness.find((part) => part.references.includes("J_USB2_CARRIER"))
    if (power?.physical === undefined || usb2?.physical === undefined) {
      throw new Error("Carrier interboard connectors must retain structured physical evidence")
    }

    expect(power).toMatchObject({ assembly: "application-carrier", mpn: "43045-0400", productionApproved: false })
    expect(power.physical).toMatchObject({
      connectorGender: expect.stringContaining("male"),
      interface: "interboard-power",
      mateMpn: expect.stringContaining("43025-0400"),
      mounting: "pcb-harness",
      pinAssignment: expect.stringContaining("4 GND_B")
    })
    expect(usb2).toMatchObject({
      assembly: "application-carrier",
      mpn: "HSEC8-113-01-L-DV-A-L2",
      productionApproved: false
    })
    expect(usb2.physical).toMatchObject({
      connectorGender: expect.stringContaining("female"),
      interface: "interboard-usb2",
      mateMpn: "ECDP-08-07.87-L1-L2-1-3",
      mounting: "pcb-harness",
      pairAssignment: expect.stringContaining("100 ohm")
    })
    expect(usb2.physical.contactRating).toContain("no power or signal-ground conductor")
    expect(power.physical.openGates.length).toBeGreaterThan(0)
    expect(usb2.physical.openGates.length).toBeGreaterThan(0)

    const wrongPowerMpn: CriticalPartReadiness = {
      ...power,
      mpn: "43045-0600",
      references: ["J_WRONG_POWER"]
    }
    const missingUsbMate: CriticalPartReadiness = {
      ...usb2,
      physical: { ...usb2.physical, mateMpn: "" },
      references: ["J_WRONG_USB2"]
    }
    const missingPowerServiceGate: CriticalPartReadiness = {
      ...power,
      physical: { ...power.physical, openGates: [] },
      references: ["J_WRONG_POWER_GATES"]
    }
    expect(validateCriticalPartReadiness([wrongPowerMpn])).toContain(
      "43045-0600: interboard-power requires exact MPN 43045-0400"
    )
    expect(validateCriticalPartReadiness([missingUsbMate])).toEqual(
      expect.arrayContaining([
        "HSEC8-113-01-L-DV-A-L2: interboard-usb2 physical mateMpn must be nonblank",
        "HSEC8-113-01-L-DV-A-L2: interboard-usb2 mate, pair, shield, or no-ground assignment changed"
      ])
    )
    expect(validateCriticalPartReadiness([missingPowerServiceGate])).toContain(
      "43045-0400: interboard-power physical openGates must not be empty before release"
    )
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
