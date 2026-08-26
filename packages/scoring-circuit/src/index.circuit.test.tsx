import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import { p0BoardPlacement } from "./board-placement.js"
import { assertBoardRoutingIsComplete, prototypeBoardRouting, summarizeBoardRouting } from "./board-routing.js"
import ScoringCircuit from "./index.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

const explicitNonBomBoardFeatures = new Set([
  "J_DISPLAY_POWER_PIGTAIL",
  "J_PISTE_DIRECT",
  "J_WEAPON_DIRECT",
  "TP_APP_3V3",
  "TP_APP_GND",
  "TP_BOOT_N",
  "TP_EN_RESET",
  "TP_IR_RX",
  "TP_PD_EFUSE_OUT",
  "TP_PD_PPHV",
  "TP_RECOVERY_APP_3V3",
  "TP_SCORING_REFERENCE",
  "TP_UART0_RX",
  "TP_UART0_TX",
  "TP_USB_VBUS_PORT",
  "TP_V5"
])

function isPlaceholderManufacturerPartNumber(mpn: string): boolean {
  return /^(?:placeholder|project-derived|review-candidate)(?:$|[-_\s])|^tbd(?:$|[-_\s])/iu.test(mpn)
}

type CircuitJson = ReturnType<typeof renderTestCircuit>

let placedP0Circuit: CircuitJson | undefined

function renderPlacedP0Circuit(): CircuitJson {
  if (placedP0Circuit !== undefined) return placedP0Circuit
  placedP0Circuit = renderTestCircuit(<ScoringCircuit />)
  return placedP0Circuit
}

function pcbComponent(circuit: CircuitJson, reference: string) {
  const source = circuit.find((element) => element.type === "source_component" && element.name === reference)
  if (source?.type !== "source_component") throw new RangeError(`missing source component ${reference}`)
  const component = circuit.find(
    (element) => element.type === "pcb_component" && element.source_component_id === source.source_component_id
  )
  if (component?.type !== "pcb_component") throw new RangeError(`missing PCB component ${reference}`)
  return component
}

function expectPcbLocation(
  circuit: CircuitJson,
  reference: string,
  expected: { readonly pcbX: number; readonly pcbY: number }
) {
  const component = pcbComponent(circuit, reference)
  expect(component.center.x).toBeCloseTo(expected.pcbX)
  expect(component.center.y).toBeCloseTo(expected.pcbY)
}

function offsetPlacement(
  placement: { readonly pcbX: number; readonly pcbY: number },
  origin: { readonly x: number; readonly y: number }
) {
  return { pcbX: placement.pcbX + origin.x, pcbY: placement.pcbY + origin.y }
}

describe("prototype board routing gate", () => {
  it("reports routed and unresolved connections without waiving routing or DRC errors", () => {
    const complete = summarizeBoardRouting([
      { source_trace_id: "source_trace_1", type: "source_trace" },
      { source_trace_id: "source_trace_2", type: "source_trace" },
      { source_trace_id: "source_trace_1", type: "pcb_trace" },
      { source_trace_id: "source_trace_2", type: "pcb_trace" }
    ])
    expect(complete).toMatchObject({
      pcbTraceCount: 2,
      routedConnectionCount: 2,
      sourceConnectionCount: 2,
      unroutedConnectionCount: 0,
      routingErrorCount: 0
    })
    expect(() => assertBoardRoutingIsComplete(complete)).not.toThrow()

    const incomplete = summarizeBoardRouting([
      { source_trace_id: "source_trace_1", type: "source_trace" },
      { source_trace_id: "source_trace_2", type: "source_trace" },
      { source_trace_id: "source_trace_1", type: "pcb_trace" },
      { type: "pcb_trace_missing_error" },
      { type: "pcb_trace_error" }
    ])
    expect(incomplete).toMatchObject({
      routedConnectionCount: 1,
      missingConnectionCount: 1,
      routingErrorCount: 2,
      unroutedConnectionCount: 1
    })
    expect(() => assertBoardRoutingIsComplete(incomplete)).toThrow(
      "PCB routing is incomplete: 1/2 connections routed; 1 unresolved; 2 routing/DRC errors"
    )
  })

  it("declares the four-layer APP_GND plane and its fanout phase", () => {
    const circuit = new Circuit()
    circuit.pcbDisabled = true
    circuit.pcbRoutingDisabled = true
    circuit.schematicDisabled = true
    circuit.add(<ScoringCircuit />)
    circuit.render()

    const board = circuit._getBoard()
    expect(board?._parsedProps).toMatchObject({
      autorouter: prototypeBoardRouting.autorouter,
      layers: 4
    })

    const pours = circuit.selectAll("copperpour")
    expect(pours).toHaveLength(1)
    expect(pours[0]?._parsedProps).toMatchObject({
      boardEdgeMargin: 1,
      clearance: 0.25,
      connectsTo: "net.APP_GND",
      layer: "inner1",
      name: "APP_GND_PLANE",
      padMargin: 0.25,
      traceMargin: 0.25
    })

    const phases = circuit.selectAll("autoroutingphase")
    expect(phases).toHaveLength(1)
    expect(phases[0]?._parsedProps).toMatchObject({
      autorouter: "fanout",
      connection: "net.APP_GND",
      fanoutPourNetMap: { inner1: "net.APP_GND" },
      fanoutRoutingLayers: ["inner1"],
      name: "APP_GND_FANOUT",
      phaseIndex: 0
    })
  }, 20_000)
})

describe("P0 integrated scoring-machine schematic", () => {
  it("distinguishes actual manufacturer part numbers from placeholder forms", () => {
    expect(isPlaceholderManufacturerPartNumber("TBD62783AFWG")).toBe(false)
    for (const placeholder of [
      "TBD",
      "TBD-SELECT-OUTPUT-DRIVER",
      "TBD_SELECT_OUTPUT_DRIVER",
      "PLACEHOLDER",
      "PROJECT-DERIVED-P0-DIRECT-WIRE",
      "REVIEW-CANDIDATE-FOOTPRINT"
    ]) {
      expect(isPlaceholderManufacturerPartNumber(placeholder)).toBe(true)
    }
  })

  it("renders every required hardware block without circuit errors", () => {
    const circuit = renderTestCircuit(<ScoringCircuit />, { pcbEnabled: false })
    expect(circuit.filter((element) => element.type.includes("error"))).toEqual([])
    const names = circuit.flatMap((element) =>
      element.type === "source_component" && typeof element.name === "string" ? [element.name] : []
    )
    expect(names.length).toBeLessThan(190)
    expect(names).toEqual(
      expect.arrayContaining([
        "U_APP",
        "J_POWER_INPUT",
        "F_MAIN_5V",
        "U_PHASE_CONTROL_1",
        "U_PHASE_CONTROL_2",
        "U_SOURCE_MUX",
        "U_SINK_MUX",
        "U_SENSE_MUX",
        "U_SAR",
        "U_REF",
        "U_ETHERNET",
        "J_HUB75",
        "U_IR_RX",
        "U_P0_OUTPUT_DRIVER",
        "J_WEAPON_DIRECT",
        "J_PISTE_DIRECT"
      ])
    )
    expect(names.some((name) => name.includes("STM32") || name.includes("ISOLAT"))).toBe(false)

    const traces = circuit.flatMap((element) =>
      element.type === "source_trace" && typeof element.display_name === "string" ? [element.display_name] : []
    )
    expect(traces).toEqual(
      expect.arrayContaining([
        "J_WEAPON_DIRECT.LEFT_WEAPON_A to net.LEFT_WEAPON_A",
        "J_WEAPON_DIRECT.LEFT_WEAPON_B to net.LEFT_WEAPON_B",
        "J_WEAPON_DIRECT.LEFT_WEAPON_C to net.LEFT_WEAPON_C",
        "J_WEAPON_DIRECT.RIGHT_WEAPON_A to net.RIGHT_WEAPON_A",
        "J_WEAPON_DIRECT.RIGHT_WEAPON_B to net.RIGHT_WEAPON_B",
        "J_WEAPON_DIRECT.RIGHT_WEAPON_C to net.RIGHT_WEAPON_C",
        "J_PISTE_DIRECT.PISTE to net.PISTE",
        "R_V5_ANALOG_LINK.pin1 to net.V5",
        "R_V5_ANALOG_LINK.pin2 to net.V5_ANALOG",
        "R_SCORING_GROUND_LINK.pin1 to net.SCORING_SGND",
        "R_SCORING_GROUND_LINK.pin2 to net.APP_GND"
      ])
    )
  }, 20_000)

  it("emits a complete populated BOM inventory with no placeholder parts", () => {
    const circuit = renderTestCircuit(<ScoringCircuit />, { pcbEnabled: false })
    const sources = circuit.filter((element) => element.type === "source_component")
    const failures: string[] = []
    const references = new Set<string>()

    for (const source of sources) {
      const reference = source.name
      if (typeof reference !== "string" || reference.trim() === "") {
        failures.push("A source component has a blank reference")
        continue
      }
      if (references.has(reference)) failures.push(`${reference} is duplicated`)
      references.add(reference)

      if (explicitNonBomBoardFeatures.has(reference) || reference.startsWith("TP_")) continue
      const mpn = source.manufacturer_part_number
      if (typeof mpn !== "string" || mpn.trim() === "") {
        failures.push(`${reference} has no populated manufacturer part number`)
      } else if (isPlaceholderManufacturerPartNumber(mpn)) {
        failures.push(`${reference} has placeholder manufacturer part number ${mpn}`)
      }
    }

    expect(circuit.filter((element) => element.type.includes("error"))).toEqual([])
    expect(failures).toEqual([])
  }, 20_000)

  it("uses a roomy bench placement for the processor and external connectors", () => {
    expect(p0BoardPlacement.board).toMatchObject({ widthMm: 250, heightMm: 180 })
    expect(p0BoardPlacement.islands.esp32).toEqual({ pcbX: 55, pcbY: 58 })
    expect(p0BoardPlacement.islands.digital).toMatchObject({
      ethernet: { pcbX: 105, pcbY: -52 },
      hub75: { pcbX: 108, pcbY: 18 }
    })
    expect(p0BoardPlacement.islands.irReceiver.pcbRotation).toBe(180)
  })

  it("PCB-renders the complete board inside its boundary and realizes every placement landmark", () => {
    const circuit = renderPlacedP0Circuit()
    const board = circuit.find((element) => element.type === "pcb_board")
    if (board?.type !== "pcb_board") throw new RangeError("missing rendered PCB board")
    const halfWidth = p0BoardPlacement.board.widthMm / 2
    const halfHeight = p0BoardPlacement.board.heightMm / 2
    const placementErrors = circuit.filter(
      (element) =>
        element.type.includes("error") && /(?:keepout|outside|overlap|placement|pcb)/iu.test(JSON.stringify(element))
    )
    const sourceComponentIds = new Set(
      circuit.flatMap((element) => (element.type === "source_component" ? [element.source_component_id] : []))
    )
    const components = circuit
      .filter((element) => element.type === "pcb_component")
      .filter((component) => sourceComponentIds.has(component.source_component_id))

    expect(circuit.filter((element) => element.type.includes("error"))).toEqual([])
    expect(placementErrors).toEqual([])
    expect(components.length).toBeLessThan(190)
    const outOfBounds = components.flatMap((component) => {
      if (
        component.center.x >= board.center.x - halfWidth &&
        component.center.x <= board.center.x + halfWidth &&
        component.center.y >= board.center.y - halfHeight &&
        component.center.y <= board.center.y + halfHeight
      )
        return []
      const source = circuit.find(
        (element) =>
          element.type === "source_component" && element.source_component_id === component.source_component_id
      )
      return [{ center: component.center, reference: source?.type === "source_component" ? source.name : "unknown" }]
    })
    expect(outOfBounds).toEqual([])

    expectPcbLocation(
      circuit,
      "J_WEAPON_DIRECT",
      offsetPlacement(
        {
          pcbX: p0BoardPlacement.islands.weapon.pcbX - 9.3,
          pcbY: p0BoardPlacement.islands.weapon.pcbY + 3.81
        },
        board.center
      )
    )
    expectPcbLocation(
      circuit,
      "J_PISTE_DIRECT",
      offsetPlacement(
        { pcbX: p0BoardPlacement.islands.piste.pcbX, pcbY: p0BoardPlacement.islands.piste.pcbY + 0.3 },
        board.center
      )
    )
    expectPcbLocation(
      circuit,
      "J_USB_C",
      offsetPlacement(
        {
          pcbX: p0BoardPlacement.islands.usbPower.pcbX - 34,
          pcbY: p0BoardPlacement.islands.usbPower.pcbY + 2.21
        },
        board.center
      )
    )
    expectPcbLocation(circuit, "U_ETHERNET", offsetPlacement(p0BoardPlacement.islands.digital.ethernet, board.center))
    expectPcbLocation(
      circuit,
      "J_HUB75",
      offsetPlacement(
        {
          pcbX: p0BoardPlacement.islands.digital.hub75.pcbX + 1.27,
          pcbY: p0BoardPlacement.islands.digital.hub75.pcbY + 8.89
        },
        board.center
      )
    )
    expectPcbLocation(
      circuit,
      "U_APP",
      offsetPlacement(
        { pcbX: p0BoardPlacement.islands.esp32.pcbX, pcbY: p0BoardPlacement.islands.esp32.pcbY + 10.125 },
        board.center
      )
    )
    expectPcbLocation(
      circuit,
      "U_IR_RX",
      offsetPlacement(
        {
          pcbX: p0BoardPlacement.islands.irReceiver.pcbX - 2.54,
          pcbY: p0BoardPlacement.islands.irReceiver.pcbY - 2.4
        },
        board.center
      )
    )

    const whiteRight = pcbComponent(circuit, "D_P0_WHITE_RIGHT")
    const buzzer = pcbComponent(circuit, "BZ_P0")
    expectPcbLocation(
      circuit,
      "J_DISPLAY_POWER_PIGTAIL",
      offsetPlacement(
        {
          pcbX: p0BoardPlacement.islands.displayPower.pcbX + 37,
          pcbY: p0BoardPlacement.islands.displayPower.pcbY
        },
        board.center
      )
    )
    expect(Math.abs(whiteRight.center.y - buzzer.center.y)).toBeGreaterThanOrEqual(10)
  }, 300_000)
})
