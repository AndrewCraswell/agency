import { describe, expect, it } from "vitest"
import P0SevenLineAcquisitionCircuit from "./p0-seven-line-acquisition.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

let rendered: ReturnType<typeof renderTestCircuit> | undefined
const render = () => (rendered ??= renderTestCircuit(<P0SevenLineAcquisitionCircuit />, { pcbEnabled: false }))

describe("P0-03 phased seven-conductor circuit", () => {
  it("renders without circuit errors", () => {
    expect(render().filter(({ type }) => type.includes("error"))).toEqual([])
  }, 15_000)

  it("uses three phase muxes, five protected sense buffers, and one converter/reference", () => {
    const names = render().flatMap((element) =>
      element.type === "source_component" && typeof element.name === "string" ? [element.name] : []
    )
    expect(names).toEqual(expect.arrayContaining(["U_SOURCE_MUX", "U_SINK_MUX", "U_SENSE_MUX", "U_SAR", "U_REF"]))
    expect(names.filter((name) => name.startsWith("U_SENSE_BUFFER_"))).toHaveLength(5)
    expect(names.filter((name) => name === "U_SAR")).toHaveLength(1)
    expect(names.filter((name) => name === "U_REF")).toHaveLength(1)
    expect(names.filter((name) => name.startsWith("U_PHASE_CONTROL_"))).toHaveLength(2)
    expect(names.filter((name) => /^R_(SOURCE|SINK|SENSE)_EN_PD$/u.test(name))).toHaveLength(3)
    expect(names.filter((name) => /^R_SOURCE_[1-7]$/u.test(name))).toHaveLength(7)
    expect(names.filter((name) => /^R_SINK_[1-7]$/u.test(name))).toHaveLength(7)
  })

  it("binds the protected source and sink resistors to the reviewed exact MPN", () => {
    const sourceComponents = render().filter(
      (element): element is Extract<typeof element, { type: "source_component" }> => element.type === "source_component"
    )
    const protectedResistors = sourceComponents.filter(
      ({ name }) => typeof name === "string" && /^R_(SOURCE|SINK)_[1-7]$/u.test(name)
    )
    expect(protectedResistors).toHaveLength(14)
    expect(
      protectedResistors.every(({ manufacturer_part_number }) => manufacturer_part_number === "TNPW0603470RBEEA")
    ).toBe(true)
    expect(sourceComponents.find(({ name }) => name === "C_REF_REG")).toMatchObject({
      manufacturer_part_number: "T521B106M025ATE100"
    })
    expect(sourceComponents.filter(({ name }) => typeof name === "string" && /^U_ESD_[12]$/u.test(name))).toHaveLength(
      2
    )
  })
})
