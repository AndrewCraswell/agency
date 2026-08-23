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
        "U_ESD_L",
        "U_ESD_R",
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
        "U_USB_PD",
        "U_LINE_SOURCE_A",
        "U_LINE_SOURCE_B",
        "U_LINE_SINK_A",
        "U_LINE_SINK_B",
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
    expect(traceNames).toContain("J_PISTE.PISTE to U_ESD_L.SPARE")
    expect(traceNames).toContain("U_ESD_L.SPARE to U_PISTE_FRONTEND.RAW_PISTE")
    expect(traceNames).not.toContain("J_PISTE.PISTE to U_STM32.PISTE")
    expect(traceNames).toContain("J_USB_C.SHIELD to net.ESD_RETURN")
    expect(traceNames).toEqual(
      expect.arrayContaining([
        "U_STM_WATCHDOG.RESET to U_STM32.NRST",
        "U_STM_SUPERVISOR.RESET to U_STM32.NRST",
        "U_ESP_WATCHDOG.RESET to U_ESP32.EN_RESET",
        "U_ESP_SUPERVISOR.RESET to U_ESP32.EN_RESET"
      ])
    )
  })

  it("maps the pin-safe application buses without an impossible isolator direction", () => {
    const circuitJson = renderArchitecture()
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )

    expect(traceNames).toEqual(
      expect.arrayContaining([
        "U_STM32.ESP_RESET to R_STM_RESET_ISO_SERIES.pin1",
        "R_STM_RESET_ISO_SERIES.pin2 to U_ISO_MAIN.S_ESP_RESET_ASSERT",
        "U_ISO_MAIN.A_ESP_RESET_ASSERT to TP_ESP_RESET_REQUEST.RESET_REQUEST",
        "U_ISO_MAIN.A_ESP_RESET_ASSERT to R_STM_RESET_GATE.pin1",
        "U_ESP32.ESP_HEARTBEAT to U_ISO_MAIN.A_ESP_HEARTBEAT",
        "U_ISO_MAIN.S_ESP_HEARTBEAT to U_STM32.ESP_HEARTBEAT",
        "R_USB_DN.USB_DN to U_ESP32.USB_DN",
        "R_USB_DP.USB_DP to U_ESP32.USB_DP",
        "U_ESP32.APP_SPI_SCK to U_ETHERNET.SCK",
        "U_ESP32.APP_SPI_SCK to U_FRAM.SCK",
        "U_ESP_SUPERVISOR.RESET to U_ETHERNET.RSTn",
        "U_ESP32.HUB75_R1 to U_DISPLAY_BUFFER_A.R1_IN",
        "U_DISPLAY_BUFFER_B.OE_N_OUT to J_HUB75.OE"
      ])
    )
    expect(traceNames.some((name) => name.includes("SCORE_EVENT_IRQ"))).toBe(false)
    expect(traceNames.some((name) => name.includes("U_ESP32.STM_RESET"))).toBe(false)
    expect(traceNames.some((name) => name.includes("U_ISO_MAIN.A_ESP_RESET_ASSERT to U_ESP32.EN_RESET"))).toBe(false)
  })

  it("implements hardware reset combining and reset-gated display defaults", () => {
    const circuitJson = renderArchitecture()
    const sourceNames = circuitJson.flatMap((element) =>
      element.type === "source_component" && "name" in element && typeof element.name === "string" ? [element.name] : []
    )
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )

    expect(sourceNames).toEqual(
      expect.arrayContaining([
        "Q_ESP_RESET_STM",
        "Q_ESP_DEBUG_RESET",
        "Q_DISPLAY_BUFFER_A_ENABLE",
        "Q_DISPLAY_BUFFER_B_ENABLE",
        "R_ESP_EN_PULLUP",
        "C_ESP_EN_DELAY",
        "R_DEBUG_RESET_GATE",
        "R_DEBUG_RESET_GATE_PD",
        "R_HUB75_OE_PULLUP",
        "R_HUB75_PANEL_OE_PULLUP",
        "R_HUB75_R1_PD",
        "R_HUB75_CLK_PD"
      ])
    )
    expect(traceNames).toEqual(
      expect.arrayContaining([
        "Q_ESP_RESET_STM.D to U_ESP32.EN_RESET",
        "Q_ESP_RESET_STM.S to net.GND",
        "U_ESP32.EN_RESET to U_ESP_SUPERVISOR.RESET",
        "U_ESP_WATCHDOG.RESET to U_ESP32.EN_RESET",
        "J_ESP_DEBUG.MANUAL_RESET_ASSERT to R_DEBUG_RESET_GATE.pin1",
        "R_DEBUG_RESET_GATE.pin2 to Q_ESP_DEBUG_RESET.G",
        "Q_ESP_DEBUG_RESET.G to R_DEBUG_RESET_GATE_PD.pin1",
        "R_DEBUG_RESET_GATE_PD.pin2 to net.GND",
        "Q_ESP_DEBUG_RESET.D to U_ESP32.EN_RESET",
        "Q_ESP_DEBUG_RESET.S to net.GND",
        "R_BUFFER_A_ENABLE_PULLUP.pin2 to net.V5",
        "R_BUFFER_B_ENABLE_PULLUP.pin2 to net.V5",
        "R_HUB75_OE_PULLUP.pin2 to net.V3_3",
        "R_HUB75_PANEL_OE_PULLUP.pin2 to net.V5",
        "R_HUB75_R1_PD.pin2 to net.GND",
        "R_HUB75_CLK_PD.pin2 to net.GND"
      ])
    )
    expect(traceNames).not.toContain("J_ESP_DEBUG.EN_RESET to U_ESP32.EN_RESET")
    expect(traceNames).not.toContain("U_DISPLAY_BUFFER_A.BUFFER_ENABLE_N to net.GND")
    expect(traceNames).not.toContain("U_DISPLAY_BUFFER_B.BUFFER_ENABLE_N to net.GND")

    const sourceComponents = circuitJson.filter((element) => element.type === "source_component")
    const sourceByName = (name: string) => sourceComponents.find((element) => element.name === name)
    const serialized = JSON.stringify(circuitJson)
    expect(serialized).toContain("MANUAL_RESET_ASSERT")
    expect(serialized).not.toContain("MANUAL_RESET_N")
    expect(sourceByName("Q_ESP_RESET_STM")).toMatchObject({ manufacturer_part_number: "BSS138AKA" })
    expect(sourceByName("Q_ESP_DEBUG_RESET")).toMatchObject({ manufacturer_part_number: "BSS138AKA" })
    expect(sourceByName("Q_DISPLAY_BUFFER_A_ENABLE")).toMatchObject({ manufacturer_part_number: "BSS138AKA" })
    expect(sourceByName("Q_DISPLAY_BUFFER_B_ENABLE")).toMatchObject({ manufacturer_part_number: "BSS138AKA" })
    expect(sourceByName("U_ESP_SUPERVISOR")).toMatchObject({ manufacturer_part_number: "TPS389033DSER" })
    expect(sourceByName("U_ESP_WATCHDOG")).toMatchObject({ manufacturer_part_number: "TPS3431SDRBR" })
    expect(sourceByName("R_STM_RESET_GATE")).toMatchObject({ resistance: 10000 })
    expect(sourceByName("R_STM_RESET_GATE_PD")).toMatchObject({ resistance: 100000 })
    expect(sourceByName("R_DEBUG_RESET_GATE")).toMatchObject({ resistance: 10000 })
    expect(sourceByName("R_DEBUG_RESET_GATE_PD")).toMatchObject({ resistance: 100000 })
    expect(sourceByName("R_ESP_EN_PULLUP")).toMatchObject({ resistance: 10000 })
    expect(sourceByName("C_ESP_EN_DELAY")).toMatchObject({ capacitance: 1e-6 })
    expect(sourceByName("C_ESP_SUPERVISOR_CT")).toMatchObject({ capacitance: 1e-7 })
    expect(componentDecisions.find((component) => component.mpn === "TPS389033DSER")?.qualification).toContain(
      "3.170 V falling and 3.189 V rising"
    )
    expect(componentDecisions.find((component) => component.mpn === "TPS389033DSER")?.qualification).toContain(
      "approximately 107 ms nominal delay"
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

  it("selects repeated low-leakage line switching and connector-adjacent protection", () => {
    expect(componentDecisions.find((component) => component.category === "line-switch")?.mpn).toBe("TMUX1112PWR")
    expect(componentDecisions.find((component) => component.category === "line-protection")?.mpn).toBe("TPD4E05U06DQAR")
  })

  it("implements USB-C as the protected sole USB-PD power input while preserving USB2 UFP data", () => {
    const circuitJson = renderArchitecture()
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )
    const serialized = JSON.stringify(circuitJson)
    const sourceComponents = circuitJson.filter((element) => element.type === "source_component")
    const sourceByName = (name: string) => sourceComponents.find((element) => element.name === name)

    expect(traceNames).toEqual(
      expect.arrayContaining([
        "J_USB_C.CC1_PORT to U_USB_PORT_PROTECT.CC1_PORT",
        "J_USB_C.CC2_PORT to U_USB_PORT_PROTECT.CC2_PORT",
        "U_USB_PORT_PROTECT.RPD_G1 to U_USB_PORT_PROTECT.CC1_PORT",
        "U_USB_PORT_PROTECT.RPD_G2 to U_USB_PORT_PROTECT.CC2_PORT",
        "J_USB_C.VBUS_PORT to U_USB_PD.VBUS_PORT",
        "U_USB_PD.PD_PPHV_20V to U_EFUSE.VIN",
        "U_USB_PORT_PROTECT.VBIAS to C_USB_PORT_PROTECT_BIAS.VBIAS",
        "U_USB_PORT_PROTECT.CC1 to U_USB_PD.CC1_PROTECTED",
        "U_USB_PORT_PROTECT.CC2 to U_USB_PD.CC2_PROTECTED",
        "U_USB_PORT_PROTECT.FLT_N to U_USB_PD.FAULT_IN_N",
        "U_USB_PORT_PROTECT.FLT_N to R_USB_PORT_PROTECT_FLT_PULLUP.pin1",
        "D_USB_PD_VBUS_DISCONNECT.CATHODE_VBUS to J_USB_C.VBUS_PORT",
        "D_USB_PD_VBUS_DISCONNECT.ANODE_GND to net.GND",
        "U_USB_PD.PD_PPHV_20V to C_USB_PD_PPHV.PD_PPHV_20V",
        "U_EFUSE.VOUT to U_BUCK_BOOST.VIN",
        "U_BUCK_BOOST.VOUT to net.V5",
        "J_USB_C.SHIELD to net.ESD_RETURN"
      ])
    )
    expect(serialized).toContain("TPS25730ADREFR")
    expect(serialized).toContain("TPD4S201TRGRRQ1")
    expect(serialized).toContain("TVS2200DRVR")
    expect(serialized).toContain("TPS259474ARPWR")
    expect(serialized).toContain("B340A-13-F")
    expect(serialized).toContain("100NF_10PCT_50V_X7R_0402")
    expect(serialized).not.toContain("J_POWER_24V")
    expect(serialized).not.toContain("NC4MD-LX")
    expect(serialized).not.toContain("TPS26631PWPT")
    expect(sourceByName("C_USB_PD_LDO")).toMatchObject({ manufacturer_part_number: "T55A106M010C0200" })
    expect(sourceByName("C_USB_PD_LDO_1V5")).toMatchObject({ manufacturer_part_number: "GRM21BR71A106KA73K" })
    expect(sourceByName("C_USB_PD_PPHV")).toMatchObject({ manufacturer_part_number: "T523H107M035APE070" })
    expect(sourceByName("R_USB_PD_ADCIN1_UP")).toMatchObject({ resistance: 24900 })
    expect(sourceByName("R_USB_PD_ADCIN1_DOWN")).toMatchObject({ resistance: 10000 })
    expect(sourceByName("R_USB_PD_ADCIN2_UP")).toMatchObject({ resistance: 10000 })
    expect(sourceByName("R_USB_PD_ADCIN2_DOWN")).toMatchObject({ resistance: 68100 })
    expect(sourceByName("R_USB_PD_ADCIN3_UP")).toMatchObject({ resistance: 162000 })
    expect(sourceByName("R_USB_PD_ADCIN3_DOWN")).toMatchObject({ resistance: 38000 })
    expect(sourceByName("R_USB_PD_ADCIN4_UP")).toMatchObject({ resistance: 191000 })
    expect(sourceByName("R_USB_PD_ADCIN4_DOWN")).toMatchObject({ resistance: 9500 })
    expect(sourceByName("U_EFUSE")).toMatchObject({ manufacturer_part_number: "TPS259474ARPWR" })
    expect(sourceByName("R_EFUSE_UVLO_UP")).toMatchObject({ resistance: 475000 })
    expect(sourceByName("R_EFUSE_OVLO_UP")).toMatchObject({ resistance: 499000 })
    expect(sourceByName("R_EFUSE_ILM")).toMatchObject({ resistance: 1240 })
    expect(sourceByName("C_EFUSE_ITIMER")).toMatchObject({ manufacturer_part_number: "2N2_5PCT_50V_C0G_0402" })
    expect(sourceByName("C_EFUSE_DVDT")).toMatchObject({ manufacturer_part_number: "2N2_5PCT_50V_C0G_0402" })
    expect(sourceByName("R_EFUSE_PGTH_UP")).toMatchObject({ resistance: 698000 })
    expect(sourceByName("R_EFUSE_PGTH_DOWN")).toMatchObject({ resistance: 49900 })
    const resistanceTolerance = 0.01
    const currentLimitMaximum = (3334 / (1240 * (1 - resistanceTolerance))) * 1.1
    const pgThresholdNominal = 1.2 * ((698000 + 49900) / 49900)
    const pgThresholdMinimum =
      1.2 *
      ((698000 * (1 - resistanceTolerance) + 49900 * (1 + resistanceTolerance)) / (49900 * (1 + resistanceTolerance)))
    const pgThresholdMaximum =
      1.2 *
      ((698000 * (1 + resistanceTolerance) + 49900 * (1 - resistanceTolerance)) / (49900 * (1 - resistanceTolerance)))
    const pgDividerCurrentAt20V = 20 / (698000 + 49900)
    expect(currentLimitMaximum).toBeCloseTo(2.99, 2)
    expect(currentLimitMaximum).toBeLessThan(3)
    expect(pgThresholdNominal).toBeCloseTo(17.99, 2)
    expect(pgThresholdMinimum).toBeGreaterThan(17.6)
    expect(pgThresholdMaximum).toBeLessThan(18.4)
    expect(pgDividerCurrentAt20V).toBeGreaterThan(20e-6)
    expect(sourceByName("C_EFUSE_OUT")).toMatchObject({ manufacturer_part_number: "T523H107M035APE070" })
    expect(traceNames).toEqual(
      expect.arrayContaining([
        "U_EFUSE.EN_UVLO to R_EFUSE_UVLO_DOWN.pin1",
        "U_EFUSE.OVLO to R_EFUSE_OVLO_DOWN.pin1",
        "U_EFUSE.ILM to R_EFUSE_ILM.pin1",
        "U_EFUSE.ITIMER to C_EFUSE_ITIMER.ITIMER",
        "U_EFUSE.DVDT to C_EFUSE_DVDT.DVDT",
        "U_EFUSE.PG to R_EFUSE_PG_PULLUP.pin1",
        "D_USB_PD_VBUS_DISCONNECT.ANODE_GND to net.GND",
        "D_USB_PD_VBUS_DISCONNECT.CATHODE_VBUS to J_USB_C.VBUS_PORT"
      ])
    )
    expect(traceNames.some((name) => /RPD_G[12].*net\.GND/.test(name))).toBe(false)
    expect(serialized).toContain("ANODE_GND")
    expect(serialized).toContain("CATHODE_VBUS")
    expect(traceNames.some((name) => name.includes("VBUS_PORT") && name.includes("net.V5"))).toBe(false)
    expect(componentDecisions.find((component) => component.category === "usb-pd-controller")?.mpn).toBe(
      "TPS25730ADREFR"
    )
  })

  it("uses the active TAS2505-Q1 orderable in the circuit model", () => {
    const audio = componentDecisions.find((component) => component.category === "audio-amplifier")
    const circuitJson = renderArchitecture()
    const sourceComponents = circuitJson.filter(
      (element) => element.type === "source_component" && "name" in element && element.name === "U_AUDIO"
    )

    expect(audio?.mpn).toBe("TAS2505TRGERQ1")
    expect(sourceComponents).toHaveLength(1)
    expect(sourceComponents[0]).toMatchObject({ manufacturer_part_number: "TAS2505TRGERQ1" })
  })
})
