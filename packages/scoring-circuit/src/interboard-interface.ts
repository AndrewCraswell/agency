/**
 * Fail-closed inter-board contract for the isolated communications module.
 *
 * The module connectivity model implements this boundary, but no connector or
 * IC footprint is released. This contract is never fabrication evidence.
 */

export type InterfaceReleaseState = "deny"

export type InterboardConnector = {
  readonly exactOrderableParts: readonly string[]
  readonly function: "control" | "power" | "usb2"
  readonly interfaceName: string
  readonly releaseState: InterfaceReleaseState
}

export type HarnessPin = {
  readonly assignment: string
  readonly contact: number
  readonly direction:
    | "application-to-communications"
    | "communications-to-application"
    | "power"
    | "reserved-test-only"
    | "return"
  readonly rule: string
}

export const interboardConnectors = [
  {
    exactOrderableParts: ["Molex 43045-0400", "Molex 43025-0400", "Molex 43030-0007"],
    function: "power",
    interfaceName: "J_PWR: keyed Micro-Fit 3.0, four-circuit 20 V distribution harness",
    releaseState: "deny"
  },
  {
    exactOrderableParts: ["Samtec ECDP-08-07.87-L1-L2-1-3", "Samtec HSEC8-113-01-L-DV-A-L2 (quantity 2)"],
    function: "usb2",
    interfaceName: "J_USB2: 7.87 inch wire-length Edge Card twinax USB 2.0 harness",
    releaseState: "deny"
  },
  {
    exactOrderableParts: ["Molex 43045-1200", "Molex 43025-1200", "Molex 43030-0007"],
    function: "control",
    interfaceName: "J_CTRL: keyed Micro-Fit 3.0, twelve-circuit application-to-communications control harness",
    releaseState: "deny"
  }
] as const satisfies readonly InterboardConnector[]

export const powerHarnessSpecification = {
  apparatusSourceLimitA: 3,
  contactCountPerPolarity: 2,
  contactManufacturerMaximumA: 7,
  maximumPlannedCurrentPerContactA: 1.5,
  maximumRoundTripDropMvAt3A: 100,
  terminalMpn: "43030-0007",
  wireGaugeAwg: 20
} as const

export const controlHarnessSpecification = {
  carrierPullOhm: 100_000,
  maximumLengthMm: 150,
  maximumSpiClockMHz: 10,
  resetGatePulldownOhm: 100_000,
  sourceSeriesOhm: 33,
  terminalMpn: "43030-0007",
  wireGaugeAwg: 24
} as const

export const usb2HarnessSpecification = {
  cableMpn: "ECDP-08-07.87-L1-L2-1-3",
  differentialPairAssignment: "twinax pair 1: negative conductor USB_DN, positive conductor USB_DP",
  differentialImpedanceOhm: 100,
  maximumPublishedDataRateGbps: 14,
  nominalOverallLengthMm: 217.4,
  nominalWireLengthIn: 7.87,
  nominalWireLengthMm: 199.9,
  signalGroundConductor: "none",
  shieldAssignment: "cable shield and both HSEC8 metalwork bond to CHASSIS only",
  socketMpn: "HSEC8-113-01-L-DV-A-L2",
  socketQuantity: 2,
  usbHighSpeedMbps: 480,
  wireGaugeAwg: 30
} as const

export const powerHarnessPins = [
  { assignment: "V20_EFUSE_OUT", contact: 1, direction: "power", rule: "20 AWG; parallel positive feed A" },
  { assignment: "GND", contact: 2, direction: "return", rule: "20 AWG; parallel return A" },
  { assignment: "V20_EFUSE_OUT", contact: 3, direction: "power", rule: "20 AWG; parallel positive feed B" },
  { assignment: "GND", contact: 4, direction: "return", rule: "20 AWG; parallel return B" }
] as const satisfies readonly HarnessPin[]

export const controlHarnessPins = [
  { assignment: "GND", contact: 1, direction: "return", rule: "SPI SCK return" },
  {
    assignment: "W5500_SCK",
    contact: 2,
    direction: "application-to-communications",
    rule: "10 MHz maximum before SI release"
  },
  { assignment: "GND", contact: 3, direction: "return", rule: "SPI MOSI return" },
  {
    assignment: "W5500_MOSI",
    contact: 4,
    direction: "application-to-communications",
    rule: "10 MHz maximum before SI release"
  },
  { assignment: "GND", contact: 5, direction: "return", rule: "SPI MISO return" },
  {
    assignment: "W5500_MISO",
    contact: 6,
    direction: "communications-to-application",
    rule: "10 MHz maximum before SI release"
  },
  { assignment: "GND", contact: 7, direction: "return", rule: "chip-select and interrupt return" },
  {
    assignment: "W5500_CS_N",
    contact: 8,
    direction: "application-to-communications",
    rule: "assert only after COMM_PRESENT_N is low and both local rails are power-good"
  },
  {
    assignment: "W5500_INT_N",
    contact: 9,
    direction: "communications-to-application",
    rule: "active-low push-pull W5500 status; carrier 100 kOhm pull-up defines disconnected state only"
  },
  {
    assignment: "COMM_RESET_ASSERT",
    contact: 10,
    direction: "reserved-test-only",
    rule: "reserved active-high fixture request; carrier firmware has no allocated GPIO; carrier test pad and 100 kOhm pull-down only; drives the gate of a module-local BSS138AKA reset sink"
  },
  {
    assignment: "COMM_PRESENT_N",
    contact: 11,
    direction: "communications-to-application",
    rule: "module-side 1 kOhm tie to GND; carrier-side 100 kOhm pull-up to V3_3; electrical-presence status only"
  },
  { assignment: "GND", contact: 12, direction: "return", rule: "status and reset return" }
] as const satisfies readonly HarnessPin[]

export const shieldAndGroundContract = {
  applicationGroundBond:
    "APP_GND must not connect to CHASSIS through a trace, zero-ohm link, cable shield, connector latch, or mounting hardware.",
  applicationTermination:
    "Application-side HSEC8 metalwork bonds directly to CHASSIS through a dedicated chassis contact, not APP_GND.",
  communicationsTermination:
    "USB-C shell, RJ45 shield, ECDP shield, and communications-side HSEC8 metalwork bond to CHASSIS at the connector-entry zone.",
  usbSignalReturn:
    "USB D+ and D- use one 100 ohm twinax pair with no separate signal-ground conductor. APP_GND reference continuity is provided only by the J_PWR GND conductors; shield is CHASSIS and never signal return."
} as const

export const serviceAndSequencingContract = {
  commPresentAuthority: "status-only",
  energizedInternalMating: "prohibited",
  externalHotPlugBoundary:
    "Only the external USB-C receptacle is a powered attachment point; PD/eFuse startup does not make J_PWR, J_CTRL, or J_USB2 hot-plug interfaces.",
  presenceMechanism:
    "COMM_PRESENT_N detects electrical mating through a module-side 1 kOhm ground tie. It does not detect latch engagement.",
  serviceSequence:
    "Remove the external USB-C source, verify V20_EFUSE_OUT is discharged, then unlatch internal harnesses. Reverse this order for assembly."
} as const

export const communicationsPowerBoundary = {
  carrierDefaults: {
    INT_N: "W5500 active-low push-pull output; carrier-side 100 kOhm pull-up to V3_3 defines disconnected state only",
    MISO: "100 kOhm pull-down to APP_GND",
    MOSI: "default low; 33 ohm source-series resistor",
    RESET_ASSERT:
      "reserved test-only, not firmware-driven; carrier test pad with 100 kOhm pull-down and module-side 100 kOhm gate pull-down",
    SCK: "default low; 33 ohm source-series resistor",
    W5500_CS_N: "default high; 33 ohm source-series resistor"
  },
  localRail: "COMM_3V3",
  moduleInputGates: [
    {
      enable: "COMM_IO_ENABLE active-high; local 100 kOhm OE pull-down keeps both channels disabled during ramp",
      ioOffProtection: true,
      mpn: "SN74LVC2G126DCUR",
      signals: ["W5500_SCK", "W5500_MOSI"],
      sourceUrl: "https://www.ti.com/lit/ds/symlink/sn74lvc2g126.pdf"
    },
    {
      enable: "COMM_IO_ENABLE active-high; local 100 kOhm OE pull-down keeps the channel disabled during ramp",
      ioOffProtection: true,
      mpn: "SN74LVC1G126DCKR",
      signals: ["W5500_CS_N"],
      sourceUrl: "https://www.ti.com/product/SN74LVC1G126/part-details/SN74LVC1G126DCKR"
    }
  ],
  moduleInputStates: {
    W5500_MISO:
      "100 kOhm module-side pull-down to module GND prevents the LVC2G126 input floating while W5500 chip select is high",
    W5500_INT_N: "active-low push-pull W5500 output; no module-side pull claims open-drain behavior"
  },
  moduleIoEnable: {
    drive:
      "TPS389033DSER open-drain RESET_N with 10 kOhm pull-up to COMM_3V3; RESET_N is the only active-high enable source",
    rampDefault:
      "Every LVC126 OE input has a local 100 kOhm pull-down to module GND, so all channels remain high impedance before supervised release",
    supervisorSourceUrl: "https://www.ti.com/lit/ds/symlink/tps3890.pdf"
  },
  moduleOutputGate: {
    enable: "COMM_IO_ENABLE active-high; both OE inputs have local 100 kOhm pull-downs through COMM_3V3 ramp",
    ioOffProtection: true,
    mpn: "SN74LVC2G126DCUR",
    signals: ["W5500_MISO", "W5500_INT_N"],
    sourceUrl: "https://www.ti.com/lit/ds/symlink/sn74lvc2g126.pdf"
  },
  resetCombiner: {
    externalRequest:
      "Reserved test-only COMM_RESET_ASSERT may be driven only from the carrier fixture pad; no application GPIO is allocated. It drives a module-local BSS138AKA gate with 100 kOhm pull-down; drain connects only to W5500_RST_N; source to module GND.",
    releaseRule:
      "W5500_RST_N may rise through its 10 kOhm COMM_3V3 pull-up only when TPS389033DSER RESET_N is released and COMM_RESET_ASSERT is low.",
    supervisorMpn: "TPS389033DSER"
  },
  statusRule:
    "COMM_PRESENT_N is test-point-only electrical presence and W5500_INT_N is polling/test-point-only because no application GPIO is allocated. COMM_PRESENT_N never enables buffers or releases W5500 reset; the module-local supervisor does both."
} as const

export const interboardReleaseGates = [
  "Keep all W5500 MDI pairs on the communications-module PCB. MDI must not traverse J_PWR, J_CTRL, J_USB2, or another inter-board harness.",
  "Select and model the communications-module V20-to-COMM_3V3 regulator, decoupling, power-good, reset sequencing, footprint, and thermal behavior.",
  "Implement module-local TPS389033DSER supervision, BSS138AKA reset assertion, SN74LVC2G126DCUR plus SN74LVC1G126DCKR input gating, and SN74LVC2G126DCUR output gating; verify IOFF behavior prevents back-power with COMM_3V3 absent.",
  "Hold every LVC126 OE low with a local 100 kOhm pull-down through COMM_3V3 ramp, drive COMM_IO_ENABLE only from supervised RESET_N, bias module-side W5500 MISO low while chip select is high, and treat W5500 INT_N as active-low push-pull.",
  "Import and independently review the exact Molex housing, header, terminal, crimp, keying, PCB footprint, solder mask, paste, courtyard, and strain-relief geometry.",
  "Obtain and lock the configured ECDP and HSEC8 Series Prints, insertion-loss/S-parameter evidence, pair assignment, latch orientation, PCB thickness, land pattern, mask, paste, and courtyard.",
  "Pass USB 2.0 high-speed eye, attach/detach, common-mode emissions, ESD, and shield-current tests on the released stack-up and 7.87 inch wire-length assembly.",
  "Verify APP_GND has no DC chassis bond and that connector metalwork bonds only to the controlled CHASSIS network.",
  "Verify J_PWR voltage drop, contact temperature, parallel-contact current sharing, eFuse startup, interruption response, and the 100 mV round-trip drop limit at 3 A and 50 C blocked vent.",
  "Perform connector retention, keying, 30-cycle Micro-Fit durability, crimp pull, vibration, service replacement, and mis-mate tests with the released enclosure.",
  "Document and verify de-energized internal service. PD/eFuse hot-plug behavior applies only at external USB-C and does not authorize energized internal mating."
] as const

export const interboardArchitectureVerdict = {
  canonicalCircuitStatus: "carrier-boundary-integrated" as const,
  integrationStatus: "integrated" as const,
  proposedPlacement:
    "Communications module: USB-C entry and PD protection, W5500 with locally generated COMM_3V3, integrated-magnetics RJ45, and chassis/shield bond. Application carrier: ESP32 and V5/V3_3 conversion.",
  reason:
    "The canonical application carrier exposes only J_PWR_CARRIER for post-eFuse 20 V and J_USB2_CARRIER for native USB 2.0. The communications module owns USB-C entry, PD/eFuse, W5500, MagJack, and MDI. Fabrication remains denied pending the controlled connector CAD, USB/Ethernet signal-integrity, power/thermal, chassis, and bench evidence.",
  releaseState: "deny" as const
}

export const interboardContract = {
  architecture: interboardArchitectureVerdict,
  communicationsPowerBoundary,
  connectors: interboardConnectors,
  controlSpecification: controlHarnessSpecification,
  controlPins: controlHarnessPins,
  powerPins: powerHarnessPins,
  powerSpecification: powerHarnessSpecification,
  releaseGates: interboardReleaseGates,
  serviceAndSequencing: serviceAndSequencingContract,
  shieldAndGround: shieldAndGroundContract,
  usb2Specification: usb2HarnessSpecification
} as const

function validateFullUniquePins(pins: readonly HarnessPin[], expectedCount: number, name: string): void {
  if (pins.length !== expectedCount) throw new RangeError(`${name} must define ${expectedCount} contacts`)
  const contacts = pins.map((pin) => pin.contact)
  if (new Set(contacts).size !== expectedCount) throw new RangeError(`${name} contacts must be unique`)
  if (!Array.from({ length: expectedCount }, (_, index) => index + 1).every((contact) => contacts.includes(contact))) {
    throw new RangeError(`${name} contacts must be complete and contiguous`)
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isExactValue(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return actual.length === expected.length && actual.every((value, index) => isExactValue(value, expected[index]))
  }
  if (!(isPlainRecord(actual) && isPlainRecord(expected))) return false
  const actualKeys = Object.keys(actual).sort()
  const expectedKeys = Object.keys(expected).sort()
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index] && isExactValue(actual[key], expected[key]))
  )
}

export function validateInterboardContract(input: unknown): void {
  if (!isExactValue(input, interboardContract)) {
    throw new RangeError("Inter-board contract must exactly match the reviewed fail-closed contract")
  }

  const [power, usb2, control] = interboardConnectors
  if (power.function !== "power" || usb2.function !== "usb2" || control.function !== "control") {
    throw new RangeError("Every inter-board function needs one connector contract")
  }
  if (!power.exactOrderableParts.includes("Molex 43030-0007")) {
    throw new RangeError("Power contract must select the 20 AWG-capable terminal")
  }
  if (!usb2.exactOrderableParts.includes(`Samtec ${usb2HarnessSpecification.cableMpn}`)) {
    throw new RangeError("USB contract cable MPN and structured specification must match")
  }
  if (!usb2.exactOrderableParts.includes(`Samtec ${usb2HarnessSpecification.socketMpn} (quantity 2)`)) {
    throw new RangeError("USB contract must select two exact ECDP-latching sockets")
  }
  if (
    Math.abs(usb2HarnessSpecification.nominalWireLengthIn * 25.4 - usb2HarnessSpecification.nominalWireLengthMm) > 0.1
  ) {
    throw new RangeError("USB cable inch and millimetre wire lengths disagree")
  }
  if (
    Math.abs(
      (usb2HarnessSpecification.nominalWireLengthIn + 0.69) * 25.4 - usb2HarnessSpecification.nominalOverallLengthMm
    ) > 0.1
  ) {
    throw new RangeError("USB overall length must use the Series Print wire-length plus 0.690 inch reference")
  }
  if (
    usb2HarnessSpecification.differentialImpedanceOhm !== 100 ||
    usb2HarnessSpecification.maximumPublishedDataRateGbps !== 14 ||
    usb2HarnessSpecification.signalGroundConductor !== "none" ||
    !usb2HarnessSpecification.differentialPairAssignment.includes("USB_DN") ||
    !usb2HarnessSpecification.differentialPairAssignment.includes("USB_DP") ||
    !usb2HarnessSpecification.shieldAssignment.includes("CHASSIS only") ||
    usb2HarnessSpecification.usbHighSpeedMbps !== 480 ||
    usb2HarnessSpecification.wireGaugeAwg !== 30
  ) {
    throw new RangeError("USB electrical and wire contract changed")
  }
  if (
    powerHarnessSpecification.maximumPlannedCurrentPerContactA * powerHarnessSpecification.contactCountPerPolarity <
    powerHarnessSpecification.apparatusSourceLimitA
  ) {
    throw new RangeError("Parallel power contacts do not carry the apparatus source limit")
  }
  if (
    powerHarnessSpecification.maximumPlannedCurrentPerContactA >= powerHarnessSpecification.contactManufacturerMaximumA
  ) {
    throw new RangeError("Planned contact current must remain below the terminal maximum")
  }
  if (
    controlHarnessSpecification.wireGaugeAwg !== 24 ||
    controlHarnessSpecification.maximumSpiClockMHz !== 10 ||
    controlHarnessSpecification.sourceSeriesOhm !== 33 ||
    controlHarnessSpecification.maximumLengthMm !== 150
  ) {
    throw new RangeError("Control harness wire, length, and signal-integrity contract changed")
  }

  validateFullUniquePins(powerHarnessPins, 4, "J_PWR")
  validateFullUniquePins(controlHarnessPins, 12, "J_CTRL")
  if (controlHarnessPins.filter((pin) => pin.assignment === "GND").length !== 5) {
    throw new RangeError("J_CTRL needs five allocated signal returns")
  }
  const presence = controlHarnessPins.find((pin) => pin.assignment === "COMM_PRESENT_N")
  if (!(presence?.rule.includes("1 kOhm") && presence.rule.includes("status only"))) {
    throw new RangeError("COMM_PRESENT_N needs a concrete status-only mating mechanism")
  }
  const gates = interboardReleaseGates.join(" ")
  for (const required of ["MDI must not traverse", "APP_GND has no DC chassis bond", "de-energized internal service"]) {
    if (!gates.includes(required)) throw new RangeError(`Missing release gate: ${required}`)
  }
  if (serviceAndSequencingContract.energizedInternalMating !== "prohibited") {
    throw new RangeError("Internal harnesses must not be hot-plugged")
  }
  if (
    communicationsPowerBoundary.moduleInputGates.length !== 2 ||
    communicationsPowerBoundary.moduleInputGates.some((gate) => gate.ioOffProtection !== true) ||
    communicationsPowerBoundary.moduleOutputGate.ioOffProtection !== true ||
    communicationsPowerBoundary.resetCombiner.supervisorMpn !== "TPS389033DSER" ||
    !communicationsPowerBoundary.statusRule.includes("never enables") ||
    !communicationsPowerBoundary.moduleInputStates.W5500_MISO.includes("100 kOhm") ||
    !communicationsPowerBoundary.moduleInputStates.W5500_INT_N.includes("push-pull") ||
    !communicationsPowerBoundary.moduleIoEnable.rampDefault.includes("100 kOhm")
  ) {
    throw new RangeError("Communications module power-off and reset boundary changed")
  }
}
