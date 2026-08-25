import { describe, expect, it } from "vitest"
import P0SevenLineAcquisitionCircuit from "./p0-seven-line-acquisition.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

let renderedCircuit: ReturnType<typeof renderTestCircuit> | undefined

function renderCircuit() {
  renderedCircuit ??= renderTestCircuit(<P0SevenLineAcquisitionCircuit />, { pcbEnabled: true })
  return renderedCircuit
}

function traceNames() {
  return renderCircuit().flatMap((element) =>
    element.type === "source_trace" && typeof element.display_name === "string" ? [element.display_name] : []
  )
}

describe("P0-03 seven-line acquisition circuit", () => {
  it("renders the PCB-enabled acquisition block without circuit errors", () => {
    expect(renderCircuit().filter((element) => element.type.includes("error"))).toEqual([])
  }, 15_000)

  it("instantiates the exact seven repeated cells, two ESD packages, and shared negative rail", () => {
    const components = renderCircuit().filter((element) => element.type === "source_component")
    const names = components.map(({ name }) => name)
    expect(names).toEqual(expect.arrayContaining(["U_NEGATIVE_RAIL", "U_ESD_1", "U_ESD_2"]))
    for (const prefix of [
      "U_REF",
      "U_OVP_BUFFER",
      "U_SAR",
      "R_ESD",
      "R_SOURCE",
      "R_SOURCE_PD",
      "R_SAR",
      "C_REF_IN",
      "C_REF_REG",
      "C_REF_REG_HF",
      "R_REF_SAR",
      "C_REF",
      "C_BUFFER_POS",
      "C_BUFFER_NEG",
      "C_SAR",
      "C_SAR_AVDD",
      "C_SAR_DVDD"
    ]) {
      expect(names.filter((name) => new RegExp(`^${prefix}_[1-7]$`, "u").test(name))).toHaveLength(7)
    }
    expect(names.filter((name) => /^U_SOURCE_SWITCH_[1-2]$/u.test(name))).toHaveLength(2)
    expect(names.filter((name) => /^C_MUX_[1-2]$/u.test(name))).toHaveLength(2)
    expect(names).toEqual(expect.arrayContaining(["U_SOURCE_CONTROL", "C_SOURCE_CONTROL", "R_SOURCE_OE_PULLUP"]))
    expect(names.filter((name) => name.startsWith("C_NEG_"))).toHaveLength(3)
  })

  it("binds GPIO4/5/6 to the shared timing nets and fixes the daisy-chain endpoints", () => {
    const traces = traceNames()
    for (let index = 1; index <= 7; index += 1) {
      expect(traces).toContain(`U_SAR_${index}.SAR_CONVST to net.SAR_CONVST`)
      expect(traces).toContain(`U_SAR_${index}.SAR_SCLK to net.SAR_SCLK`)
    }
    expect(traces).toContain("U_SAR_1.SAR_DIN to net.SCORING_SGND")
    for (let index = 1; index < 7; index += 1) {
      expect(traces).toContain(`U_SAR_${index}.SAR_DOUT to U_SAR_${index + 1}.SAR_DIN`)
    }
    expect(traces).toContain("U_SAR_7.SAR_DOUT to net.SAR_DOUT")
    expect(traces).toContain("U_SOURCE_CONTROL.SOURCE_OE_N to R_SOURCE_OE_PULLUP.pin1")
    expect(traces).toContain("U_SOURCE_CONTROL.APP_RESET_N to net.APP_RESET_N")
  })
})
