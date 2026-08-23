import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import CommunicationsModuleCircuit, {
  communicationsModuleBoardContract,
  communicationsResetBiasContract
} from "./communications-module.circuit.js"
import { componentDecisions } from "./component-decisions.js"
import ScoringCircuit from "./index.circuit.js"

function render(circuitElement: React.ReactElement) {
  const circuit = new Circuit()
  circuit.pcbRoutingDisabled = true
  circuit.schematicDisabled = true
  circuit.setPlatform({ partsEngineDisabled: true })
  circuit.add(circuitElement)
  circuit.render()
  return circuit.getCircuitJson()
}

function renderModule() {
  return render(<CommunicationsModuleCircuit />)
}

function traceNames(json: ReturnType<typeof renderModule>) {
  return json.flatMap((element) =>
    element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
      ? [element.display_name]
      : []
  )
}

function sourceNames(json: ReturnType<typeof renderModule>) {
  return json.flatMap((element) =>
    element.type === "source_component" && typeof element.name === "string" ? [element.name] : []
  )
}

describe("communications-module circuit", () => {
  it("keeps component-decision categories and selected MPNs unique", () => {
    expect(new Set(componentDecisions.map(({ category }) => category)).size).toBe(componentDecisions.length)
    expect(new Set(componentDecisions.map(({ mpn }) => mpn)).size).toBe(componentDecisions.length)
  })

  it("owns the external input, local rail, Ethernet, and carrier boundaries", () => {
    const json = renderModule()
    const sources = sourceNames(json)
    expect(new Set(sources).size).toBe(sources.length)
    expect(sources).toEqual(
      expect.arrayContaining([
        "J_USB_C",
        "U_USB_PORT_PROTECT",
        "U_USB2_ESD",
        "U_USB_PD",
        "U_EFUSE",
        "U_COMM_3V3",
        "U_COMM_SUPERVISOR",
        "U_ETHERNET",
        "J_ETHERNET_MAGJACK",
        "J_PWR",
        "J_CTRL",
        "J_USB2"
      ])
    )
    expect(communicationsModuleBoardContract).toMatchObject({
      ethernetDecouplingStatus: "incomplete",
      fabricationRelease: "deny",
      heightMm: 55,
      layerCount: 4,
      nominalThicknessMm: 0.8,
      widthMm: 110
    })
  })

  it("models the PD/eFuse path and local regulator support", () => {
    expect(traceNames(renderModule())).toEqual(
      expect.arrayContaining([
        "J_USB_C.CC1_PORT to U_USB_PORT_PROTECT.C_CC1",
        "U_USB_PORT_PROTECT.CC1 to U_USB_PD.CC1",
        "U_USB_PD.PPHV_20 to net.PD_PPHV_20V",
        "U_EFUSE.VIN to net.PD_PPHV_20V",
        "U_EFUSE.VOUT to J_PWR.V20_EFUSE_OUT_A",
        "U_EFUSE.VOUT to U_COMM_3V3.VIN",
        "L_COMM_3V3.COMM_3V3 to net.COMM_3V3"
      ])
    )
  })

  it("uses the three-pin USB2 protector only as a shunt", () => {
    const json = renderModule()
    const protector = json.find((element) => element.type === "source_component" && element.name === "U_USB2_ESD")
    const protectorId = protector?.type === "source_component" ? protector.source_component_id : undefined
    expect(protectorId).toBeDefined()
    expect(
      json.filter(
        (element) =>
          element.type === "source_port" && protectorId !== undefined && element.source_component_id === protectorId
      )
    ).toHaveLength(3)
    expect(traceNames(json)).toEqual(
      expect.arrayContaining([
        "J_USB_C.USB_DN_PORT to U_USB2_ESD.IO1_USB_DN",
        "J_USB_C.USB_DP_PORT to U_USB2_ESD.IO2_USB_DP",
        "J_USB_C.USB_DN_PORT to J_USB2.USB_DN",
        "J_USB_C.USB_DP_PORT to J_USB2.USB_DP",
        "U_USB2_ESD.GND to net.GND"
      ])
    )
    expect(sourceNames(json)).not.toEqual(expect.arrayContaining(["R_USB_DN", "R_USB_DP"]))
  })

  it("separates supervised W5500 reset from the loaded IO-enable net", () => {
    expect(traceNames(renderModule())).toEqual(
      expect.arrayContaining([
        "U_COMM_SUPERVISOR.RESET_N to net.COMM_RESET_RELEASE_N",
        "U_ETHERNET.RST_N to net.COMM_RESET_RELEASE_N",
        "U_COMM_OE_ENABLE_BUFFER.A to net.COMM_RESET_RELEASE_N",
        "U_COMM_OE_ENABLE_BUFFER.Y to net.COMM_IO_ENABLE",
        "U_COMM_INPUT_GATE_A.1OE to net.COMM_IO_ENABLE",
        "U_COMM_INPUT_GATE_A.2OE to net.COMM_IO_ENABLE",
        "U_COMM_INPUT_GATE_B.OE to net.COMM_IO_ENABLE",
        "U_COMM_OUTPUT_GATE.1OE to net.COMM_IO_ENABLE",
        "U_COMM_OUTPUT_GATE.2OE to net.COMM_IO_ENABLE",
        "R_COMM_OE_INPUT_PD.pin2 to net.GND",
        "R_COMM_OE_PD_INPUT_A_1.pin2 to net.GND",
        "R_COMM_OE_PD_INPUT_B.pin2 to net.GND",
        "R_COMM_OE_PD_OUTPUT_1.pin2 to net.GND"
      ])
    )
    const calculatedResetV =
      (communicationsResetBiasContract.minimumRailV * communicationsResetBiasContract.enableInputPulldownMinimumOhm) /
      (communicationsResetBiasContract.resetPullupMaximumOhm +
        communicationsResetBiasContract.enableInputPulldownMinimumOhm)
    expect(calculatedResetV).toBeGreaterThanOrEqual(communicationsResetBiasContract.minimumReleasedResetV)
    expect(
      communicationsResetBiasContract.minimumReleasedResetV - communicationsResetBiasContract.maximumW5500InputHighV
    ).toBeGreaterThanOrEqual(communicationsResetBiasContract.minimumResetHighMarginV)
    expect(communicationsResetBiasContract.maximumEnablePulldownLoadA).toBeLessThan(0.001)
  })

  it("uses a local active-high request only as an open-drain reset sink", () => {
    const names = traceNames(renderModule())
    expect(names).toEqual(
      expect.arrayContaining([
        "J_CTRL.COMM_RESET_ASSERT to Q_COMM_RESET_SINK.G",
        "Q_COMM_RESET_SINK.S to net.GND",
        "Q_COMM_RESET_SINK.D to net.COMM_RESET_RELEASE_N",
        "U_ETHERNET.RST_N to net.COMM_RESET_RELEASE_N"
      ])
    )
    expect(names.some((name) => name.includes("J_CTRL.COMM_RESET_ASSERT to U_ETHERNET"))).toBe(false)
  })

  it("selects all-capable autonegotiation and leaves W5500 pins 38 through 42 open", () => {
    const names = traceNames(renderModule())
    expect(names).toEqual(
      expect.arrayContaining([
        "U_ETHERNET.PMODE2 to net.COMM_3V3",
        "U_ETHERNET.PMODE1 to net.COMM_3V3",
        "U_ETHERNET.PMODE0 to net.COMM_3V3",
        "U_ETHERNET.TXP to J_ETHERNET_MAGJACK.TD_P",
        "U_ETHERNET.TXN to J_ETHERNET_MAGJACK.TD_N",
        "U_ETHERNET.RXP to J_ETHERNET_MAGJACK.RD_P",
        "U_ETHERNET.RXN to J_ETHERNET_MAGJACK.RD_N",
        "R_MAGJACK_YELLOW.pin2 to J_ETHERNET_MAGJACK.YELLOW_A",
        "J_ETHERNET_MAGJACK.YELLOW_K to U_ETHERNET.SPDLED"
      ])
    )
    for (const pin of ["NC_38", "NC_39", "NC_40", "NC_41", "NC_42"])
      expect(names.some((name) => name.includes(`U_ETHERNET.${pin}`))).toBe(false)
  })

  it("provides every control return and never bonds chassis to signal ground", () => {
    const names = traceNames(renderModule())
    for (const ground of ["GND_1", "GND_2", "GND_3", "GND_4", "GND_5"])
      expect(names).toContain(`J_CTRL.${ground} to net.GND`)
    expect(names).toEqual(
      expect.arrayContaining([
        "J_USB_C.SHIELD to net.CHASSIS",
        "J_USB2.SHIELD to net.CHASSIS",
        "J_ETHERNET_MAGJACK.SHIELD_A to net.CHASSIS",
        "J_ETHERNET_MAGJACK.SHIELD_B to net.CHASSIS"
      ])
    )
    expect(names.some((name) => name.includes("CHASSIS to net.GND"))).toBe(false)
  })

  it("keeps fabrication-critical module parts non-placeable", () => {
    const json = renderModule()
    const artifactTypes = new Set(["pcb_smtpad", "pcb_plated_hole", "pcb_hole", "pcb_solder_paste"])
    const critical = new Set([
      "J_USB_C",
      "U_USB_PORT_PROTECT",
      "U_USB2_ESD",
      "U_USB_PD",
      "U_EFUSE",
      "U_COMM_3V3",
      "U_COMM_SUPERVISOR",
      "U_COMM_OE_ENABLE_BUFFER",
      "Q_COMM_RESET_SINK",
      "U_COMM_INPUT_GATE_A",
      "U_COMM_INPUT_GATE_B",
      "U_COMM_OUTPUT_GATE",
      "U_ETHERNET",
      "J_ETHERNET_MAGJACK",
      "J_PWR",
      "J_CTRL",
      "J_USB2"
    ])
    for (const component of json) {
      if (component.type !== "source_component" || !critical.has(component.name)) continue
      const pcbComponent = json.find(
        (candidate) =>
          candidate.type === "pcb_component" &&
          "source_component_id" in candidate &&
          candidate.source_component_id === component.source_component_id
      )
      expect(pcbComponent).toMatchObject({ do_not_place: true })
      const pcbComponentId = pcbComponent?.type === "pcb_component" ? pcbComponent.pcb_component_id : undefined
      expect(
        json.filter(
          (candidate) =>
            artifactTypes.has(candidate.type) &&
            "pcb_component_id" in candidate &&
            candidate.pcb_component_id === pcbComponentId
        )
      ).toEqual([])
    }
  })

  it("keeps the canonical carrier boundary free of duplicate USB-PD ownership", () => {
    const carrierJson = render(<ScoringCircuit />)
    const moduleJson = renderModule()
    const names = sourceNames(carrierJson)
    expect(names).toEqual(expect.arrayContaining(["J_PWR_CARRIER", "J_USB2_CARRIER"]))
    for (const legacyReference of ["J_USB_C", "U_USB_PORT_PROTECT", "U_USB_PD", "U_EFUSE"]) {
      expect(names).not.toContain(legacyReference)
    }
    expect(traceNames(moduleJson)).toEqual(
      expect.arrayContaining([
        "J_USB_C.USB_DN_PORT to U_USB2_ESD.IO1_USB_DN",
        "J_USB_C.USB_DP_PORT to U_USB2_ESD.IO2_USB_DP",
        "J_USB_C.USB_DN_PORT to J_USB2.USB_DN",
        "J_USB_C.USB_DP_PORT to J_USB2.USB_DP"
      ])
    )
    expect(traceNames(carrierJson)).toEqual(
      expect.arrayContaining([
        "J_USB2_CARRIER.USB_DN to R_USB_DN_CARRIER.USB_DN_FROM_COMM",
        "J_USB2_CARRIER.USB_DP to R_USB_DP_CARRIER.USB_DP_FROM_COMM",
        "R_USB_DN_CARRIER.USB_DN to U_ESP32.USB_DN",
        "R_USB_DP_CARRIER.USB_DP to U_ESP32.USB_DP"
      ])
    )
    expect(traceNames(moduleJson).some((name) => name.includes("J_USB2.GND"))).toBe(false)
    expect(traceNames(carrierJson).some((name) => name.includes("J_USB2_CARRIER.GND"))).toBe(false)
  })
})
