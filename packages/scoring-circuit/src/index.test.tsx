import { describe, expect, it } from "vitest"
import { componentDecisions, componentEvidenceAsOf, forbiddenLifecycleStates } from "./component-decisions.js"
import ScoringCircuit from "./index.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

let architectureJson: ReturnType<typeof renderTestCircuit> | undefined
let pcbPlacementJson: ReturnType<typeof renderTestCircuit> | undefined

function renderArchitecture() {
  if (architectureJson !== undefined) return architectureJson
  architectureJson = renderTestCircuit(<ScoringCircuit />, { pcbEnabled: false })
  return architectureJson
}

function renderPcbPlacements() {
  if (pcbPlacementJson !== undefined) return pcbPlacementJson
  pcbPlacementJson = renderTestCircuit(<ScoringCircuit />)
  return pcbPlacementJson
}

function sourceComponentNames(circuitJson: ReturnType<typeof renderTestCircuit>): string[] {
  return circuitJson.flatMap((element) =>
    element.type === "source_component" && typeof element.name === "string" ? [element.name] : []
  )
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
        "J_CTRL_CARRIER",
        "U_FIELD_SERIAL",
        "J_HUB75",
        "U_FRAM",
        "U_RTC",
        "U_SECURE_ELEMENT",
        "J_PWR_CARRIER",
        "J_USB2_CARRIER",
        "U_LINE_SOURCE_A",
        "U_LINE_SOURCE_B",
        "U_LINE_SINK_A",
        "U_LINE_SINK_B",
        "U_V5_BUCK",
        "U_APP_REGULATOR"
      ])
    )
  })

  it("keeps the isolated processor boundary ordered and electrically identified", () => {
    const circuitJson = renderArchitecture()
    const sourceNames = sourceComponentNames(circuitJson)
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )
    const isolationComponentStart = sourceNames.indexOf("U_ISO_MAIN")
    const isolationTraceStart = traceNames.indexOf("U_STM32.SPI_SCK to U_ISO_MAIN.S_SCK")

    expect(sourceNames.slice(isolationComponentStart, isolationComponentStart + 2)).toEqual(["U_ISO_MAIN", "U_ISO_AUX"])
    expect(traceNames.slice(isolationTraceStart, isolationTraceStart + 21)).toEqual([
      "U_STM32.SPI_SCK to U_ISO_MAIN.S_SCK",
      "U_STM32.SPI_MOSI to U_ISO_MAIN.S_MOSI",
      "U_STM32.SPI_CS to U_ISO_MAIN.S_CS",
      "U_STM32.SPI_MISO to U_ISO_MAIN.S_MISO",
      "U_STM32.ESP_RESET to R_STM_RESET_ISO_SERIES.pin1",
      "R_STM_RESET_ISO_SERIES.pin2 to U_ISO_MAIN.S_ESP_RESET_ASSERT",
      "U_ISO_MAIN.S_ESP_RESET_ASSERT to R_STM_RESET_ISO_PD.pin1",
      "R_STM_RESET_ISO_PD.pin2 to net.SGND",
      "U_STM32.HEARTBEAT to U_ISO_AUX.S_HEARTBEAT",
      "U_ISO_MAIN.A_SCK to U_ESP32.SCORE_SCK",
      "U_ISO_MAIN.A_MOSI to U_ESP32.SCORE_MOSI",
      "U_ISO_MAIN.A_CS to U_ESP32.SCORE_CS",
      "U_ISO_MAIN.A_MISO to U_ESP32.SCORE_MISO",
      "U_ISO_MAIN.A_ESP_RESET_ASSERT to TP_ESP_RESET_REQUEST.RESET_REQUEST",
      "U_ISO_MAIN.A_ESP_RESET_ASSERT to R_STM_RESET_GATE.pin1",
      "R_STM_RESET_GATE.pin2 to Q_ESP_RESET_STM.G",
      "Q_ESP_RESET_STM.G to R_STM_RESET_GATE_PD.pin1",
      "R_STM_RESET_GATE_PD.pin2 to net.GND",
      "U_ISO_AUX.A_HEARTBEAT to U_ESP32.STM_HEARTBEAT",
      "U_ESP32.ESP_HEARTBEAT to U_ISO_MAIN.A_ESP_HEARTBEAT",
      "U_ISO_MAIN.S_ESP_HEARTBEAT to U_STM32.ESP_HEARTBEAT"
    ])
  })

  it("keeps the extracted scoring-domain composition and logical board envelope stable", () => {
    const circuitJson = renderArchitecture()
    const scoringDomainReferences = [
      "J_L",
      "J_R",
      "U_ESD_L",
      "U_ESD_R",
      "U_FRONTEND_L",
      "U_FRONTEND_R",
      "J_PISTE",
      "U_PISTE_FRONTEND",
      "U_STM32",
      "U_VREF",
      "U_STM_WATCHDOG",
      "U_STM_SUPERVISOR",
      "R_STM_WD_CWD",
      "C_STM_WD_BYPASS",
      "C_STM_SUPERVISOR_CT",
      "C_STM_SUPERVISOR_BYPASS",
      "U_ISOLATED_POWER",
      "U_SCORING_LDO",
      "U_LINE_SOURCE_A",
      "U_LINE_SOURCE_B",
      "U_LINE_SINK_A",
      "U_LINE_SINK_B"
    ]
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )

    expect(
      sourceComponentNames(circuitJson)
        .filter((name) => scoringDomainReferences.includes(name))
        .sort()
    ).toEqual(scoringDomainReferences.sort())
    expect(traceNames).toEqual(
      expect.arrayContaining([
        "U_FRONTEND_L.SENSE_A to U_STM32.LEFT_A",
        "U_FRONTEND_L.SENSE_B to U_STM32.LEFT_B",
        "U_FRONTEND_L.SENSE_C to U_STM32.LEFT_C",
        "U_FRONTEND_R.SENSE_A to U_STM32.RIGHT_A",
        "U_FRONTEND_R.SENSE_B to U_STM32.RIGHT_B",
        "U_FRONTEND_R.SENSE_C to U_STM32.RIGHT_C",
        "U_VREF.VOUT to U_STM32.VREF",
        "U_STM32.WD_KICK to U_STM_WATCHDOG.WDI",
        "U_STM_WATCHDOG.RESET to U_STM32.NRST",
        "U_STM_SUPERVISOR.RESET to U_STM32.NRST",
        "U_ISOLATED_POWER.S5 to U_SCORING_LDO.S5",
        "U_SCORING_LDO.S3_3 to net.S3_3"
      ])
    )
    expect(renderPcbPlacements().find((element) => element.type === "pcb_board")).toMatchObject({
      width: 160,
      height: 100,
      num_layers: 4
    })
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
    expect(traceNames).toContain("U_PISTE_FRONTEND.SENSE_PISTE to U_STM32.PISTE")
    expect(traceNames).not.toContain("J_PISTE.PISTE to U_STM32.PISTE")
    expect(traceNames).toContain("J_USB2_CARRIER.SHIELD to net.CHASSIS")
    expect(traceNames.some((name) => name.includes("CHASSIS") && name.includes("net.GND"))).toBe(false)
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
        "R_USB_DN_CARRIER.USB_DN to U_ESP32.USB_DN",
        "R_USB_DP_CARRIER.USB_DP to U_ESP32.USB_DP",
        "U_ESP32.APP_SPI_SCK to R_COMM_SCK_SERIES.pin1",
        "R_COMM_SCK_SERIES.pin2 to J_CTRL_CARRIER.W5500_SCK",
        "U_ESP32.APP_SPI_SCK to U_FRAM.SCK",
        "U_ESP32.HUB75_R1 to U_DISPLAY_BUFFER_A.R1_IN",
        "U_DISPLAY_BUFFER_B.OE_N_OUT to J_HUB75.OE"
      ])
    )
    expect(traceNames.some((name) => name.includes("SCORE_EVENT_IRQ"))).toBe(false)
    expect(traceNames.some((name) => name.includes("U_ESP32.STM_RESET"))).toBe(false)
    expect(traceNames.some((name) => name.includes("U_ISO_MAIN.A_ESP_RESET_ASSERT to U_ESP32.EN_RESET"))).toBe(false)
    expect(traceNames.some((name) => name.includes("U_ETHERNET"))).toBe(false)
  })

  it("contains the fail-closed, polling-only communications-carrier boundary", () => {
    const circuitJson = renderArchitecture()
    const sourceNames = circuitJson.flatMap((element) =>
      element.type === "source_component" && "name" in element && typeof element.name === "string" ? [element.name] : []
    )
    const sourceComponents = circuitJson.filter((element) => element.type === "source_component")
    const sourceByName = (name: string) => sourceComponents.find((element) => element.name === name)
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )

    expect(sourceNames).toEqual(
      expect.arrayContaining([
        "R_COMM_SCK_SERIES",
        "R_COMM_MOSI_SERIES",
        "R_COMM_CS_SERIES",
        "R_COMM_SCK_DEFAULT_LOW",
        "R_COMM_MOSI_DEFAULT_LOW",
        "R_COMM_CS_N_DEFAULT_HIGH",
        "R_COMM_MISO_DEFAULT_LOW",
        "R_COMM_RESET_ASSERT_DEFAULT_LOW",
        "R_COMM_PRESENT_N_ABSENT_PULLUP",
        "R_COMM_INT_N_IDLE_PULLUP",
        "TP_COMM_PRESENT_N",
        "TP_COMM_INT_N"
      ])
    )
    expect(traceNames).toEqual(
      expect.arrayContaining([
        "U_ESP32.APP_SPI_SCK to R_COMM_SCK_SERIES.pin1",
        "R_COMM_SCK_SERIES.pin2 to J_CTRL_CARRIER.W5500_SCK",
        "J_CTRL_CARRIER.W5500_SCK to R_COMM_SCK_DEFAULT_LOW.pin1",
        "R_COMM_SCK_DEFAULT_LOW.pin2 to net.GND",
        "U_ESP32.APP_SPI_MOSI to R_COMM_MOSI_SERIES.pin1",
        "R_COMM_MOSI_SERIES.pin2 to J_CTRL_CARRIER.W5500_MOSI",
        "J_CTRL_CARRIER.W5500_MOSI to R_COMM_MOSI_DEFAULT_LOW.pin1",
        "R_COMM_MOSI_DEFAULT_LOW.pin2 to net.GND",
        "U_ESP32.APP_SPI_MISO to J_CTRL_CARRIER.W5500_MISO",
        "J_CTRL_CARRIER.W5500_MISO to R_COMM_MISO_DEFAULT_LOW.pin1",
        "R_COMM_MISO_DEFAULT_LOW.pin2 to net.GND",
        "U_ESP32.ETH_CS to R_COMM_CS_SERIES.pin1",
        "R_COMM_CS_SERIES.pin2 to J_CTRL_CARRIER.W5500_CS_N",
        "J_CTRL_CARRIER.W5500_CS_N to R_COMM_CS_N_DEFAULT_HIGH.pin1",
        "R_COMM_CS_N_DEFAULT_HIGH.pin2 to net.V3_3",
        "U_ESP32.APP_SPI_SCK to U_FRAM.SCK",
        "J_CTRL_CARRIER.GND_1 to net.GND",
        "J_CTRL_CARRIER.GND_2 to net.GND",
        "J_CTRL_CARRIER.GND_3 to net.GND",
        "J_CTRL_CARRIER.GND_4 to net.GND",
        "J_CTRL_CARRIER.GND_5 to net.GND",
        "J_CTRL_CARRIER.COMM_RESET_ASSERT to R_COMM_RESET_ASSERT_DEFAULT_LOW.pin1",
        "R_COMM_RESET_ASSERT_DEFAULT_LOW.pin2 to net.GND",
        "J_CTRL_CARRIER.COMM_PRESENT_N to R_COMM_PRESENT_N_ABSENT_PULLUP.pin1",
        "R_COMM_PRESENT_N_ABSENT_PULLUP.pin2 to net.V3_3",
        "J_CTRL_CARRIER.W5500_INT_N to R_COMM_INT_N_IDLE_PULLUP.pin1",
        "R_COMM_INT_N_IDLE_PULLUP.pin2 to net.V3_3"
      ])
    )
    expect(traceNames.some((name) => name.includes("COMM_PRESENT_N") && name.includes("U_ESP32"))).toBe(false)
    expect(traceNames.some((name) => name.includes("W5500_INT_N") && name.includes("U_ESP32"))).toBe(false)
    expect(traceNames.some((name) => name.includes("COMM_RESET_ASSERT") && name.includes("U_ESP32"))).toBe(false)
    for (const reference of ["R_COMM_SCK_SERIES", "R_COMM_MOSI_SERIES", "R_COMM_CS_SERIES"]) {
      expect(sourceByName(reference)).toMatchObject({ resistance: 33 })
    }
    for (const reference of [
      "R_COMM_RESET_ASSERT_DEFAULT_LOW",
      "R_COMM_PRESENT_N_ABSENT_PULLUP",
      "R_COMM_INT_N_IDLE_PULLUP",
      "R_COMM_SCK_DEFAULT_LOW",
      "R_COMM_MOSI_DEFAULT_LOW",
      "R_COMM_CS_N_DEFAULT_HIGH",
      "R_COMM_MISO_DEFAULT_LOW"
    ]) {
      expect(sourceByName(reference)).toMatchObject({ resistance: 100000 })
    }
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
    expect(sourceByName("R_ESP_EN_PULLUP")).toMatchObject({
      manufacturer_part_number: "RC0603FR-0710KL",
      resistance: 10000
    })
    expect(sourceByName("C_ESP_EN_DELAY")).toMatchObject({ capacitance: 1e-6 })
    expect(sourceByName("C_ESP_SUPERVISOR_CT")).toMatchObject({
      capacitance: 1e-7,
      manufacturer_part_number: "C0603C104K3RACTU"
    })
    expect(sourceByName("C_ESP_SUPERVISOR_BYPASS")).toMatchObject({
      manufacturer_part_number: "C0603C104K3RACTU"
    })
    expect(sourceByName("C_STM_SUPERVISOR_CT")).toMatchObject({
      manufacturer_part_number: "C0603C104K3RACTU"
    })
    expect(sourceByName("C_STM_SUPERVISOR_BYPASS")).toMatchObject({
      manufacturer_part_number: "C0603C104K3RACTU"
    })
    expect(componentDecisions.find((component) => component.mpn === "TPS389033DSER")?.qualification).toContain(
      "3.170 V falling and 3.189 V rising"
    )
    expect(componentDecisions.find((component) => component.mpn === "TPS389033DSER")?.qualification).toContain(
      "53.04 ms calculated minimum"
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

  it("uses only the approved post-eFuse and USB2 carrier endpoints", () => {
    const circuitJson = renderArchitecture()
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )
    const sourceNames = circuitJson.flatMap((element) =>
      element.type === "source_component" && typeof element.name === "string" ? [element.name] : []
    )

    expect(traceNames).toEqual(
      expect.arrayContaining([
        "J_USB2_CARRIER.USB_DN to R_USB_DN_CARRIER.USB_DN_FROM_COMM",
        "J_USB2_CARRIER.USB_DP to R_USB_DP_CARRIER.USB_DP_FROM_COMM",
        "R_USB_DN_CARRIER.USB_DN to U_ESP32.USB_DN",
        "R_USB_DP_CARRIER.USB_DP to U_ESP32.USB_DP",
        "J_PWR_CARRIER.V20_EFUSE_OUT_A to U_V5_BUCK.VIN",
        "J_PWR_CARRIER.V20_EFUSE_OUT_B to U_V5_BUCK.VIN",
        "J_PWR_CARRIER.GND_A to net.GND",
        "J_PWR_CARRIER.GND_B to net.GND",
        "J_USB2_CARRIER.SHIELD to net.CHASSIS"
      ])
    )
    for (const legacyReference of ["J_USB_C", "U_USB_PORT_PROTECT", "U_USB_PD", "U_EFUSE"]) {
      expect(sourceNames).not.toContain(legacyReference)
    }
    expect(traceNames.some((name) => name.includes("CHASSIS") && name.includes("net.GND"))).toBe(false)
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

  it("keeps the extracted service-support components and buses intact", () => {
    const circuitJson = renderArchitecture()
    const sourceNames = sourceComponentNames(circuitJson)
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )

    const serviceComponentStart = sourceNames.indexOf("U_FIELD_SERIAL")
    expect(sourceNames.slice(serviceComponentStart, serviceComponentStart + 5)).toEqual([
      "U_FIELD_SERIAL",
      "J_FIELD_SERIAL",
      "U_FRAM",
      "U_RTC",
      "U_SECURE_ELEMENT"
    ])
    expect(traceNames).toEqual(
      expect.arrayContaining([
        "U_ESP32.I2C_SDA to U_RTC.SDA",
        "U_ESP32.I2C_SCL to U_RTC.SCL",
        "U_ESP32.I2C_SDA to U_SECURE_ELEMENT.SDA",
        "U_ESP32.I2C_SCL to U_SECURE_ELEMENT.SCL",
        "U_ESP32.APP_SPI_SCK to U_FRAM.SCK",
        "U_ESP32.APP_SPI_MOSI to U_FRAM.MOSI",
        "U_ESP32.APP_SPI_MISO to U_FRAM.MISO",
        "U_ESP32.FRAM_CS to U_FRAM.CS"
      ])
    )
  })

  it("keeps the extracted display path ordered from ESP32 through the panel", () => {
    const circuitJson = renderArchitecture()
    const sourceNames = sourceComponentNames(circuitJson)
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )

    const displayComponentStart = sourceNames.indexOf("U_DISPLAY_BUFFER_A")
    expect(sourceNames.slice(displayComponentStart, displayComponentStart + 17)).toEqual([
      "U_DISPLAY_BUFFER_A",
      "U_DISPLAY_BUFFER_B",
      "R_HUB75_R1_PD",
      "R_HUB75_G1_PD",
      "R_HUB75_B1_PD",
      "R_HUB75_R2_PD",
      "R_HUB75_G2_PD",
      "R_HUB75_B2_PD",
      "R_HUB75_A_PD",
      "R_HUB75_B_PD",
      "R_HUB75_C_PD",
      "R_HUB75_D_PD",
      "R_HUB75_CLK_PD",
      "R_HUB75_LAT_PD",
      "R_HUB75_OE_PULLUP",
      "R_HUB75_PANEL_OE_PULLUP",
      "J_HUB75"
    ])

    const displayTraceStart = traceNames.indexOf("U_ESP32.HUB75_R1 to U_DISPLAY_BUFFER_A.R1_IN")
    const displayChannels = ["R1", "G1", "B1", "R2", "G2", "B2", "A", "B"]
    const expectedDisplayTraces = [
      ...displayChannels.map((channel) => `U_ESP32.HUB75_${channel} to U_DISPLAY_BUFFER_A.${channel}_IN`),
      ...["C", "D", "CLK", "LAT", "OE"].map(
        (channel) =>
          `U_ESP32.HUB75_${channel === "OE" ? "OE_N" : channel} to U_DISPLAY_BUFFER_B.${channel === "OE" ? "OE_N" : channel}_IN`
      ),
      ...displayChannels.map((channel) => `U_DISPLAY_BUFFER_A.${channel}_OUT to J_HUB75.${channel}`),
      ...["C", "D", "CLK", "LAT", "OE"].map(
        (channel) => `U_DISPLAY_BUFFER_B.${channel === "OE" ? "OE_N" : channel}_OUT to J_HUB75.${channel}`
      ),
      ...displayChannels.map((channel) => `U_DISPLAY_BUFFER_A.${channel}_IN to R_HUB75_${channel}_PD.pin1`),
      ...["C", "D", "CLK", "LAT"].map((channel) => `U_DISPLAY_BUFFER_B.${channel}_IN to R_HUB75_${channel}_PD.pin1`),
      ...["R1", "G1", "B1", "R2", "G2", "B2", "A", "B", "C", "D", "CLK", "LAT"].map(
        (channel) => `R_HUB75_${channel}_PD.pin2 to net.GND`
      ),
      "U_DISPLAY_BUFFER_B.OE_N_IN to R_HUB75_OE_PULLUP.pin1",
      "R_HUB75_OE_PULLUP.pin2 to net.V3_3",
      "U_DISPLAY_BUFFER_B.OE_N_OUT to R_HUB75_PANEL_OE_PULLUP.pin1",
      "R_HUB75_PANEL_OE_PULLUP.pin2 to net.V5",
      "U_DISPLAY_BUFFER_A.DIR_TO_PANEL to net.V5",
      "U_DISPLAY_BUFFER_B.DIR_TO_PANEL to net.V5"
    ]

    expect(expectedDisplayTraces).toHaveLength(56)
    expect(traceNames.slice(displayTraceStart, displayTraceStart + expectedDisplayTraces.length)).toEqual(
      expectedDisplayTraces
    )
  })

  it("models the selected application 3.3 V regulator and its safe support network", () => {
    const circuitJson = renderArchitecture()
    const sourceComponents = circuitJson.filter((element) => element.type === "source_component")
    const sourceByName = (name: string) => sourceComponents.find((element) => element.name === name)
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )

    expect(sourceByName("U_APP_REGULATOR")).toMatchObject({
      manufacturer_part_number: "LMR43620MSC3RPERQ1"
    })
    expect(sourceByName("L_APP_REGULATOR")).toMatchObject({ manufacturer_part_number: "XGL4030-222MEC" })
    const pcbCircuitJson = renderPcbPlacements()
    const applicationInductor = pcbCircuitJson.find(
      (element) => element.type === "source_component" && element.name === "L_APP_REGULATOR"
    )
    const applicationInductorSourceId =
      applicationInductor !== undefined && "source_component_id" in applicationInductor
        ? applicationInductor.source_component_id
        : undefined
    const applicationInductorPcb = pcbCircuitJson.find(
      (element) =>
        element.type === "pcb_component" &&
        applicationInductorSourceId !== undefined &&
        element.source_component_id === applicationInductorSourceId
    )
    const applicationInductorPcbId =
      applicationInductorPcb !== undefined && "pcb_component_id" in applicationInductorPcb
        ? applicationInductorPcb.pcb_component_id
        : undefined
    const applicationInductorPads = pcbCircuitJson.filter(
      (element) =>
        element.type === "pcb_smtpad" &&
        applicationInductorPcbId !== undefined &&
        element.pcb_component_id === applicationInductorPcbId
    )
    // Keep the exact selected inductor non-fabricable until its Coilcraft land pattern is verified.
    // A generic 0402 (or any other footprint) would add footprint metadata and emit pads.
    expect(applicationInductor).toMatchObject({ manufacturer_part_number: "XGL4030-222MEC" })
    expect(applicationInductor).not.toHaveProperty("footprint")
    expect(JSON.stringify(applicationInductor)).not.toContain("0402")
    expect(applicationInductorPcb).toMatchObject({ do_not_place: true })
    expect(applicationInductorPads).toHaveLength(0)
    expect(sourceByName("C_APP_REG_IN")).toMatchObject({ manufacturer_part_number: "C2012X7R1E475K125AB" })
    expect(sourceByName("C_APP_REG_OUT_A")).toMatchObject({
      manufacturer_part_number: "C2012X7S1A226M125AC"
    })
    expect(sourceByName("R_APP_REG_DISCHARGE")).toMatchObject({ manufacturer_part_number: "RC0603FR-071KL" })
    expect(sourceByName("R_APP_REG_PGOOD")).toMatchObject({ manufacturer_part_number: "RC0603FR-0710KL" })
    expect(traceNames).toEqual(
      expect.arrayContaining([
        "U_APP_REGULATOR.VIN to net.V5",
        "U_APP_REGULATOR.EN_UVLO to net.V5",
        "U_APP_REGULATOR.MODE_SYNC to U_APP_REGULATOR.VCC",
        "U_APP_REGULATOR.SW to L_APP_REGULATOR.SW",
        "L_APP_REGULATOR.V3_3 to net.V3_3",
        "U_APP_REGULATOR.VOUT_FB to net.V3_3",
        "U_APP_REGULATOR.PGOOD to TP_APP_REG_PGOOD.APP_PGOOD",
        "U_APP_REGULATOR.GND to net.GND"
      ])
    )
    expect(componentDecisions.find((component) => component.category === "application-rail-regulator")?.mpn).toBe(
      "LMR43620MSC3RPERQ1"
    )
  })
})
