/**
 * BP-123-only reset/watchdog schematic fragment.
 *
 * This renderable fragment is a deterministic review aid for the frozen
 * preflight connectivity. It is deliberately not imported by a board build,
 * a BP-300 source, or any fabrication flow.
 */
import { benchPrototypeResetWatchdog, validateBenchPrototypeResetWatchdog } from "./bench-prototype-reset-watchdog.js"

const resistor10k = "RC0603FR-0710KL"
const resistor100k = "RC0603FR-07100KL"
const ceramic100n = "C0603C104K3RACTU"

export const bp123ResetWatchdogFragmentGeometry = Object.freeze([
  Object.freeze({ name: "U_STM32", mpn: "STM32G474RET3TR", pcbX: -52, pcbY: 14 }),
  Object.freeze({ name: "U_STM_SUPERVISOR", mpn: "TPS389033DSER", pcbX: -33, pcbY: 25 }),
  Object.freeze({ name: "U_STM_WATCHDOG", mpn: "TPS3431SDRBR", pcbX: -31, pcbY: 4 }),
  Object.freeze({ name: "U_ESP32", mpn: "ESP32-S3-WROOM-1U-N16R2", pcbX: 49, pcbY: 14 }),
  Object.freeze({ name: "U_ESP_SUPERVISOR", mpn: "TPS389033DSER", pcbX: 30, pcbY: 25 }),
  Object.freeze({ name: "U_ESP_WATCHDOG", mpn: "TPS3431SDRBR", pcbX: 30, pcbY: 4 }),
  Object.freeze({ name: "U_APP_RESET_FANOUT", mpn: "SN74LVC2G07DCKR", pcbX: 7, pcbY: 15 }),
  Object.freeze({ name: "U_ISO7762", mpn: "ISO7762FDWR", pcbX: -1, pcbY: -17 }),
  Object.freeze({ name: "U_W5500", mpn: "W5500", pcbX: 49, pcbY: -19 }),
  Object.freeze({ name: "Q_ESP_RESET_STM", mpn: "BSS138AKA", pcbX: 18, pcbY: -5 }),
  Object.freeze({ name: "Q_ESP_DEBUG_RESET", mpn: "BSS138AKA", pcbX: 38, pcbY: -5 })
])

/**
 * This is the canonical BP-123 extraction itself, not a copied net list.
 * Any later BP-123 correction therefore changes this review fragment's
 * contract and makes its digest and tests fail until reviewed together.
 */
export const bp123ResetWatchdogPreflightNets = benchPrototypeResetWatchdog.schematicIntegrationPreflight.requiredNets

/** SHA-256 of the immutable geometry and ordered 11-net endpoint contract. */
export const bp123ResetWatchdogGeometryNetDigest = "fb93b8246349389cb25c7ff69aba7d0ec0257dc5681c2ccd0161f345cbf21958"

/** This fragment cannot authorize BP-300 integration, fabrication, or physical evidence. */
export const bp123ResetWatchdogFragmentEvidence = Object.freeze({
  bp300SchematicSource: false,
  ercReport: false,
  fabrication: false,
  physicalEvidence: false,
  schematicIntegrationAuthorized: false
})

export const bp123ResetWatchdogFragmentContract = Object.freeze({
  artifactKind: "bp-123-reset-watchdog-review-fragment",
  evidence: bp123ResetWatchdogFragmentEvidence,
  geometry: bp123ResetWatchdogFragmentGeometry,
  requiredNets: bp123ResetWatchdogPreflightNets
})

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return Object.is(actual, expected)
  }
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Array.isArray(actual)) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype)
      return false
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol")
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    if (!actualKeys.includes(key)) return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return (
      actualDescriptor !== undefined &&
      expectedDescriptor !== undefined &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

/**
 * Rejects mutated, aliased, or authority-relaxing fragment metadata.
 * Passing it validates a review aid only; it does not submit BP-300 evidence.
 */
export function validateBp123ResetWatchdogFragment(value: unknown): true {
  validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)
  if (!sameDataGraph(value, bp123ResetWatchdogFragmentContract)) {
    throw new RangeError("BP-123 reset/watchdog fragment must exactly match the canonical fail-closed review contract")
  }
  return true
}

function Resistor({
  name,
  mpn,
  resistance,
  pcbX,
  pcbY
}: {
  name: string
  mpn: string
  resistance: string
  pcbX: number
  pcbY: number
}) {
  return (
    <resistor
      name={name}
      manufacturerPartNumber={mpn}
      resistance={resistance}
      tolerance="1%"
      footprint="0603"
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

function Capacitor({
  name,
  capacitance,
  mpn,
  pcbX,
  pcbY
}: {
  name: string
  capacitance: string
  mpn: string
  pcbX: number
  pcbY: number
}) {
  return (
    <capacitor
      name={name}
      manufacturerPartNumber={mpn}
      capacitance={capacitance}
      footprint="0603"
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default function Bp123ResetWatchdogFragmentCircuit() {
  return (
    <board title="BP-123 reset and watchdog preflight fragment" width="132mm" height="72mm" layers={2}>
      <chip
        name="U_STM32"
        manufacturerPartNumber="STM32G474RET3TR"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin7: "NRST", pin41: "PC9", pin58: "PB5" }}
        pcbX={-52}
        pcbY={14}
      />
      <chip
        name="J_STM_SWD"
        manufacturerPartNumber="SWD-REFERENCE-ONLY"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "NRST" }}
        pcbX={-60}
        pcbY={-5}
      />
      <chip
        name="U_STM_SUPERVISOR"
        manufacturerPartNumber="TPS389033DSER"
        footprint={[]}
        pinLabels={{ pin1: "SENSE", pin2: "GND", pin3: "MR", pin4: "VDD", pin5: "CT", pin6: "RESET" }}
        pcbX={-33}
        pcbY={25}
      />
      <chip
        name="U_STM_WATCHDOG"
        manufacturerPartNumber="TPS3431SDRBR"
        footprint="qfn8"
        pinLabels={{
          pin1: "VDD",
          pin2: "CWD",
          pin3: "EN",
          pin4: "GND",
          pin5: "SET1",
          pin6: "WDI",
          pin7: "WDO",
          pin8: "ENOUT"
        }}
        pcbX={-31}
        pcbY={4}
      />
      <chip
        name="U_ESP32"
        manufacturerPartNumber="ESP32-S3-WROOM-1U-N16R2"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin3: "EN", pin20: "GPIO12" }}
        pcbX={49}
        pcbY={14}
      />
      <chip
        name="U_ESP_SUPERVISOR"
        manufacturerPartNumber="TPS389033DSER"
        footprint={[]}
        pinLabels={{ pin1: "SENSE", pin2: "GND", pin3: "MR", pin4: "VDD", pin5: "CT", pin6: "RESET" }}
        pcbX={30}
        pcbY={25}
      />
      <chip
        name="U_ESP_WATCHDOG"
        manufacturerPartNumber="TPS3431SDRBR"
        footprint="qfn8"
        pinLabels={{
          pin1: "VDD",
          pin2: "CWD",
          pin3: "EN",
          pin4: "GND",
          pin5: "SET1",
          pin6: "WDI",
          pin7: "WDO",
          pin8: "ENOUT"
        }}
        pcbX={30}
        pcbY={4}
      />
      <chip
        name="U_APP_RESET_FANOUT"
        manufacturerPartNumber="SN74LVC2G07DCKR"
        footprint={[]}
        pinLabels={{ pin1: "A1", pin2: "GND", pin3: "A2", pin4: "Y2", pin5: "VCC", pin6: "Y1" }}
        pcbX={7}
        pcbY={15}
      />
      <chip
        name="U_ISO7762"
        manufacturerPartNumber="ISO7762FDWR"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin5: "CH4_IN", pin12: "CH4_OUT" }}
        pcbX={-1}
        pcbY={-17}
      />
      <chip
        name="U_W5500"
        manufacturerPartNumber="W5500"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "RST_N" }}
        pcbX={49}
        pcbY={-19}
      />
      <pinheader
        name="TP_W5500_RESET_N"
        pinCount={1}
        pinLabels={{ pin1: "RESET_N" }}
        gender="male"
        pcbX={59}
        pcbY={-19}
      />
      <pinheader
        name="J_MANUAL_RESET"
        pinCount={1}
        pinLabels={{ pin1: "MANUAL_RESET_ASSERT" }}
        gender="male"
        pcbX={47}
        pcbY={-5}
      />

      <chip
        name="Q_ESP_RESET_STM"
        manufacturerPartNumber="BSS138AKA"
        footprint="sot23"
        pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }}
        pcbX={18}
        pcbY={-5}
      />
      <chip
        name="Q_ESP_DEBUG_RESET"
        manufacturerPartNumber="BSS138AKA"
        footprint="sot23"
        pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }}
        pcbX={38}
        pcbY={-5}
      />

      <Capacitor name="C_STM_SUPERVISOR_CT" mpn={ceramic100n} capacitance="100nF" pcbX={-42} pcbY={25} />
      <Capacitor name="C_STM_SUPERVISOR_BYPASS" mpn={ceramic100n} capacitance="100nF" pcbX={-25} pcbY={25} />
      <Capacitor name="C_STM_WD_BYPASS" mpn={ceramic100n} capacitance="100nF" pcbX={-40} pcbY={4} />
      <Capacitor name="C_STM_NRST_FILTER" mpn={ceramic100n} capacitance="100nF" pcbX={-43} pcbY={10} />
      <Capacitor name="C_ESP_SUPERVISOR_CT" mpn={ceramic100n} capacitance="100nF" pcbX={21} pcbY={25} />
      <Capacitor name="C_ESP_SUPERVISOR_BYPASS" mpn={ceramic100n} capacitance="100nF" pcbX={38} pcbY={25} />
      <Capacitor name="C_ESP_WD_BYPASS" mpn={ceramic100n} capacitance="100nF" pcbX={21} pcbY={4} />
      <Capacitor name="C_APP_RESET_FANOUT_BYPASS" mpn={ceramic100n} capacitance="100nF" pcbX={7} pcbY={25} />
      <Capacitor name="C_ESP_EN_DELAY" mpn="C1608X5R1A105K080AC" capacitance="1uF" pcbX={43} pcbY={8} />

      <Resistor name="R_STM_WD_CWD" mpn={resistor10k} resistance="10k" pcbX={-22} pcbY={0} />
      <Resistor name="R_STM_WDI_PULLUP" mpn={resistor100k} resistance="100k" pcbX={-22} pcbY={8} />
      <Resistor name="R_STM_NRST_PULLUP" mpn={resistor10k} resistance="10k" pcbX={-43} pcbY={17} />
      <Resistor name="R_STM_RESET_ISO_SERIES" mpn={resistor10k} resistance="10k" pcbX={-22} pcbY={-17} />
      <Resistor name="R_STM_RESET_ISO_PD" mpn={resistor100k} resistance="100k" pcbX={-12} pcbY={-22} />
      <Resistor name="R_ESP_WD_CWD" mpn={resistor10k} resistance="10k" pcbX={39} pcbY={0} />
      <Resistor name="R_ESP_WDI_PULLUP" mpn={resistor100k} resistance="100k" pcbX={39} pcbY={-2} />
      <Resistor name="R_ESP_EN_PULLUP" mpn={resistor10k} resistance="10k" pcbX={43} pcbY={16} />
      <Resistor name="R_APP_SUPERVISOR_RESET_PULLUP" mpn={resistor10k} resistance="10k" pcbX={14} pcbY={20} />
      <Resistor name="R_W5500_RESET_PULLUP" mpn={resistor10k} resistance="10k" pcbX={38} pcbY={-19} />
      <Resistor name="R_STM_RESET_GATE" mpn={resistor10k} resistance="10k" pcbX={8} pcbY={-9} />
      <Resistor name="R_STM_RESET_GATE_PD" mpn={resistor100k} resistance="100k" pcbX={18} pcbY={-13} />
      <Resistor name="R_DEBUG_RESET_GATE" mpn={resistor10k} resistance="10k" pcbX={47} pcbY={-9} />
      <Resistor name="R_DEBUG_RESET_GATE_PD" mpn={resistor100k} resistance="100k" pcbX={38} pcbY={-13} />

      <trace from="U_STM32.NRST" to="U_STM_SUPERVISOR.RESET" />
      <trace from="U_STM32.NRST" to="U_STM_WATCHDOG.WDO" />
      <trace from="U_STM32.NRST" to="U_STM_WATCHDOG.ENOUT" />
      <trace from="U_STM32.NRST" to="R_STM_NRST_PULLUP.pin2" />
      <trace from="U_STM32.NRST" to="C_STM_NRST_FILTER.pin1" />
      <trace from="U_STM32.NRST" to="J_STM_SWD.NRST" />
      <trace from="U_STM32.PC9" to="U_STM_WATCHDOG.WDI" />
      <trace from="U_STM32.PC9" to="R_STM_WDI_PULLUP.pin2" />
      <trace from="U_ESP32.GPIO12" to="U_ESP_WATCHDOG.WDI" />
      <trace from="U_ESP32.GPIO12" to="R_ESP_WDI_PULLUP.pin2" />
      <trace from="U_ESP32.EN" to="U_APP_RESET_FANOUT.Y1" />
      <trace from="U_ESP32.EN" to="U_ESP_WATCHDOG.WDO" />
      <trace from="U_ESP32.EN" to="U_ESP_WATCHDOG.ENOUT" />
      <trace from="U_ESP32.EN" to="Q_ESP_RESET_STM.D" />
      <trace from="U_ESP32.EN" to="Q_ESP_DEBUG_RESET.D" />
      <trace from="U_ESP32.EN" to="R_ESP_EN_PULLUP.pin2" />
      <trace from="U_ESP32.EN" to="C_ESP_EN_DELAY.pin1" />
      <trace from="U_ESP_SUPERVISOR.RESET" to="U_APP_RESET_FANOUT.A1" />
      <trace from="U_ESP_SUPERVISOR.RESET" to="U_APP_RESET_FANOUT.A2" />
      <trace from="U_ESP_SUPERVISOR.RESET" to="R_APP_SUPERVISOR_RESET_PULLUP.pin2" />
      <trace from="U_APP_RESET_FANOUT.Y2" to="R_W5500_RESET_PULLUP.pin2" />
      <trace from="U_APP_RESET_FANOUT.Y2" to="U_W5500.RST_N" />
      <trace from="U_APP_RESET_FANOUT.Y2" to="TP_W5500_RESET_N.RESET_N" />
      <trace from="U_STM32.PB5" to="R_STM_RESET_ISO_SERIES.pin1" />
      <trace from="R_STM_RESET_ISO_SERIES.pin2" to="R_STM_RESET_ISO_PD.pin1" />
      <trace from="R_STM_RESET_ISO_SERIES.pin2" to="U_ISO7762.CH4_IN" />
      <trace from="U_ISO7762.CH4_OUT" to="R_STM_RESET_GATE.pin1" />
      <trace from="R_STM_RESET_GATE.pin2" to="Q_ESP_RESET_STM.G" />
      <trace from="Q_ESP_RESET_STM.G" to="R_STM_RESET_GATE_PD.pin1" />
      <trace from="J_MANUAL_RESET.MANUAL_RESET_ASSERT" to="R_DEBUG_RESET_GATE.pin1" />
      <trace from="R_DEBUG_RESET_GATE.pin2" to="Q_ESP_DEBUG_RESET.G" />
      <trace from="Q_ESP_DEBUG_RESET.G" to="R_DEBUG_RESET_GATE_PD.pin1" />

      <trace from="U_STM_SUPERVISOR.GND" to="net.SCORING_SGND" />
      <trace from="U_STM_WATCHDOG.GND" to="net.SCORING_SGND" />
      <trace from="C_STM_SUPERVISOR_CT.pin2" to="net.SCORING_SGND" />
      <trace from="C_STM_SUPERVISOR_BYPASS.pin2" to="net.SCORING_SGND" />
      <trace from="C_STM_WD_BYPASS.pin2" to="net.SCORING_SGND" />
      <trace from="C_STM_NRST_FILTER.pin2" to="net.SCORING_SGND" />
      <trace from="R_STM_RESET_ISO_PD.pin2" to="net.SCORING_SGND" />
      <trace from="U_ESP_SUPERVISOR.GND" to="net.APP_GND" />
      <trace from="U_ESP_WATCHDOG.GND" to="net.APP_GND" />
      <trace from="U_APP_RESET_FANOUT.GND" to="net.APP_GND" />
      <trace from="C_ESP_SUPERVISOR_CT.pin2" to="net.APP_GND" />
      <trace from="C_ESP_SUPERVISOR_BYPASS.pin2" to="net.APP_GND" />
      <trace from="C_ESP_WD_BYPASS.pin2" to="net.APP_GND" />
      <trace from="C_APP_RESET_FANOUT_BYPASS.pin2" to="net.APP_GND" />
      <trace from="C_ESP_EN_DELAY.pin2" to="net.APP_GND" />
      <trace from="R_STM_RESET_GATE_PD.pin2" to="net.APP_GND" />
      <trace from="R_DEBUG_RESET_GATE_PD.pin2" to="net.APP_GND" />
      <trace from="Q_ESP_RESET_STM.S" to="net.APP_GND" />
      <trace from="Q_ESP_DEBUG_RESET.S" to="net.APP_GND" />

      <trace from="U_STM_SUPERVISOR.SENSE" to="net.SCORING_3V3" />
      <trace from="U_STM_SUPERVISOR.MR" to="net.SCORING_3V3" />
      <trace from="U_STM_SUPERVISOR.VDD" to="net.SCORING_3V3" />
      <trace from="U_STM_SUPERVISOR.CT" to="C_STM_SUPERVISOR_CT.pin1" />
      <trace from="C_STM_SUPERVISOR_BYPASS.pin1" to="net.SCORING_3V3" />
      <trace from="U_STM_WATCHDOG.VDD" to="net.SCORING_3V3" />
      <trace from="U_STM_WATCHDOG.EN" to="net.SCORING_3V3" />
      <trace from="U_STM_WATCHDOG.SET1" to="net.SCORING_3V3" />
      <trace from="U_STM_WATCHDOG.CWD" to="R_STM_WD_CWD.pin1" />
      <trace from="R_STM_WD_CWD.pin2" to="net.SCORING_3V3" />
      <trace from="R_STM_WDI_PULLUP.pin1" to="net.SCORING_3V3" />
      <trace from="R_STM_NRST_PULLUP.pin1" to="net.SCORING_3V3" />
      <trace from="U_ESP_SUPERVISOR.SENSE" to="net.V3_3" />
      <trace from="U_ESP_SUPERVISOR.MR" to="net.V3_3" />
      <trace from="U_ESP_SUPERVISOR.VDD" to="net.V3_3" />
      <trace from="U_ESP_SUPERVISOR.CT" to="C_ESP_SUPERVISOR_CT.pin1" />
      <trace from="C_ESP_SUPERVISOR_BYPASS.pin1" to="net.V3_3" />
      <trace from="U_ESP_WATCHDOG.VDD" to="net.V3_3" />
      <trace from="U_ESP_WATCHDOG.EN" to="net.V3_3" />
      <trace from="U_ESP_WATCHDOG.SET1" to="net.V3_3" />
      <trace from="U_ESP_WATCHDOG.CWD" to="R_ESP_WD_CWD.pin1" />
      <trace from="R_ESP_WD_CWD.pin2" to="net.V3_3" />
      <trace from="R_ESP_WDI_PULLUP.pin1" to="net.V3_3" />
      <trace from="R_ESP_EN_PULLUP.pin1" to="net.V3_3" />
      <trace from="R_APP_SUPERVISOR_RESET_PULLUP.pin1" to="net.V3_3" />
      <trace from="R_W5500_RESET_PULLUP.pin1" to="net.V3_3" />
      <trace from="U_APP_RESET_FANOUT.VCC" to="net.V3_3" />
      <trace from="C_APP_RESET_FANOUT_BYPASS.pin1" to="net.V3_3" />
    </board>
  )
}
