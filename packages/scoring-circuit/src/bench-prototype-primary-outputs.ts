export type PrimaryOutputChannel = "LAMP_RED" | "LAMP_GREEN" | "LAMP_WHITE_LEFT" | "LAMP_WHITE_RIGHT" | "BUZZER"

const channels = [
  { gpio: 7, channel: "LAMP_RED", connectorCircuit: 1 },
  { gpio: 15, channel: "LAMP_GREEN", connectorCircuit: 2 },
  { gpio: 17, channel: "LAMP_WHITE_LEFT", connectorCircuit: 3 },
  { gpio: 10, channel: "LAMP_WHITE_RIGHT", connectorCircuit: 4 },
  { gpio: 11, channel: "BUZZER", connectorCircuit: 5 }
] as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("primary-output contract cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("primary-output contract permits data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

/**
 * P0 output-stage boundary. This is intentionally not a load-driver selection:
 * the external lamp and buzzer electrical envelopes have not been supplied.
 */
export const benchPrototypePrimaryOutputs = deepFreeze({
  artifactKind: "bench-prototype-primary-output-boundary",
  targetAssembly: "ESP32-S3-only P0",
  channels,
  connector: {
    reference: "J_PRIMARY_OUTPUTS",
    status: "TBD-load-envelope",
    manufacturer: "Molex",
    mpn: "39-29-1067",
    package: "Mini-Fit Jr., 2 by 3, 4.20 mm pitch, right-angle through-hole",
    matingHousing: "39-01-2060",
    matingTerminal: "39-00-0039",
    dedicatedReturnCircuit: 6,
    componentContactRatingA: 9,
    componentOperatingTemperatureC: 105,
    sourceUrl: "https://www.molex.com/en-us/products/part-detail/39291067",
    boundary:
      "This is an existing-evidence candidate, not a P0 selection. Its component contact rating is not a system channel rating. No lamp or buzzer voltage, current, inrush, fault, common-return, cable, thermal, or EMC limit is claimed."
  },
  controllerInterface: {
    kind: "five direct ESP32 GPIOs into logic-level driver inputs",
    gpio: [7, 15, 17, 10, 11],
    eliminatedComponent: "U_PRIMARY_OUTPUT_LATCH",
    inputRule: "Each driver input must default inactive before and during ESP32 reset.",
    prohibited: ["direct ESP32 GPIO-to-load connection", "firmware-only output safing", "stateful serial latch"]
  },
  hardwareSafeState: {
    resetNet: "APP_RESET_N",
    inactiveDuring: [
      "power-up before firmware",
      "APP_RESET_N asserted",
      "watchdog fault",
      "brownout",
      "driver supply absent"
    ],
    requiredPermit:
      "A hardware gate may release the driver enable only when APP_RESET_N is deasserted and the independently supervised watchdog health is valid. Any missing rail, reset, watchdog fault, or open gate path must force every channel inactive.",
    inactiveElectricalState:
      "Driver inputs and connector output channels are non-energizing; retained shift-register data is not authority to energize a load."
  },
  loadDriver: {
    reference: "U_PRIMARY_OUTPUT_DRIVER",
    status: "TBD-load-envelope",
    requiredSafety: [
      "hardware enable governed by the primary-output permit",
      "no energized channel when the permit is absent",
      "per-channel behavior defined for open load, short, and overtemperature before selection"
    ],
    blockers: [
      "lamp supply voltage and each lamp steady-state and inrush current",
      "buzzer voltage, steady-state current, inrush, and inductive or piezo topology",
      "required on-state voltage drop, fault response, and common-return current",
      "cable length, connector temperature rise, EMC, and ambient envelope"
    ]
  },
  fabricationDisposition: "DENY",
  releaseState: "deny"
})

export function validateBenchPrototypePrimaryOutputs(value: unknown): true {
  if (value !== benchPrototypePrimaryOutputs) {
    throw new RangeError("primary-output boundary must use the canonical P0 contract")
  }
  const contract = benchPrototypePrimaryOutputs
  if (
    contract.channels.length !== 5 ||
    contract.channels.map((channel) => channel.connectorCircuit).join(",") !== "1,2,3,4,5" ||
    contract.channels.map((channel) => channel.gpio).join(",") !== "7,15,17,10,11" ||
    contract.connector.mpn !== "39-29-1067" ||
    contract.connector.status !== "TBD-load-envelope" ||
    contract.connector.dedicatedReturnCircuit !== 6 ||
    contract.controllerInterface.eliminatedComponent !== "U_PRIMARY_OUTPUT_LATCH" ||
    !contract.controllerInterface.prohibited.includes("firmware-only output safing") ||
    !contract.hardwareSafeState.inactiveDuring.includes("APP_RESET_N asserted") ||
    !contract.hardwareSafeState.inactiveDuring.includes("watchdog fault") ||
    contract.loadDriver.status !== "TBD-load-envelope" ||
    contract.fabricationDisposition !== "DENY" ||
    contract.releaseState !== "deny"
  ) {
    throw new RangeError("P0 primary outputs must remain hardware-safe and electrically bounded")
  }
  return true
}
