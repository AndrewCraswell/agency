import { describe, expect, it } from "vitest"
import {
  P0ApplicationInductorFootprint,
  P0B340aFootprint,
  P0Lmr43620Footprint,
  P0T523H107EfuseOutputFootprint,
  P0T523H107Footprint,
  P0T55A106Footprint,
  P0Tps56a37Footprint,
  P0V5InductorFootprint,
  p0UsbPowerInductorSourceBackedFootprints,
  p0UsbPowerRegulatorSourceBackedFootprints,
  p0UsbPowerSourceBackedFootprints
} from "./p0-usb-power-footprints.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
type SourceComponent = Extract<CircuitElement, { readonly type: "source_component" }>
type PcbComponent = Extract<CircuitElement, { readonly type: "pcb_component" }>
type PcbSmtPad = Extract<CircuitElement, { readonly type: "pcb_smtpad" }>

function render(component: Parameters<typeof renderTestCircuit>[0]) {
  return renderTestCircuit(component, { pcbEnabled: true })
}

function sourceComponent(circuit: readonly CircuitElement[], name: string): SourceComponent | undefined {
  return circuit.find(
    (element): element is SourceComponent => element.type === "source_component" && element.name === name
  )
}

function pcbComponent(circuit: readonly CircuitElement[], name: string): PcbComponent | undefined {
  const source = sourceComponent(circuit, name)
  if (source === undefined) return undefined
  return circuit.find((element): element is PcbComponent => {
    if (element.type !== "pcb_component") return false
    return element.source_component_id === source.source_component_id
  })
}

function pcbPads(circuit: readonly CircuitElement[], name: string): readonly PcbSmtPad[] {
  const pcb = pcbComponent(circuit, name)
  if (pcb === undefined) return []
  return circuit.filter((element): element is PcbSmtPad => {
    if (element.type !== "pcb_smtpad") return false
    return element.pcb_component_id === pcb.pcb_component_id
  })
}

describe("P0 USB/power source-backed footprints", () => {
  it("binds every two-terminal source-backed part to retained identity and orientation", () => {
    expect(p0UsbPowerSourceBackedFootprints).toMatchObject({
      b340a: { manufacturerPartNumber: "B340A-13-F", orientation: { pinOneMarker: "cathode band" } },
      t523: { manufacturerPartNumber: "T523H107M035APE070", orientation: { pinOneMarker: "positive polarity stripe" } },
      t55: { manufacturerPartNumber: "T55A106M010C0200", orientation: { pinOneMarker: "anode indication belt mark" } }
    })
    expect(p0UsbPowerInductorSourceBackedFootprints).toMatchObject({
      v5: { manufacturerPartNumber: "744325330", orientation: expect.stringContaining("vertical pad axis") },
      application: {
        manufacturerPartNumber: "XGL4030-222MEC",
        orientation: expect.stringContaining("marked short-lead side")
      }
    })
    expect(p0UsbPowerRegulatorSourceBackedFootprints).toMatchObject({
      v5: {
        manufacturerPartNumber: "TPS56A37RPAR",
        package: "RPA0010A",
        orientation: expect.stringContaining("pin 1 is the lower-left"),
        source: { pages: [3, 26, 27, 28], url: "https://www.ti.com/lit/ds/symlink/tps56a37.pdf" }
      },
      application: {
        manufacturerPartNumber: "LMR43620MSC3RPERQ1",
        package: "RPE0009A",
        orientation: expect.stringContaining("pin 1 is the upper-left"),
        source: { pages: [50, 54, 55, 56], url: "https://www.ti.com/lit/ds/symlink/lmr43620-q1.pdf" }
      }
    })
    for (const record of Object.values(p0UsbPowerSourceBackedFootprints)) {
      expect(record.source.url).toMatch(/^https:\/\//u)
      expect(record.source.pages.length).toBeGreaterThan(0)
    }
  })

  it("renders placeable pads for each selected diode, polymer capacitor, and inductor", () => {
    const cases = [
      [<P0B340aFootprint />, "D_USB_PD_VBUS_DISCONNECT", 2],
      [<P0T523H107Footprint />, "C_USB_PD_PPHV", 2],
      [<P0T523H107EfuseOutputFootprint />, "C_EFUSE_OUT", 2],
      [<P0T55A106Footprint />, "C_USB_PD_LDO", 2],
      [<P0V5InductorFootprint />, "L_V5_BUCK", 2],
      [<P0ApplicationInductorFootprint />, "L_APP_REGULATOR", 2],
      [<P0Tps56a37Footprint />, "U_V5_BUCK", 12],
      [<P0Lmr43620Footprint />, "U_APP_REGULATOR", 9]
    ] as const
    for (const [component, name, expectedPads] of cases) {
      const circuit = render(component)
      expect(sourceComponent(circuit, name)).toMatchObject({ manufacturer_part_number: expect.any(String) })
      expect(pcbComponent(circuit, name)).toMatchObject({ do_not_place: false })
      expect(pcbPads(circuit, name)).toHaveLength(expectedPads)
      expect(circuit.filter((element) => element.type.endsWith("_error"))).toEqual([])
    }
  })

  it("renders the regulator land patterns with every logical pin connected", () => {
    const v5 = render(<P0Tps56a37Footprint />)
    expect(pcbComponent(v5, "U_V5_BUCK")).toMatchObject({ do_not_place: false })
    expect(pcbPads(v5, "U_V5_BUCK")).toHaveLength(12)
    expect(pcbPads(v5, "U_V5_BUCK")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          port_hints: expect.arrayContaining(["EN"]),
          x: -1.4,
          y: 0.75,
          width: 0.6,
          height: 0.25
        }),
        expect.objectContaining({ shape: "polygon", port_hints: expect.arrayContaining(["VIN"]) }),
        expect.objectContaining({
          port_hints: expect.arrayContaining(["PGND"]),
          x: -0.2,
          y: 1.225,
          width: 0.4,
          height: 0.95
        }),
        expect.objectContaining({
          port_hints: expect.arrayContaining(["SW"]),
          x: 0.375,
          y: -1.3,
          width: 0.25,
          height: 0.75
        })
      ])
    )

    const application = render(<P0Lmr43620Footprint />)
    expect(pcbComponent(application, "U_APP_REGULATOR")).toMatchObject({ do_not_place: false })
    expect(pcbPads(application, "U_APP_REGULATOR")).toHaveLength(9)
    expect(pcbPads(application, "U_APP_REGULATOR")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ shape: "polygon", port_hints: expect.arrayContaining(["MODE_SYNC"]) }),
        expect.objectContaining({
          port_hints: expect.arrayContaining(["PGOOD"]),
          x: -0.9,
          y: 0.25,
          width: 0.6,
          height: 0.25
        }),
        expect.objectContaining({
          port_hints: expect.arrayContaining(["APP_GND"]),
          x: 0,
          y: 0,
          width: 0.35,
          height: 1.3
        })
      ])
    )
    expect(v5.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(application.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("keeps the source orientation at pin one and does not infer unsupported courtyard data", () => {
    const diode = render(<P0B340aFootprint />)
    const diodePads = pcbPads(diode, "D_USB_PD_VBUS_DISCONNECT")
    expect(diodePads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ port_hints: expect.arrayContaining(["A", "ANODE_GND"]), x: -2, y: 0 }),
        expect.objectContaining({ port_hints: expect.arrayContaining(["K", "CATHODE_VBUS"]), x: 2, y: 0 })
      ])
    )
    expect(diode.filter((element) => element.type === "pcb_courtyard_rect")).toEqual([])

    const polymer = render(<P0T523H107Footprint />)
    expect(pcbPads(polymer, "C_USB_PD_PPHV")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ port_hints: expect.arrayContaining(["+", "PD_PPHV_20V"]), x: -3.12, y: 0 }),
        expect.objectContaining({ port_hints: expect.arrayContaining(["-", "GND"]), x: 3.12, y: 0 })
      ])
    )
    expect(polymer.filter((element) => element.type === "pcb_courtyard_rect")).toHaveLength(1)

    const ldo = render(<P0T55A106Footprint />)
    expect(pcbPads(ldo, "C_USB_PD_LDO")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -1.225, y: 0, width: 1.35, height: 1.35 }),
        expect.objectContaining({ x: 1.225, y: 0, width: 1.35, height: 1.35 })
      ])
    )
    expect(ldo.filter((element) => element.type === "pcb_courtyard_rect")).toEqual([])

    const buckInductor = render(<P0V5InductorFootprint />)
    expect(pcbPads(buckInductor, "L_V5_BUCK")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 0, y: -3.825, width: 4, height: 3.85 }),
        expect.objectContaining({ x: 0, y: 3.825, width: 4, height: 3.85 })
      ])
    )
    const appInductor = render(<P0ApplicationInductorFootprint />)
    expect(pcbPads(appInductor, "L_APP_REGULATOR")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -2.885, y: 0, width: 0.98, height: 3.4 }),
        expect.objectContaining({ x: 2.885, y: 0, width: 0.98, height: 3.4 })
      ])
    )
  })
})
