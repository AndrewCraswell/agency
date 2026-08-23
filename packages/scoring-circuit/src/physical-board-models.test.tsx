import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import ApplicationDisplayCarrierCircuit, { hub75Signals } from "./application-display-carrier.circuit.js"
import CommunicationsModuleCircuit from "./communications-module.circuit.js"
import LogicalArchitectureCircuit from "./index.circuit.js"
import {
  applicationDisplayOwnedReferences,
  isolatedInterboardPinLabels,
  physicalBoardContract,
  physicalBoardOpenFunctionalRoutingGates,
  scoringIoOwnedReferences,
  validatePhysicalBoardContract
} from "./physical-board-contract.js"
import ScoringIoBoardCircuit from "./scoring-io-board.circuit.js"

type CircuitJson = ReturnType<InstanceType<typeof Circuit>["getCircuitJson"]>

function render(element: React.ReactElement, pcbEnabled: boolean): CircuitJson {
  const circuit = new Circuit()
  circuit.pcbDisabled = !pcbEnabled
  circuit.pcbRoutingDisabled = true
  circuit.schematicDisabled = true
  circuit.setPlatform({ partsEngineDisabled: true })
  circuit.add(element)
  circuit.render()
  return circuit.getCircuitJson()
}

const scoringSource = render(<ScoringIoBoardCircuit />, false)
const applicationSource = render(<ApplicationDisplayCarrierCircuit />, false)
const communicationsSource = render(<CommunicationsModuleCircuit />, false)
const logicalSource = render(<LogicalArchitectureCircuit />, false)
const scoringPcb = render(<ScoringIoBoardCircuit />, true)
const applicationPcb = render(<ApplicationDisplayCarrierCircuit />, true)

function sourceNames(json: CircuitJson): string[] {
  return json.flatMap((element) =>
    element.type === "source_component" && typeof element.name === "string" ? [element.name] : []
  )
}

function traceNames(json: CircuitJson): string[] {
  return json.flatMap((element) =>
    element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
      ? [element.display_name]
      : []
  )
}

function expectNoRenderErrors(json: CircuitJson): void {
  expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
}

function expectDnpWithoutFabricationArtifacts(json: CircuitJson, reference: string): void {
  const artifactTypes = new Set(["pcb_smtpad", "pcb_plated_hole", "pcb_hole", "pcb_solder_paste"])
  const source = json.find((element) => element.type === "source_component" && element.name === reference)
  const sourceId = source?.type === "source_component" ? source.source_component_id : undefined
  const pcbComponent = json.find(
    (element) => element.type === "pcb_component" && element.source_component_id === sourceId
  )
  const pcbId = pcbComponent?.type === "pcb_component" ? pcbComponent.pcb_component_id : undefined
  const artifacts = json.filter(
    (element) =>
      artifactTypes.has(element.type) &&
      "pcb_component_id" in element &&
      pcbId !== undefined &&
      element.pcb_component_id === pcbId
  )
  expect(source).toBeDefined()
  expect(source).not.toHaveProperty("footprint")
  expect(pcbComponent).toMatchObject({ do_not_place: true })
  expect(artifacts).toEqual([])
}

describe("separate physical-board planning models", () => {
  it("keeps the reviewed six-layer envelopes while thickness remains a contract datum", () => {
    validatePhysicalBoardContract()
    expect(physicalBoardContract.scoringIoBoard).toMatchObject({
      widthMm: 290,
      heightMm: 70,
      layers: 6,
      finishedThicknessMm: 1.6
    })
    expect(physicalBoardContract.applicationDisplayCarrier).toMatchObject({
      widthMm: 290,
      heightMm: 135,
      layers: 6,
      finishedThicknessMm: 1.6
    })
    expect(scoringPcb.find((element) => element.type === "pcb_board")).toMatchObject({
      width: 290,
      height: 70,
      num_layers: 6
    })
    expect(applicationPcb.find((element) => element.type === "pcb_board")).toMatchObject({
      width: 290,
      height: 135,
      num_layers: 6
    })
    expect(JSON.stringify([scoringPcb, applicationPcb])).not.toContain("finished_thickness")
  })

  it("renders both physical source models without connectivity or property errors", () => {
    expectNoRenderErrors(scoringSource)
    expectNoRenderErrors(applicationSource)
    expectNoRenderErrors(scoringPcb)
    expectNoRenderErrors(applicationPcb)
  })

  it("uses an identical complete isolation-boundary pin contract on both boards", () => {
    const expectedPins = Object.values(isolatedInterboardPinLabels)
    for (const [json, reference] of [
      [scoringSource, "J_ISO_APP_BOUNDARY"],
      [applicationSource, "J_ISO_SCORING_BOUNDARY"]
    ] as const) {
      const source = json.find((element) => element.type === "source_component" && element.name === reference)
      const sourceId = source?.type === "source_component" ? source.source_component_id : undefined
      const ports = json.flatMap((element) =>
        element.type === "source_port" && element.source_component_id === sourceId ? element.port_hints : []
      )
      for (const pin of expectedPins) expect(ports).toContain(pin)
    }
    expect(expectedPins).toEqual([
      "V5_PRIMARY",
      "APP_GND_PRIMARY",
      "V3_3_APP",
      "APP_GND_LOGIC",
      "SCORE_SCK",
      "SCORE_MOSI",
      "SCORE_MISO",
      "SCORE_CS",
      "ESP_RESET_ASSERT",
      "STM_HEARTBEAT",
      "ESP_HEARTBEAT"
    ])
  })

  it("carries every committed isolation rail, return, signal, and reset-combiner path", () => {
    expect(traceNames(scoringSource)).toEqual(
      expect.arrayContaining([
        "J_ISO_APP_BOUNDARY.V5_PRIMARY to U_ISOLATED_POWER.V5",
        "J_ISO_APP_BOUNDARY.APP_GND_PRIMARY to U_ISOLATED_POWER.GND",
        "J_ISO_APP_BOUNDARY.V3_3_APP to U_ISO_MAIN.V3_3",
        "J_ISO_APP_BOUNDARY.APP_GND_LOGIC to U_ISO_MAIN.GND",
        "U_ISO_MAIN.A_SCK to J_ISO_APP_BOUNDARY.SCORE_SCK",
        "U_ISO_MAIN.A_ESP_HEARTBEAT to J_ISO_APP_BOUNDARY.ESP_HEARTBEAT",
        "U_ISO_MAIN.S_ESP_HEARTBEAT to U_STM32.ESP_HEARTBEAT"
      ])
    )
    expect(traceNames(applicationSource)).toEqual(
      expect.arrayContaining([
        "J_ISO_SCORING_BOUNDARY.V5_PRIMARY to net.V5",
        "J_ISO_SCORING_BOUNDARY.V3_3_APP to net.V3_3",
        "J_ISO_SCORING_BOUNDARY.ESP_RESET_ASSERT to R_STM_RESET_GATE.pin1",
        "Q_ESP_RESET_STM.D to U_ESP32.EN_RESET",
        "U_ESP32.ESP_HEARTBEAT to J_ISO_SCORING_BOUNDARY.ESP_HEARTBEAT"
      ])
    )
  })

  it("powers both watchdogs and supervisors and carries the isolated S5 rail end to end", () => {
    expect(traceNames(scoringSource)).toEqual(
      expect.arrayContaining([
        "J_ISO_APP_BOUNDARY.V5_PRIMARY to U_ISOLATED_POWER.V5",
        "U_ISOLATED_POWER.S5 to net.S5",
        "U_SCORING_LDO.S5 to net.S5",
        "U_VREF.VIN to net.S5",
        "U_STM_WATCHDOG.S3_3 to net.S3_3",
        "U_STM_WATCHDOG.SGND to net.SGND",
        "U_STM_SUPERVISOR.S3_3 to net.S3_3",
        "U_STM_SUPERVISOR.SGND to net.SGND"
      ])
    )
    expect(traceNames(applicationSource)).toEqual(
      expect.arrayContaining([
        "U_ESP_WATCHDOG.V3_3 to net.V3_3",
        "U_ESP_WATCHDOG.GND to net.GND",
        "U_ESP_SUPERVISOR.V3_3 to net.V3_3",
        "U_ESP_SUPERVISOR.GND to net.GND"
      ])
    )
  })

  it("preserves the carrier power and USB paths including Kelvin monitoring", () => {
    expect(traceNames(applicationSource)).toEqual(
      expect.arrayContaining([
        "J_USB2_CARRIER.USB_DN to R_USB_DN_CARRIER.USB_DN_FROM_COMM",
        "R_USB_DN_CARRIER.USB_DN to U_ESP32.USB_DN",
        "J_USB2_CARRIER.USB_DP to R_USB_DP_CARRIER.USB_DP_FROM_COMM",
        "R_USB_DP_CARRIER.USB_DP to U_ESP32.USB_DP",
        "U_V5_BUCK.SW to L_V5_BUCK.SW",
        "L_V5_BUCK.V5_SENSE_IN to R_V5_SENSE.V5_SENSE_IN",
        "R_V5_SENSE.V5 to net.V5",
        "L_V5_BUCK.V5_SENSE_IN to U_POWER_MONITOR.VIN_P",
        "U_POWER_MONITOR.VIN_N to net.V5",
        "J_PWR_CARRIER.V20_EFUSE_OUT_A to R_V5_BUCK_EN_UP.pin1",
        "R_V5_BUCK_EN_UP.pin2 to U_V5_BUCK.EN",
        "U_V5_BUCK.EN to R_V5_BUCK_EN_DOWN.pin1",
        "R_V5_BUCK_EN_DOWN.pin2 to net.GND",
        "U_V5_BUCK.AGND to net.GND",
        "U_V5_BUCK.PGND to net.GND",
        "U_APP_REGULATOR.EN_UVLO to net.V5"
      ])
    )
  })

  it("keeps communications reset fixture-only and status signals polling/test-point-only", () => {
    expect(traceNames(applicationSource)).toEqual(
      expect.arrayContaining([
        "J_CTRL_CARRIER.COMM_RESET_ASSERT to R_COMM_RESET_ASSERT_DEFAULT_LOW.pin1",
        "J_CTRL_CARRIER.COMM_RESET_ASSERT to TP_COMM_RESET_ASSERT.COMM_RESET_ASSERT_TEST_ONLY",
        "J_CTRL_CARRIER.COMM_PRESENT_N to TP_COMM_PRESENT_N.COMM_PRESENT_N",
        "J_CTRL_CARRIER.W5500_INT_N to TP_COMM_INT_N.W5500_INT_N_POLLING_ONLY"
      ])
    )
    expect(
      traceNames(applicationSource).some((trace) => trace.includes("U_ESP32") && trace.includes("COMM_RESET"))
    ).toBe(false)
  })

  it("defines audio returns and FRAM hardware write/hold defaults", () => {
    expect(traceNames(applicationSource)).toEqual(
      expect.arrayContaining([
        "U_AUDIO.AVSS to net.GND",
        "U_AUDIO.DVSS to net.GND",
        "U_AUDIO.DVDD to net.V3_3",
        "U_FRAM.WP to R_FRAM_WP_PULLUP.pin1",
        "R_FRAM_WP_PULLUP.pin2 to net.V3_3",
        "U_FRAM.HOLD to R_FRAM_HOLD_PULLUP.pin1",
        "R_FRAM_HOLD_PULLUP.pin2 to net.V3_3"
      ])
    )
  })

  it("carries all thirteen HUB75 channels and fail-safe direction, OE, reset, power, and returns", () => {
    const traces = traceNames(applicationSource)
    for (const [espSignal, buffer, input, output, panel] of hub75Signals) {
      expect(traces).toContain(`U_ESP32.${espSignal} to ${buffer}.${input}`)
      expect(traces).toContain(`${buffer}.${output} to J_HUB75.${panel}`)
    }
    expect(traces).toEqual(
      expect.arrayContaining([
        "U_DISPLAY_BUFFER_A.DIR_TO_PANEL to net.V5",
        "U_DISPLAY_BUFFER_B.DIR_TO_PANEL to net.V5",
        "U_DISPLAY_BUFFER_B.OE_N_OUT to R_HUB75_PANEL_OE_PULLUP.pin1",
        "Q_DISPLAY_BUFFER_A_ENABLE.D to U_DISPLAY_BUFFER_A.BUFFER_ENABLE_N",
        "U_ESP32.EN_RESET to R_BUFFER_A_GATE.pin1",
        "J_HUB75.GND1 to net.GND",
        "J_HUB75.GND2 to net.GND",
        "J_HUB75.GND3 to net.GND"
      ])
    )
  })

  it("keeps physical ownership exact and disjoint from the communications module", () => {
    expect(new Set(sourceNames(scoringSource))).toEqual(new Set(scoringIoOwnedReferences))
    expect(new Set(sourceNames(applicationSource))).toEqual(new Set(applicationDisplayOwnedReferences))
    const physical = new Set<string>([...scoringIoOwnedReferences, ...applicationDisplayOwnedReferences])
    expect(sourceNames(communicationsSource).filter((reference) => physical.has(reference))).toEqual([])
    const logical = new Set(sourceNames(logicalSource))
    for (const required of ["U_STM32", "U_ISO_MAIN", "U_ESP32", "U_V5_BUCK", "J_CTRL_CARRIER", "J_HUB75"]) {
      expect(logical.has(required)).toBe(true)
      expect(physical.has(required)).toBe(true)
    }
    expect(sourceNames(communicationsSource)).toEqual(
      expect.arrayContaining(["J_USB_C", "U_USB_PD", "U_EFUSE", "U_ETHERNET", "J_ETHERNET_MAGJACK"])
    )
  })

  it("keeps unselected isolation, weapon, piste, and primary-output interfaces DNP with zero PCB artifacts", () => {
    for (const reference of [
      "J_ISO_APP_BOUNDARY",
      "J_WEAPON_HARNESS_L",
      "J_WEAPON_HARNESS_R",
      "J_PISTE_HARNESS",
      "U_PRIMARY_OUTPUT_DRIVER",
      "J_PRIMARY_OUTPUTS_HARNESS"
    ]) {
      expectDnpWithoutFabricationArtifacts(scoringPcb, reference)
    }
    for (const reference of physicalBoardOpenFunctionalRoutingGates[0].references) {
      expectDnpWithoutFabricationArtifacts(scoringPcb, reference)
    }
    expect(physicalBoardOpenFunctionalRoutingGates[0]).toMatchObject({
      id: "scoring-line-switch-functional-routing",
      status: "open"
    })
    expect(physicalBoardOpenFunctionalRoutingGates[0].reason).toContain("no functional routing")
    expectDnpWithoutFabricationArtifacts(applicationPcb, "J_ISO_SCORING_BOUNDARY")
  })
})
