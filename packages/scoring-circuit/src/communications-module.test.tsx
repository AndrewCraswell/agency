import { describe, expect, it } from "vitest"
import CommunicationsModuleCircuit, {
  communicationsModuleBoardContract,
  communicationsResetBiasContract
} from "./communications-module.circuit.js"
import { componentDecisions } from "./component-decisions.js"
import {
  ethernetCrystalQualification,
  ethernetSupportCircuitReferences,
  ethernetSupportNetwork
} from "./ethernet-support-network.js"
import ScoringCircuit from "./index.circuit.js"
import { criticalPartReadiness } from "./part-readiness.js"
import { renderTestCircuit } from "./test-helper.js"
import { usbPdFootprints } from "./usb-pd-footprints.js"

function render(circuitElement: React.ReactElement) {
  return renderTestCircuit(circuitElement)
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

  it("binds overlapping rendered identities to canonical component and USB-PD selections", () => {
    const sources = new Map(
      renderModule()
        .filter((element) => element.type === "source_component")
        .map((element) => [element.name, element])
    )
    const componentBindings = [
      ["J_USB_C", "usb-c-power-and-service-connector"],
      ["U_USB_PORT_PROTECT", "usb-c-cc-sbu-protection"],
      ["U_USB_DATA_PROTECT", "usb2-esd-protection"],
      ["U_USB_PD", "usb-pd-controller"],
      ["D_USB_PD_VBUS_TVS", "usb-pd-vbus-transient-protection"],
      ["U_EFUSE", "power-protection"],
      ["U_COMM_3V3", "application-rail-regulator"],
      ["U_COMM_SUPERVISOR", "power-supervisor"],
      ["U_COMM_OE_ENABLE_BUFFER", "communications-oe-enable-buffer"],
      ["Q_COMM_RESET_SINK", "reset-combiner"],
      ["U_COMM_INPUT_GATE_A", "communications-io-dual-power-off-isolation"],
      ["U_COMM_OUTPUT_GATE", "communications-io-dual-power-off-isolation"],
      ["U_COMM_INPUT_GATE_B", "communications-io-single-power-off-isolation"],
      ["U_ETHERNET", "ethernet"],
      ["J_ETHERNET_MAGJACK", "ethernet-connector"]
    ] as const
    for (const [reference, category] of componentBindings) {
      const decision = componentDecisions.find((candidate) => candidate.category === category)
      const source = sources.get(reference)
      expect(decision, `${reference} canonical component decision`).toBeDefined()
      expect(source, `${reference} rendered source`).toBeDefined()
      expect(source).toMatchObject({ manufacturer_part_number: decision?.mpn })
    }

    const usbPdBindings = [
      ["D_USB_PD_VBUS_DISCONNECT", "B340A-13-F"],
      ["C_USB_PD_LDO", "T55A106M010C0200"],
      ["C_USB_PD_PPHV", "T523H107M035APE070"],
      ["C_EFUSE_OUT", "T523H107M035APE070"]
    ] as const
    for (const [reference, mpn] of usbPdBindings) {
      const footprint = usbPdFootprints.find((candidate) => candidate.mpn === mpn)
      const source = sources.get(reference)
      expect(footprint, `${reference} canonical USB-PD footprint`).toBeDefined()
      expect(source, `${reference} rendered source`).toBeDefined()
      expect(source).toMatchObject({ manufacturer_part_number: footprint?.mpn })
    }
  })

  it("owns the external input, local rail, Ethernet, and carrier boundaries", () => {
    const json = renderModule()
    const sources = sourceNames(json)
    expect(new Set(sources).size).toBe(sources.length)
    expect(sources).toEqual(
      expect.arrayContaining([
        "J_USB_C",
        "U_USB_PORT_PROTECT",
        "U_USB_DATA_PROTECT",
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
      ethernetDecouplingStatus: "selected-not-released",
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
    const protector = json.find(
      (element) => element.type === "source_component" && element.name === "U_USB_DATA_PROTECT"
    )
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
        "J_USB_C.USB_DP_PORT to U_USB_DATA_PROTECT.IO1_USB_DP",
        "J_USB_C.USB_DN_PORT to U_USB_DATA_PROTECT.IO2_USB_DN",
        "J_USB_C.USB_DN_PORT to J_USB2.USB_DN",
        "J_USB_C.USB_DP_PORT to J_USB2.USB_DP",
        "U_USB_DATA_PROTECT.GND to net.GND"
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

  it("integrates every selected W5500 support reference without granting PCB artwork or release", () => {
    const json = renderModule()
    const sources = new Map(
      json.filter((element) => element.type === "source_component").map((element) => [element.name, element])
    )
    const artifactTypes = new Set(["pcb_smtpad", "pcb_plated_hole", "pcb_hole", "pcb_solder_paste"])

    expect(ethernetSupportNetwork).toMatchObject({
      assembly: "communications-module",
      fabricationRelease: false,
      integrationRelease: false,
      releaseState: "deny"
    })
    expect([...ethernetSupportNetwork.references].sort()).toEqual(
      ethernetSupportNetwork.supportNetworkComponents.map((component) => component.reference).sort()
    )
    const circuitReferences = new Set<string>(ethernetSupportCircuitReferences)
    expect(
      json
        .filter((element) => element.type === "source_component")
        .flatMap((element) =>
          typeof element.name === "string" && circuitReferences.has(element.name) ? [element.name] : []
        )
    ).toEqual([...ethernetSupportCircuitReferences])

    const expectedElectricalValues = new Map<string, { readonly capacitance?: number; readonly resistance?: number }>([
      ["C_ETH_AVDD_FERRITE_INPUT", { capacitance: 1e-7 }],
      ["C_W5500_1V2O", { capacitance: 1e-8 }],
      ["C_W5500_TOCAP", { capacitance: 4.7e-6 }],
      ["C_W5500_VDD", { capacitance: 1e-7 }],
      ["C_W5500_XI", { capacitance: 18e-12 }],
      ["C_W5500_XO", { capacitance: 18e-12 }],
      ["R_W5500_EXRES", { resistance: 12_400 }],
      ["R_W5500_XO", { resistance: 0 }],
      ["R_W5500_XTAL", { resistance: 1_000_000 }],
      ...(["1", "2", "3", "4", "5", "6"] as const).map(
        (suffix) => [`C_W5500_AVDD_${suffix}`, { capacitance: 1e-7 }] as const
      )
    ])
    for (const support of ethernetSupportNetwork.supportNetworkComponents) {
      const source = sources.get(support.reference)
      const sourceId = source?.type === "source_component" ? source.source_component_id : undefined
      const pcb = json.find((element) => element.type === "pcb_component" && element.source_component_id === sourceId)
      const artifacts = json.filter(
        (element) =>
          artifactTypes.has(element.type) &&
          pcb?.type === "pcb_component" &&
          "pcb_component_id" in element &&
          element.pcb_component_id === pcb.pcb_component_id
      )
      expect(source).toMatchObject({
        manufacturer_part_number: support.mpn,
        ...expectedElectricalValues.get(support.reference)
      })
      expect(pcb).toMatchObject({ do_not_place: true })
      expect(artifacts).toEqual([])
    }

    const supportTraces = [
      "U_ETHERNET.VDD to net.COMM_3V3",
      "U_ETHERNET.VDD to C_W5500_VDD.pin1",
      "C_W5500_VDD.pin2 to net.GND",
      "C_ETH_AVDD_FERRITE_INPUT.pin1 to net.COMM_3V3",
      "C_ETH_AVDD_FERRITE_INPUT.pin2 to net.GND",
      "FB_W5500_AVDD.COMM_3V3 to net.COMM_3V3",
      "FB_W5500_AVDD.ETH_AVDD to net.ETH_AVDD",
      "U_ETHERNET.EXRES1 to R_W5500_EXRES.pin1",
      "R_W5500_EXRES.pin2 to net.GND",
      "U_ETHERNET.TOCAP to C_W5500_TOCAP.pin1",
      "C_W5500_TOCAP.pin2 to net.GND",
      "U_ETHERNET.1V2O to C_W5500_1V2O.pin1",
      "C_W5500_1V2O.pin2 to net.GND",
      "U_ETHERNET.XI to Y_W5500.XI",
      "Y_W5500.XO to R_W5500_XO.pin1",
      "R_W5500_XO.pin2 to U_ETHERNET.XO",
      "Y_W5500.XI to R_W5500_XTAL.pin1",
      "Y_W5500.XO to R_W5500_XTAL.pin2",
      "Y_W5500.XI to C_W5500_XI.pin1",
      "C_W5500_XI.pin2 to net.GND",
      "Y_W5500.XO to C_W5500_XO.pin1",
      "C_W5500_XO.pin2 to net.GND",
      "Y_W5500.GND_2 to net.GND",
      "Y_W5500.GND_4 to net.GND",
      ...(["1", "2", "3", "4", "5", "6"] as const).flatMap((suffix) => [
        `U_ETHERNET.AVDD${suffix} to net.ETH_AVDD`,
        `C_W5500_AVDD_${suffix}.pin1 to net.ETH_AVDD`,
        `C_W5500_AVDD_${suffix}.pin2 to net.GND`
      ])
    ]
    expect(traceNames(json)).toEqual(expect.arrayContaining(supportTraces))
    expect(ethernetCrystalQualification).toMatchObject({
      negativeResistanceProductionMinimumOhm: 200,
      overallPass: false,
      releasePass: false
    })
    expect(criticalPartReadiness.find((part) => part.mpn === "W5500")).toMatchObject({
      productionApproved: false,
      blockers: expect.arrayContaining([expect.stringContaining("200 Ohm")])
    })
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
      "U_USB_DATA_PROTECT",
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
        "J_USB_C.USB_DP_PORT to U_USB_DATA_PROTECT.IO1_USB_DP",
        "J_USB_C.USB_DN_PORT to U_USB_DATA_PROTECT.IO2_USB_DN",
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
