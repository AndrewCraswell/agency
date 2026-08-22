import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import { componentDecisions, componentEvidenceAsOf, forbiddenLifecycleStates } from "./component-decisions.js"
import ScoringCircuit from "./index.circuit.js"

function renderArchitecture() {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.pcbRoutingDisabled = true
  circuit.schematicDisabled = true
  circuit.setPlatform({ partsEngineDisabled: true })
  circuit.add(<ScoringCircuit />)
  circuit.render()

  return circuit.getCircuitJson()
}

describe("production scoring architecture", () => {
  it("contains the independent scoring and application domains", () => {
    const circuitJson = renderArchitecture()
    const sourceNames = circuitJson.flatMap((element) =>
      "name" in element && typeof element.name === "string" ? [element.name] : []
    )

    expect(circuitJson.filter((element) => element.type === "source_trace").length).toBeGreaterThan(40)
    expect(sourceNames).toEqual(
      expect.arrayContaining([
        "J_L",
        "J_R",
        "J_PISTE",
        "U_STM32",
        "U_STM_WATCHDOG",
        "U_STM_SUPERVISOR",
        "U_ISO_MAIN",
        "U_ISO_AUX",
        "U_ESP32",
        "U_ESP_WATCHDOG",
        "U_ESP_SUPERVISOR",
        "U_ETHERNET",
        "J_ETHERNET_MAGJACK",
        "U_FIELD_SERIAL",
        "J_HUB75",
        "U_FRAM",
        "U_RTC",
        "U_SECURE_ELEMENT",
        "U_PD_SINK",
        "U_EFUSE",
        "U_BUCK_BOOST"
      ])
    )
  })

  it("uses separate scoring and application ground nets", () => {
    const circuitJson = renderArchitecture()
    const serialized = JSON.stringify(circuitJson)
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )

    expect(serialized).toContain("SGND")
    expect(serialized).toContain('"GND"')
    expect(serialized).not.toContain("J_STM32")
    expect(serialized).not.toContain("J_ESP32")
    expect(traceNames.some((name) => name.includes("U_STM32") && name.includes("U_ESP32"))).toBe(false)
    expect(traceNames).toContain("J_PISTE.PISTE to U_PISTE_FRONTEND.RAW_PISTE")
    expect(traceNames).not.toContain("J_PISTE.PISTE to U_STM32.PISTE")
    expect(traceNames).toEqual(
      expect.arrayContaining([
        "U_STM_WATCHDOG.RESET to U_STM32.NRST",
        "U_STM_SUPERVISOR.RESET to U_STM32.NRST",
        "U_ESP_WATCHDOG.RESET to U_ESP32.EN_RESET",
        "U_ESP_SUPERVISOR.RESET to U_ESP32.EN_RESET"
      ])
    )
  })

  it("pins every approved component to an active lifecycle", () => {
    const decisions = componentDecisions.map((component) => `${component.manufacturer}:${component.mpn}`)
    const lifecycles = componentDecisions.map((component) => component.lifecycle as string)

    expect(new Set(decisions).size).toBe(decisions.length)
    expect(lifecycles).not.toEqual(expect.arrayContaining([...forbiddenLifecycleStates]))
    expect(componentDecisions.every((component) => component.manufacturerUrl.startsWith("https://"))).toBe(true)
    expect(componentEvidenceAsOf).toBe("2026-08-22")
  })

  it("selects the industrial-temperature ESP32 module and 125 C scoring MCU", () => {
    const applicationController = componentDecisions.find(
      (component) => component.category === "application-controller"
    )
    const scoringController = componentDecisions.find((component) => component.category === "scoring-controller")

    expect(applicationController?.mpn).toBe("ESP32-S3-WROOM-1U-N16R2")
    expect(applicationController?.qualification).toContain("-40 C to 85 C")
    expect(scoringController?.mpn).toBe("STM32G474RET3TR")
    expect(scoringController?.qualification).toContain("-40 C to 125 C")
  })
})
