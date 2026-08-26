import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { p0PrimaryOutputsFootprintMetadata } from "./p0-primary-outputs-footprints.js"
import P0PrimaryOutputsCircuit, { p0PrimaryOutputsCircuitContract } from "./p0-primary-outputs.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

function renderCircuit() {
  return renderTestCircuit(createElement(P0PrimaryOutputsCircuit), { pcbEnabled: true })
}

function sourceComponents() {
  return renderCircuit().flatMap((element) =>
    element.type === "source_component" && typeof element.name === "string" ? [element] : []
  )
}

function component(name: string) {
  return sourceComponents().find((candidate) => candidate.name === name)
}

function traces() {
  return renderCircuit().flatMap((element) =>
    element.type === "source_trace" && typeof element.display_name === "string" ? [element.display_name] : []
  )
}

function pcbFootprintElements(name: string) {
  const circuit = renderCircuit()
  const source = circuit.find((element) => element.type === "source_component" && element.name === name)
  if (source?.type !== "source_component") return []
  const pcbComponent = circuit.find(
    (element) => element.type === "pcb_component" && element.source_component_id === source.source_component_id
  )
  if (pcbComponent?.type !== "pcb_component") return []
  return circuit.filter(
    (element) =>
      (element.type === "pcb_smtpad" || element.type === "pcb_plated_hole") &&
      element.pcb_component_id === pcbComponent.pcb_component_id
  )
}

describe("P0 primary lamp and buzzer outputs", () => {
  it("renders the exact source driver, shared PPTC, ESD array, connector, loads, and ballasts on PCB", () => {
    const circuit = renderCircuit()
    const renderedComponents = sourceComponents()

    expect(circuit.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(component("U_P0_OUTPUT_DRIVER")).toMatchObject({ manufacturer_part_number: "TBD62783AFWG" })
    expect(component("F_P0_OUTPUTS")).toMatchObject({ manufacturer_part_number: "1206L020YR" })
    expect(component("U_P0_OUTPUT_ESD")).toMatchObject({ manufacturer_part_number: "TPD6E05U06RVZR" })
    expect(component("J_PRIMARY_OUTPUTS")).toMatchObject({ manufacturer_part_number: "39-29-1067" })
    expect(renderedComponents.map((component) => component.name)).toEqual(
      expect.arrayContaining([
        "R_P0_RED_INPUT_PD",
        "R_P0_GREEN_INPUT_PD",
        "R_P0_WHITE_LEFT_INPUT_PD",
        "R_P0_WHITE_RIGHT_INPUT_PD",
        "R_P0_BUZZER_INPUT_PD",
        "R_P0_RED_BALLAST",
        "R_P0_GREEN_BALLAST",
        "R_P0_WHITE_LEFT_BALLAST",
        "R_P0_WHITE_RIGHT_BALLAST",
        "D_P0_RED",
        "D_P0_GREEN",
        "D_P0_WHITE_LEFT",
        "D_P0_WHITE_RIGHT",
        "BZ_P0"
      ])
    )
    expect(circuit.filter((element) => element.type === "pcb_component")).toHaveLength(renderedComponents.length)
  })

  it("binds the allocated ESP32 GPIO signals through five default-low inputs to the five harness circuits", () => {
    expect(p0PrimaryOutputsCircuitContract.gpioOrder).toEqual([
      "ESP32_GPIO7_PRIMARY_LAMP_RED",
      "ESP32_GPIO15_PRIMARY_LAMP_GREEN",
      "ESP32_GPIO17_PRIMARY_LAMP_WHITE_LEFT",
      "ESP32_GPIO10_PRIMARY_LAMP_WHITE_RIGHT",
      "ESP32_GPIO11_PRIMARY_BUZZER"
    ])
    expect(traces()).toEqual(
      expect.arrayContaining([
        "U_P0_OUTPUT_DRIVER.IN1 to net.ESP32_GPIO7_PRIMARY_LAMP_RED",
        "U_P0_OUTPUT_DRIVER.IN2 to net.ESP32_GPIO15_PRIMARY_LAMP_GREEN",
        "U_P0_OUTPUT_DRIVER.IN3 to net.ESP32_GPIO17_PRIMARY_LAMP_WHITE_LEFT",
        "U_P0_OUTPUT_DRIVER.IN4 to net.ESP32_GPIO10_PRIMARY_LAMP_WHITE_RIGHT",
        "U_P0_OUTPUT_DRIVER.IN5 to net.ESP32_GPIO11_PRIMARY_BUZZER",
        "U_P0_OUTPUT_DRIVER.IN1 to R_P0_RED_INPUT_PD.pin1",
        "U_P0_OUTPUT_DRIVER.IN5 to R_P0_BUZZER_INPUT_PD.pin1",
        "R_P0_RED_INPUT_PD.pin2 to net.APP_GND",
        "R_P0_BUZZER_INPUT_PD.pin2 to net.APP_GND",
        "U_P0_OUTPUT_DRIVER.OUT1 to J_PRIMARY_OUTPUTS.CIRCUIT_1_RED",
        "U_P0_OUTPUT_DRIVER.OUT5 to J_PRIMARY_OUTPUTS.CIRCUIT_5_BUZZER",
        "J_PRIMARY_OUTPUTS.APP_GND_RETURN to net.APP_GND"
      ])
    )
    expect(p0PrimaryOutputsCircuitContract.resetState).toContain("off")
    expect(p0PrimaryOutputsCircuitContract.resetState).toContain("100 kilohm")
  })

  it("makes all three unused driver inputs and outputs explicit NC labels", () => {
    expect(p0PrimaryOutputsCircuitContract.unusedDriverPins).toEqual([
      "IN6_NC",
      "IN7_NC",
      "IN8_NC",
      "OUT6_NC",
      "OUT7_NC",
      "OUT8_NC"
    ])
    expect(traces().filter((trace) => trace.includes("_NC"))).toEqual([])
  })

  it("reconciles the placeable review pad counts and exact polarity/orientation inputs", () => {
    expect(pcbFootprintElements("U_P0_OUTPUT_DRIVER").filter((element) => element.type === "pcb_smtpad")).toHaveLength(
      18
    )
    expect(pcbFootprintElements("U_P0_OUTPUT_ESD").filter((element) => element.type === "pcb_smtpad")).toHaveLength(14)
    expect(
      pcbFootprintElements("J_PRIMARY_OUTPUTS").filter((element) => element.type === "pcb_plated_hole")
    ).toHaveLength(6)
    expect(pcbFootprintElements("BZ_P0").filter((element) => element.type === "pcb_plated_hole")).toHaveLength(2)
    expect(p0PrimaryOutputsFootprintMetadata.sourceDriver).toMatchObject({
      package: "P-SOP18-0812-1.27-001 (SOL18)",
      pitchMm: 1.27,
      evidenceState: "evidence-complete-pending-root-placement-approval",
      exactVariantBinding: expect.stringContaining("TBD62783AFWG"),
      evidenceArtifact: "docs/evidence/p0-06/toshiba-tbd62783a-family-datasheet.pdf",
      evidenceSha256: "CA6F02A615FE6A1713BF98373B72B77B98B3F78D8F7F673277CBCA8EB1922C79",
      releaseState: "deny"
    })
    expect(p0PrimaryOutputsFootprintMetadata.esdProtection).toMatchObject({
      package: "USON RVZ, 14-pin",
      pinCount: 14,
      evidenceState: "evidence-complete-pending-root-placement-approval",
      evidenceArtifact: "docs/evidence/p0-06/ti-tpd6e05u06-datasheet.pdf",
      evidenceSha256: "C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6",
      releaseState: "deny"
    })
    expect(p0PrimaryOutputsFootprintMetadata.buzzer.orientation).toContain("positive terminal")
    expect(p0PrimaryOutputsFootprintMetadata.lamp).toMatchObject({
      evidenceState: "evidence-complete-pending-root-placement-approval",
      padGeometry: { holeDiameterMm: 0.9, padDiameterMm: 1.8, leadPitchMm: 2.54 },
      evidenceArtifacts: expect.arrayContaining([
        expect.objectContaining({ manufacturerPartNumber: "WP7113ID" }),
        expect.objectContaining({ manufacturerPartNumber: "WP7113SGD" }),
        expect.objectContaining({ manufacturerPartNumber: "WP7113QWC/D" })
      ])
    })
    expect(p0PrimaryOutputsFootprintMetadata.buzzer).toMatchObject({
      evidenceState: "evidence-complete-pending-root-placement-approval",
      evidenceArtifact: "docs/evidence/p0-06/samesky-cmi-9605-0580t-datasheet.pdf",
      evidenceSha256: "857ED0E1055FFEEFAE4B48757042574BE86C80B878F396DA62168232BF08C6DB",
      padGeometry: { holeDiameterMm: 0.8, padDiameterMm: 2, leadPitchMm: 5 }
    })
    expect(p0PrimaryOutputsFootprintMetadata.primaryConnector).toMatchObject({
      manufacturerPartNumber: "39-29-1067",
      pitchMm: 4.2,
      sourceState: "official-drawing-retained; exact-six-contact-grid",
      padGeometry: {
        contactCoordinatesMm: [
          [0, 0],
          [0, 4.2],
          [4.2, 0],
          [4.2, 4.2],
          [8.4, 0],
          [8.4, 4.2]
        ]
      },
      evidenceArtifact: "docs/evidence/p0-06/molex-39-29-1067-drawing.pdf",
      evidenceSha256: "5F1CF7BA17009329350D2EAC32CDEDDCDB002F90B1E4563BDE13362A04EC6EFB"
    })
    expect(p0PrimaryOutputsFootprintMetadata.supportPassives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ manufacturerPartNumber: "RC0603FR-07100KL", package: "0603" }),
        expect.objectContaining({ manufacturerPartNumber: "RC1206FR-07180RL", package: "1206" }),
        expect.objectContaining({ manufacturerPartNumber: "1206L020YR", package: "1206" })
      ])
    )
  })
})
