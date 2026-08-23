import { productionHarnessSelection } from "./production-harness-selection.js"

/**
 * Physical-board ownership is deliberately separate from the logical
 * architecture. The latter preserves end-to-end net connectivity; these
 * models reserve the independently released PCB assemblies without inventing
 * the still-unselected isolation interconnect or any released land pattern.
 */
export const physicalBoardContract = {
  scoringIoBoard: {
    title: "Scoring I/O board planning model",
    widthMm: 290,
    heightMm: 70,
    layers: 6,
    finishedThicknessMm: 1.6,
    owner: "SCORING_IO_BOARD",
    isolatedBoundary: "J_ISO_APP_BOUNDARY is DNP until connector, slot, creepage, and placement are released"
  },
  applicationDisplayCarrier: {
    title: "Application/display carrier planning model",
    widthMm: 290,
    heightMm: 135,
    layers: 6,
    finishedThicknessMm: 1.6,
    owner: "APPLICATION_DISPLAY_CARRIER",
    isolatedBoundary: "J_ISO_SCORING_BOUNDARY is DNP until connector, slot, creepage, and placement are released"
  }
} as const

export const isolatedInterboardPinLabels = {
  pin1: "V5_PRIMARY",
  pin2: "APP_GND_PRIMARY",
  pin3: "V3_3_APP",
  pin4: "APP_GND_LOGIC",
  pin5: "SCORE_SCK",
  pin6: "SCORE_MOSI",
  pin7: "SCORE_MISO",
  pin8: "SCORE_CS",
  pin9: "ESP_RESET_ASSERT",
  pin10: "STM_HEARTBEAT",
  pin11: "ESP_HEARTBEAT"
} as const

/**
 * The scoring I/O board terminates only the internal keyed harnesses.  The
 * body-cord sockets J_L and J_R stay on their separately serviceable chassis
 * modules; they are intentionally not PCB references or PCB load paths.
 */
export const scoringHarnessBoardIntegration = [
  {
    boardReference: "J_WEAPON_HARNESS_L",
    cableMpn: "45003",
    headerMpn: "43650-0300",
    mateHousingMpn: "43645-0300",
    mateTerminalMpn: "43030-0007",
    pinLabels: { pin1: "WEAPON_A", pin2: "WEAPON_B", pin3: "WEAPON_C" },
    chassisSocketReferences: ["J_L"]
  },
  {
    boardReference: "J_WEAPON_HARNESS_R",
    cableMpn: "45004",
    headerMpn: "43650-0400",
    mateHousingMpn: "43645-0400",
    mateTerminalMpn: "43030-0007",
    pinLabels: {
      pin1: "WEAPON_A",
      pin2: "WEAPON_B",
      pin3: "WEAPON_C",
      pin4: "EMPTY_CAVITY_NO_TERMINAL"
    },
    chassisSocketReferences: ["J_R"]
  },
  {
    boardReference: "J_PISTE_HARNESS",
    cableMpn: "45002",
    headerMpn: "43650-0200",
    mateHousingMpn: "43645-0200",
    mateTerminalMpn: "43030-0007",
    pinLabels: { pin1: "PISTE", pin2: "PISTE_RETURN" },
    chassisSocketReferences: []
  },
  {
    boardReference: "J_PRIMARY_OUTPUTS_HARNESS",
    cableMpn: "45066",
    headerMpn: "39-29-1067",
    mateHousingMpn: "39-01-2060",
    mateTerminalMpn: "39-00-0039",
    pinLabels: {
      pin1: "LAMP_RED",
      pin2: "LAMP_GREEN",
      pin3: "LAMP_WHITE_L",
      pin4: "LAMP_WHITE_R",
      pin5: "BUZZER",
      pin6: "PRIMARY_RETURN"
    },
    chassisSocketReferences: []
  }
] as const

export const scoringIoOwnedReferences = [
  "J_WEAPON_HARNESS_L",
  "J_WEAPON_HARNESS_R",
  "J_PISTE_HARNESS",
  "U_ESD_L",
  "U_ESD_R",
  "U_FRONTEND_L",
  "U_FRONTEND_R",
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
  "U_LINE_SINK_B",
  "U_ISO_MAIN",
  "U_ISO_AUX",
  "J_STM_SWD",
  "U_PRIMARY_OUTPUT_DRIVER",
  "J_PRIMARY_OUTPUTS_HARNESS",
  "J_ISO_APP_BOUNDARY"
] as const

export const applicationDisplayOwnedReferences = [
  "J_ISO_SCORING_BOUNDARY",
  "U_ESP32",
  "U_ESP_WATCHDOG",
  "U_ESP_SUPERVISOR",
  "R_ESP_WD_CWD",
  "C_ESP_WD_BYPASS",
  "C_ESP_SUPERVISOR_CT",
  "C_ESP_SUPERVISOR_BYPASS",
  "R_ESP_EN_PULLUP",
  "C_ESP_EN_DELAY",
  "Q_ESP_RESET_STM",
  "Q_ESP_DEBUG_RESET",
  "R_STM_RESET_GATE",
  "R_STM_RESET_GATE_PD",
  "R_DEBUG_RESET_GATE",
  "R_DEBUG_RESET_GATE_PD",
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
  "R_HUB75_OE_N_PU",
  "R_HUB75_PANEL_OE_PULLUP",
  "Q_DISPLAY_BUFFER_A_ENABLE",
  "R_BUFFER_A_ENABLE_PULLUP",
  "R_BUFFER_A_GATE",
  "R_BUFFER_A_GATE_PD",
  "Q_DISPLAY_BUFFER_B_ENABLE",
  "R_BUFFER_B_ENABLE_PULLUP",
  "R_BUFFER_B_GATE",
  "R_BUFFER_B_GATE_PD",
  "J_HUB75",
  "U_AUDIO",
  "J_SPEAKER",
  "J_ESP_DEBUG",
  "J_CTRL_CARRIER",
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
  "TP_COMM_RESET_ASSERT",
  "TP_COMM_PRESENT_N",
  "TP_COMM_INT_N",
  "J_PWR_CARRIER",
  "J_USB2_CARRIER",
  "R_USB_DN_CARRIER",
  "R_USB_DP_CARRIER",
  "U_FRAM",
  "R_FRAM_WP_PULLUP",
  "R_FRAM_HOLD_PULLUP",
  "U_RTC",
  "U_SECURE_ELEMENT",
  "U_V5_BUCK",
  "L_V5_BUCK",
  "R_V5_SENSE",
  "C_V5_BUCK_IN_HF",
  "C_V5_BUCK_BOOT",
  "C_V5_BUCK_OUT_A",
  "R_V5_BUCK_FB_TOP",
  "R_V5_BUCK_FB_BOTTOM",
  "R_V5_BUCK_EN_UP",
  "R_V5_BUCK_EN_DOWN",
  "U_APP_REGULATOR",
  "L_APP_REGULATOR",
  "U_POWER_MONITOR"
] as const

export const physicalBoardOpenFunctionalRoutingGates = [
  {
    id: "scoring-line-switch-functional-routing",
    references: ["U_LINE_SOURCE_A", "U_LINE_SOURCE_B", "U_LINE_SINK_A", "U_LINE_SINK_B"],
    status: "open",
    reason:
      "The TMUX1112 banks have reviewed rail ownership but no reviewed channel-to-front-end boundary. They remain PCB-disabled and DNP; no functional routing or fabrication credit is claimed."
  }
] as const

export function validatePhysicalBoardContract(): void {
  const scoring = new Set<string>(scoringIoOwnedReferences)
  const duplicated = applicationDisplayOwnedReferences.filter((reference) => scoring.has(reference))
  if (duplicated.length > 0) {
    throw new RangeError(`Physical board ownership is duplicated: ${duplicated.join(", ")}`)
  }
  if (
    physicalBoardContract.scoringIoBoard.layers !== 6 ||
    physicalBoardContract.applicationDisplayCarrier.layers !== 6 ||
    physicalBoardContract.scoringIoBoard.finishedThicknessMm !== 1.6 ||
    physicalBoardContract.applicationDisplayCarrier.finishedThicknessMm !== 1.6
  ) {
    throw new RangeError("The two main physical-board contracts must retain the reviewed six-layer 1.6 mm envelope")
  }
  const boundaryPins = Object.values(isolatedInterboardPinLabels)
  if (boundaryPins.length !== 11 || new Set(boundaryPins).size !== boundaryPins.length) {
    throw new RangeError("The isolation boundary must contain eleven unique reviewed conductors")
  }
  const expectedHeaders = ["43650-0300", "43650-0400", "43650-0200", "39-29-1067"]
  if (
    scoringHarnessBoardIntegration.length !== expectedHeaders.length ||
    scoringHarnessBoardIntegration.some((harness, index) => harness.headerMpn !== expectedHeaders[index])
  ) {
    throw new RangeError("The scoring I/O harness boundary must retain the reviewed exact header selection")
  }
  const boardReferences = scoringHarnessBoardIntegration.map((harness) => harness.boardReference)
  if (
    new Set(boardReferences).size !== boardReferences.length ||
    boardReferences.some((reference) => !scoring.has(reference)) ||
    scoringHarnessBoardIntegration.some((harness) =>
      harness.chassisSocketReferences.some((reference) => scoring.has(reference))
    )
  ) {
    throw new RangeError(
      "Chassis socket clusters must remain off-board and harness references must remain scoring-owned"
    )
  }
  const selectedPinLabels = {
    "intentional empty cavity": "EMPTY_CAVITY_NO_TERMINAL",
    "piste return to connector-side ESD return": "PISTE_RETURN",
    "piste signal": "PISTE",
    "primary output return": "PRIMARY_RETURN",
    "red lamp output": "LAMP_RED",
    "green lamp output": "LAMP_GREEN",
    "left white lamp output": "LAMP_WHITE_L",
    "right white lamp output": "LAMP_WHITE_R",
    "buzzer output": "BUZZER",
    "weapon A": "WEAPON_A",
    "weapon B": "WEAPON_B",
    "weapon C": "WEAPON_C"
  } as const
  for (const harness of scoringHarnessBoardIntegration) {
    const selection = productionHarnessSelection.find(
      (candidate) => candidate.boardReference === harness.boardReference
    )
    if (
      selection === undefined ||
      selection.boardIntegrationState !== "integrated-dnp" ||
      selection.cable.mpn !== harness.cableMpn ||
      selection.connector.headerMpn !== harness.headerMpn ||
      selection.connector.mateHousingMpn !== harness.mateHousingMpn ||
      selection.connector.mateTerminalMpn !== harness.mateTerminalMpn ||
      selection.pins.length !== Object.keys(harness.pinLabels).length ||
      selection.pins.some(
        (pin) =>
          harness.pinLabels[`pin${pin.pin}` as keyof typeof harness.pinLabels] !== selectedPinLabels[pin.function]
      )
    ) {
      throw new RangeError(
        "The scoring I/O board harness data must exactly integrate the reviewed production selection"
      )
    }
  }
}
