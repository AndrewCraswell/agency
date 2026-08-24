import { describe, expect, it } from "vitest"
import CommunicationsModuleCircuit from "./communications-module.circuit.js"
import ScoringCircuit from "./index.circuit.js"
import { manufacturerFootprintEligibility, manufacturerFootprintProps } from "./manufacturer-footprint-adapter.js"
import { renderTestCircuit } from "./test-helper.js"

function renderPcbPlacements() {
  return renderTestCircuit(<ScoringCircuit />)
}

function renderCommunicationsPcbPlacements() {
  return renderTestCircuit(<CommunicationsModuleCircuit />)
}

function pcbArtifactsFor(circuitJson: ReturnType<typeof renderPcbPlacements>, name: string) {
  const source = circuitJson.find((element) => element.type === "source_component" && element.name === name)
  const sourceComponentId =
    source !== undefined && "source_component_id" in source ? source.source_component_id : undefined
  const pcbComponent = circuitJson.find(
    (element) =>
      element.type === "pcb_component" &&
      sourceComponentId !== undefined &&
      element.source_component_id === sourceComponentId
  )
  const pcbComponentId =
    pcbComponent !== undefined && "pcb_component_id" in pcbComponent ? pcbComponent.pcb_component_id : undefined
  const fabricationArtifactTypes = new Set(["pcb_smtpad", "pcb_plated_hole", "pcb_hole", "pcb_solder_paste"])
  const fabricationArtifacts = circuitJson.filter(
    (element) =>
      fabricationArtifactTypes.has(element.type) &&
      pcbComponentId !== undefined &&
      "pcb_component_id" in element &&
      element.pcb_component_id === pcbComponentId
  )
  return { fabricationArtifacts, pcbComponent, source }
}

describe("manufacturer footprint adapter", () => {
  it("requires complete copper, mask, paste, and courtyard evidence before PCB artwork", () => {
    const mpns = [
      "TPS25730ADREFR",
      "TPD4S201TRGRRQ1",
      "TVS2200DRVR",
      "TPS259474ARPWR",
      "B340A-13-F",
      "T55A106M010C0200",
      "T523H107M035APE070",
      "LMR43620MSC3RPERQ1",
      "XGL4030-222MEC",
      "TPS56A37RPAR",
      "744325330",
      "CRE2512-FZ-R002E-3",
      "GRM32ER7YA106KA12L",
      "GRM32ER71E226KE15L",
      "C2012X7S1A226M125AC",
      "C0603C104K3RACTU",
      "GRM188R71A105KA61"
    ]

    for (const mpn of mpns) {
      const eligibility = manufacturerFootprintEligibility(mpn)
      expect(eligibility.eligibleForPcb).toBe(false)
      expect(eligibility.missingReleaseData.length).toBeGreaterThan(0)
      expect(manufacturerFootprintProps(mpn)).toEqual({ doNotPlace: true })
    }

    expect(manufacturerFootprintEligibility("TPS25730ADREFR").missingReleaseData).toEqual(
      expect.arrayContaining(["courtyard", "solder-mask"])
    )
    expect(manufacturerFootprintEligibility("T523H107M035APE070").missingReleaseData).toEqual(
      expect.arrayContaining(["paste", "solder-mask"])
    )
    expect(manufacturerFootprintEligibility("GRM32ER7YA106KA12L").missingReleaseData).toEqual(
      expect.arrayContaining(["copper", "courtyard", "paste", "solder-mask"])
    )
    expect(manufacturerFootprintEligibility("10177070-00011LF")).toMatchObject({
      missingReleaseData: expect.arrayContaining(["copper"]),
      reviewGeometryStatus: "omitted-incomplete-coordinate-pattern",
      reviewOnlyFootprint: []
    })
    expect(manufacturerFootprintEligibility("XGL4030-222MEC")).toMatchObject({
      missingReleaseData: expect.arrayContaining(["copper"]),
      reviewGeometryStatus: "omitted-incomplete-coordinate-pattern",
      reviewOnlyFootprint: []
    })
    expect(manufacturerFootprintEligibility("UNKNOWN-MPN")).toMatchObject({
      missingReleaseData: ["copper", "courtyard", "paste", "solder-mask"],
      orientation: "no released orientation data",
      reviewGeometryStatus: "omitted-incomplete-coordinate-pattern",
      reviewOnlyFootprint: []
    })
  })

  it("retains manufacturer pad count, pin mapping, and orientation as review-only data", () => {
    const controller = manufacturerFootprintEligibility("TPS25730ADREFR")
    const protector = manufacturerFootprintEligibility("TPD4S201TRGRRQ1")
    const tvs = manufacturerFootprintEligibility("TVS2200DRVR")
    const efuse = manufacturerFootprintEligibility("TPS259474ARPWR")

    expect(controller.reviewOnlyFootprint).toHaveLength(40)
    expect(controller.orientation).toContain("Pin 1 begins at the upper left")
    const controllerCc1 = controller.reviewOnlyFootprint.find((pad) => pad.portHints[0] === "28")
    expect(controllerCc1).toMatchObject({ portHints: ["28"], y: 1.925 })
    expect(controllerCc1?.x).toBeCloseTo(1.6)
    expect(protector.reviewOnlyFootprint).toHaveLength(21)
    expect(protector.reviewOnlyFootprint.find((pad) => pad.portHints?.[0] === "4")).toMatchObject({
      portHints: ["4"],
      x: -1.35,
      y: -0.5
    })
    expect(tvs.reviewOnlyFootprint).toHaveLength(7)
    expect(efuse.reviewOnlyFootprint).toHaveLength(10)
    expect(controller.reviewGeometryStatus).toBe("coordinate-pads")
    expect(manufacturerFootprintEligibility("TPS56A37RPAR")).toMatchObject({
      reviewGeometryStatus: "omitted-incomplete-coordinate-pattern",
      reviewOnlyFootprint: []
    })
  })

  it("emits no review geometry into the actual PCB model and retains all relevant circuit nets", () => {
    const circuitJson = renderPcbPlacements()
    const communicationsJson = renderCommunicationsPcbPlacements()
    const communicationsReferences = new Set([
      "J_USB_C",
      "U_USB_PORT_PROTECT",
      "D_USB_PD_VBUS_TVS",
      "U_USB_PD",
      "C_USB_PD_LDO",
      "C_USB_PD_PPHV",
      "D_USB_PD_VBUS_DISCONNECT",
      "U_EFUSE",
      "C_EFUSE_OUT"
    ])
    const communicationsPlacementCenters = new Set<string>()
    const carrierPlacementCenters = new Set<string>()
    const communicationsPlacementReferences = [
      "J_USB_C",
      "U_USB_PORT_PROTECT",
      "D_USB_PD_VBUS_TVS",
      "U_USB_PD",
      "C_USB_PD_LDO",
      "C_USB_PD_PPHV",
      "D_USB_PD_VBUS_DISCONNECT",
      "U_EFUSE",
      "C_EFUSE_OUT"
    ] as const
    const carrierPlacementReferences = [
      "U_V5_BUCK",
      "L_V5_BUCK",
      "R_V5_SENSE",
      "C_V5_BUCK_IN_A",
      "C_V5_BUCK_OUT_A",
      "U_APP_REGULATOR",
      "L_APP_REGULATOR",
      "C_APP_REG_OUT_A"
    ] as const
    for (const reference of [...communicationsPlacementReferences, ...carrierPlacementReferences]) {
      const sourceJson = communicationsReferences.has(reference) ? communicationsJson : circuitJson
      const { fabricationArtifacts, pcbComponent, source } = pcbArtifactsFor(sourceJson, reference)
      expect(source).not.toHaveProperty("footprint")
      expect(pcbComponent).toMatchObject({ do_not_place: true })
      expect(fabricationArtifacts).toHaveLength(0)
      const center = pcbComponent !== undefined && "center" in pcbComponent ? pcbComponent.center : undefined
      expect(center).toBeDefined()
      if (center !== undefined) {
        const centers = communicationsReferences.has(reference)
          ? communicationsPlacementCenters
          : carrierPlacementCenters
        centers.add(`${center.x}:${center.y}`)
      }
    }
    expect(communicationsPlacementCenters.size).toBe(communicationsPlacementReferences.length)
    expect(carrierPlacementCenters.size).toBe(carrierPlacementReferences.length)
    expect(pcbArtifactsFor(communicationsJson, "J_USB_C").source).toMatchObject({
      manufacturer_part_number: "10177070-00011LF"
    })

    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )
    const communicationsTraceNames = communicationsJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )
    expect([...traceNames, ...communicationsTraceNames]).toEqual(
      expect.arrayContaining([
        "U_USB_PORT_PROTECT.CC1 to U_USB_PD.CC1",
        "U_EFUSE.VOUT to J_PWR.V20_EFUSE_OUT_A",
        "U_V5_BUCK.SW to L_V5_BUCK.SW",
        "L_APP_REGULATOR.V3_3 to net.V3_3"
      ])
    )
  }, 20_000)
})
