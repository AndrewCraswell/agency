/**
 * BP-010: one-board bench-prototype boundary.
 *
 * This is a planning contract for a deliberately oversized engineering board.
 * It is not a schematic, layout, order BOM, fabrication release, or a change
 * to retained production-oriented technical evidence.
 */

export type BenchPrototypeReleaseState = "deny"

export type BenchPrototypeZone = {
  readonly contents: readonly string[]
  readonly domain: "application" | "isolation" | "scoring" | "shared"
  readonly id:
    | "fixture-entry"
    | "analog-acquisition"
    | "scoring-control"
    | "isolation-corridor"
    | "application-control"
    | "power-ethernet-edge"
    | "display-edge"
  readonly position: number
}

const benchPrototypeContractDefinition = {
  architecture: {
    boardCount: 1,
    formFactor: "oversized accessible bench PCB on standoffs",
    layerEnvelope: "provisional four or six layers selected only after routing and return-path review",
    releaseState: "deny" as BenchPrototypeReleaseState,
    status: "prototype-only"
  },
  domains: {
    application: {
      ground: "APP_GND",
      owner: "ESP32-S3-WROOM-1U-N16R2",
      responsibilities: ["display", "Ethernet services", "storage", "controls", "non-authoritative replay"]
    },
    scoring: {
      ground: "SCORING_SGND",
      owner: "STM32G474RET3TR",
      responsibilities: ["acquisition", "qualification", "timing", "primary lamps", "buzzer"]
    }
  },
  isolationBoundary: {
    crossingParts: ["ISO7762FDWR", "ISO7721FDR", "NXE1S0505MC"],
    rule: "SCORING_SGND and APP_GND remain separate on every layer; only the named isolation parts cross the corridor",
    scoringAuthority:
      "STM32 scoring operates while the ESP32 is reset, unpowered, malformed, or absent; the ESP32 cannot qualify a hit or automatically reset the STM32"
  },
  coLocatedEthernet: {
    controller: "W5500",
    jack: "Würth 7499011121A",
    rule: "W5500 MDI pairs remain on this PCB between the controller and integrated-magnetics jack",
    host: "ESP32-S3-WROOM-1U-N16R2"
  },
  fixedInterfaces: {
    display: {
      manufacturer: "Adafruit Industries",
      productId: "2277",
      productName: "64x32 RGB LED Matrix - 5mm pitch",
      scan: "1/16",
      interface: "13 buffered HUB75 signals plus separately protected 5 V branch"
    },
    diagnosticInjection: {
      boardHeaderMpn: "Molex 43045-0400",
      mateHousingMpn: "Molex 43025-0400",
      terminalMpn: "Molex 43030-0007",
      voltageV: 20,
      maximumCurrentA: 2.3,
      injectionNode: "LAB_POST_EFUSE_20V",
      normalProductInterface: false,
      wire: "four equal-length 20 AWG conductors",
      pins: ["LAB_20V", "LAB_20V", "LAB_RETURN", "LAB_RETURN"],
      constraint:
        "controlled bring-up injection that bypasses the normal USB-C PD controller and eFuse; de-energized mating and source switching only"
    },
    usbCPdPower: {
      normalInput: "USB-C PD SPR 20 V at 3 A from an external power adapter",
      receptacleMpn: "Amphenol 10177070-00011LF",
      controllerMpn: "Texas Instruments TPS25730ADREFR",
      ccSbuProtectionMpn: "Texas Instruments TPD4S201TRGRRQ1",
      usb2DataProtectionMpn: "Texas Instruments TPD2EUSB30DRTR",
      vbusTvsMpn: "Texas Instruments TVS2200DRVR",
      reverseProtectionMpn: "Diodes Incorporated B340A-13-F",
      efuseMpn: "Texas Instruments TPS259474ARPWR",
      supportRule:
        "populate the complete controller configuration, CC, VBUS, gate, discharge, eFuse, bypass, and connector-side protection network before schematic release",
      usb2ServiceData:
        "USB_DN and USB_DP pass through the TPD2EUSB30DRTR shunt, then one matched 22 ohm series resistor per line, before ESP32-S3-WROOM-1U-N16R2 GPIO19 and GPIO20; TPD4S201TRGRRQ1 protects CC and SBU only",
      sourceSelector: {
        manufacturer: "C&K/Littelfuse",
        mpn: "7101SYZQE",
        topology: "physical SPDT",
        commonNode: "V20_TO_V5_BUCK",
        normalPdNode: "PD_EFUSE_OUT_20V",
        diagnosticNode: "LAB_POST_EFUSE_20V",
        changeOnlyDeenergized: true,
        simultaneousSourcesProhibited: true
      }
    },
    weaponFixture: {
      boardHeaderMpn: "Molex 43045-1200",
      mateHousingMpn: "Molex 43025-1200",
      terminalMpn: "Molex 43030-0007",
      scoredConductors: [
        "LEFT_WEAPON_A",
        "LEFT_WEAPON_B",
        "LEFT_WEAPON_C",
        "RIGHT_WEAPON_A",
        "RIGHT_WEAPON_B",
        "RIGHT_WEAPON_C",
        "PISTE"
      ],
      pins: [
        "LEFT_WEAPON_A",
        "LEFT_WEAPON_B",
        "LEFT_WEAPON_C",
        "RIGHT_WEAPON_A",
        "RIGHT_WEAPON_B",
        "RIGHT_WEAPON_C",
        "PISTE",
        "PISTE_RETURN",
        "FIXTURE_RETURN_REVIEW_REQUIRED",
        "ESD_RETURN_REVIEW_REQUIRED",
        "NC",
        "NC"
      ],
      rule: "returns require schematic review; NC positions remain unpopulated; this is not a production body-cord connector"
    },
    stm32Debug: {
      candidateMpn: "Samtec FTSH-105-01-L-DV-007-K",
      signals: ["SWDIO", "SWCLK", "NRST", "SCORING_3V3_SENSE", "SCORING_SGND", "PIN7_OMITTED_KEY"],
      voltageConstraint: "SCORING_3V3_SENSE is sense-only; the adapter must reference SCORING_SGND"
    },
    esp32Service: {
      candidateMpn: "Samtec TSW-106-07-G-S",
      signals: ["UART_RX", "UART_TX", "BOOT_N", "MANUAL_RESET_ASSERT", "APP_3V3_SENSE", "APP_GND"],
      voltageConstraint: "3.3 V-compatible external isolated or approved-level adapter only; no 5 V TTL"
    }
  },
  planningDrawing: {
    artifactStatus: "provisional zoning coordinates; not a fabrication outline",
    units: "mm",
    envelope: { width: 300, height: 160, origin: "lower-left planning datum" },
    zones: [
      { id: "fixture-entry", xMin: 0, xMax: 35, yMin: 0, yMax: 160 },
      { id: "analog-acquisition", xMin: 35, xMax: 90, yMin: 0, yMax: 160 },
      { id: "scoring-control", xMin: 90, xMax: 145, yMin: 0, yMax: 160 },
      { id: "isolation-corridor", xMin: 145, xMax: 165, yMin: 0, yMax: 160 },
      { id: "application-control", xMin: 165, xMax: 215, yMin: 0, yMax: 160 },
      { id: "power-ethernet-edge", xMin: 215, xMax: 300, yMin: 60, yMax: 160 },
      { id: "display-edge", xMin: 215, xMax: 300, yMin: 0, yMax: 60 }
    ],
    connectorCoordinates: [
      { id: "J_LAB_INJECTION", edge: "top", x: 235, y: 160 },
      { id: "J_USB_C", edge: "right", x: 300, y: 90 },
      { id: "J_WEAPON_FIXTURE", edge: "left", x: 0, y: 80 },
      { id: "J_PRIMARY_OUTPUTS", edge: "left", x: 0, y: 130 },
      { id: "J_STM_SWD", edge: "top", x: 118, y: 160 },
      { id: "J_ESP_SERVICE", edge: "top", x: 192, y: 160 },
      { id: "J_ETHERNET_MAGJACK", edge: "right", x: 300, y: 130 },
      { id: "J_HUB75", edge: "right", x: 300, y: 30 }
    ]
  },
  connectorEdges: [
    {
      edge: "top",
      id: "J_LAB_INJECTION",
      purpose: "mutually exclusive regulated 20 V, 2.3 A maximum diagnostic injection that bypasses USB-C PD/eFuse"
    },
    {
      edge: "right",
      id: "J_USB_C",
      purpose: "normal USB-C PD power-adapter input and USB 2.0 ESP32 service"
    },
    {
      edge: "left",
      id: "J_WEAPON_FIXTURE",
      purpose: "external body-cord and piste fixture harness"
    },
    {
      edge: "left",
      id: "J_PRIMARY_OUTPUTS",
      purpose: "primary lamps and buzzer bench harness"
    },
    {
      edge: "top",
      id: "J_STM_SWD",
      purpose: "STM32 program, reset, recover, and observe header"
    },
    {
      edge: "top",
      id: "J_ESP_SERVICE",
      purpose: "ESP32 UART, boot, reset, recover, and observe header"
    },
    {
      edge: "right",
      id: "J_ETHERNET_MAGJACK",
      purpose: "board-edge Ethernet integrated-magnetics RJ45"
    },
    {
      edge: "right",
      id: "J_HUB75",
      purpose: "external 64-by-32 HUB75 display signal and protected power connection"
    }
  ],
  probeZones: {
    required: [
      "bench input, application, scoring, and display current-measurement links",
      "application and scoring rail test points",
      "reference, analog stage, and seven fixture-line test points",
      "STM32 and ESP32 reset, watchdog, heartbeat, and isolated SPI test points",
      "W5500 reset, clock, link, and shield-node test points",
      "HUB75 enable and buffered-signal test points"
    ],
    rule: "Every listed point is labeled and probe-accessible without removing a populated part"
  },
  zones: [
    {
      contents: ["fixture connector", "connector-adjacent protection"],
      domain: "shared",
      id: "fixture-entry",
      position: 1
    },
    {
      contents: ["option-selectable analog acquisition", "REF5025AQDRQ1 domain"],
      domain: "scoring",
      id: "analog-acquisition",
      position: 2
    },
    {
      contents: ["STM32G474RET3TR", "scoring watchdog and supervisor", "SWD", "primary lamp and buzzer outputs"],
      domain: "scoring",
      id: "scoring-control",
      position: 3
    },
    {
      contents: ["ISO7762FDWR", "ISO7721FDR", "NXE1S0505MC"],
      domain: "isolation",
      id: "isolation-corridor",
      position: 4
    },
    {
      contents: [
        "ESP32-S3-WROOM-1U-N16R2",
        "application watchdog and supervisor",
        "service header",
        "storage and audio"
      ],
      domain: "application",
      id: "application-control",
      position: 5
    },
    {
      contents: [
        "Amphenol 10177070-00011LF",
        "TPS25730ADREFR and complete configuration network",
        "TPD4S201TRGRRQ1 CC/SBU protection, TPD2EUSB30DRTR USB 2.0 data shunt, TVS2200DRVR, B340A-13-F, and TPS259474ARPWR",
        "7101SYZQE source selector and J_LAB_INJECTION diagnostic input",
        "USB 2.0 service pair with matched 22 ohm series resistors",
        "W5500 and exact clock and support network",
        "Würth 7499011121A"
      ],
      domain: "application",
      id: "power-ethernet-edge",
      position: 6
    },
    {
      contents: ["two SN74AHCT245PWR buffers", "HUB75 signal header", "separately protected display branch"],
      domain: "application",
      id: "display-edge",
      position: 7
    }
  ],
  explicitDeferrals: [
    "enclosure, bezel, VESA mount, ingress target, cosmetic industrial design, and final connector panel",
    "miniaturization, final component density, and the production three-board split",
    "production battery or UPS and charging subsystem",
    "FIE supply-requirement reconciliation and its standards proposal",
    "FCC, CE, IEC or UL 62368-1, FIE homologation, and ESD, EFT, or surge certification",
    "final factory test coverage, panelization, coating, alternate sourcing, production programming, and factory DFM",
    "production release authority"
  ],
  productionContractRule:
    "This contract adds no production substitutions, omissions, or release claims; retained production-oriented evidence does not govern the prototype backlog."
} as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) throw new RangeError("Canonical BP-010 contract cannot contain cycles or aliases")
  seen.add(value)

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-010 contract may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }

  Object.freeze(value)
  return value
}

function isRecordObject(value: unknown): value is Record<PropertyKey, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function hasSameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen: WeakSet<object>,
  expectedSeen: WeakSet<object>
): boolean {
  const actualIsObject = typeof actual === "object" && actual !== null
  const expectedIsObject = typeof expected === "object" && expected !== null
  if (!(actualIsObject && expectedIsObject)) return Object.is(actual, expected)

  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)

  const actualIsArray = Array.isArray(actual)
  const expectedIsArray = Array.isArray(expected)
  if (actualIsArray !== expectedIsArray) return false
  if (
    actualIsArray &&
    (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype)
  ) {
    return false
  }
  if (!(actualIsArray || (isRecordObject(actual) && isRecordObject(expected)))) return false

  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol")
  ) {
    return false
  }

  for (const key of expectedKeys) {
    if (!actualKeys.includes(key)) return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      actualDescriptor === undefined ||
      expectedDescriptor === undefined ||
      !("value" in actualDescriptor) ||
      !("value" in expectedDescriptor) ||
      actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
      !hasSameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    ) {
      return false
    }
  }

  return true
}

function isExactDataGraph(actual: unknown, expected: unknown): boolean {
  return hasSameDataGraph(actual, expected, new WeakSet<object>(), new WeakSet<object>())
}

export const benchPrototypeContract = deepFreeze(benchPrototypeContractDefinition)

/** Rejects any altered, incomplete, or production-relaxing BP-010 contract. */
export function validateBenchPrototypeContract(input: unknown): true {
  if (!isExactDataGraph(input, benchPrototypeContract)) {
    throw new RangeError("Bench prototype contract must exactly match the reviewed BP-010 boundary")
  }

  const contract = benchPrototypeContract
  if (
    contract.architecture.boardCount !== 1 ||
    contract.architecture.releaseState !== "deny" ||
    contract.architecture.status !== "prototype-only" ||
    !contract.architecture.formFactor.includes("accessible") ||
    !contract.architecture.layerEnvelope.includes("four or six")
  ) {
    throw new RangeError("BP-010 must remain a denied, accessible, single-board prototype contract")
  }

  if (
    contract.domains.scoring.owner !== "STM32G474RET3TR" ||
    contract.domains.application.owner !== "ESP32-S3-WROOM-1U-N16R2" ||
    contract.domains.scoring.ground !== "SCORING_SGND" ||
    contract.domains.application.ground !== "APP_GND" ||
    !contract.isolationBoundary.rule.includes("separate on every layer") ||
    !contract.isolationBoundary.scoringAuthority.includes("cannot qualify a hit")
  ) {
    throw new RangeError("Scoring authority and the electrical isolation boundary must remain intact")
  }

  const crossings = contract.isolationBoundary.crossingParts
  const expectedCrossings = ["ISO7762FDWR", "ISO7721FDR", "NXE1S0505MC"] as const
  if (crossings.length !== 3 || !expectedCrossings.every((part) => crossings.includes(part))) {
    throw new RangeError("Only the selected digital isolators and isolated supply may cross the bench boundary")
  }

  if (
    contract.coLocatedEthernet.controller !== "W5500" ||
    contract.coLocatedEthernet.jack !== "Würth 7499011121A" ||
    contract.coLocatedEthernet.host !== "ESP32-S3-WROOM-1U-N16R2" ||
    !contract.coLocatedEthernet.rule.includes("remain on this PCB")
  ) {
    throw new RangeError("The W5500 and selected integrated-magnetics jack must remain co-located on the bench PCB")
  }

  const expectedConnectors = [
    "J_LAB_INJECTION",
    "J_USB_C",
    "J_WEAPON_FIXTURE",
    "J_PRIMARY_OUTPUTS",
    "J_STM_SWD",
    "J_ESP_SERVICE",
    "J_ETHERNET_MAGJACK",
    "J_HUB75"
  ]
  if (
    contract.connectorEdges.length !== expectedConnectors.length ||
    !expectedConnectors.every((connector, index) => contract.connectorEdges[index]?.id === connector) ||
    contract.connectorEdges.filter((connector) => connector.edge === "left").length !== 2 ||
    contract.connectorEdges.filter((connector) => connector.edge === "right").length !== 3 ||
    contract.connectorEdges.filter((connector) => connector.edge === "top").length !== 3
  ) {
    throw new RangeError("Bench fixture, service, Ethernet, and display connector edges changed")
  }

  const expectedZones: Array<BenchPrototypeZone["id"]> = [
    "fixture-entry",
    "analog-acquisition",
    "scoring-control",
    "isolation-corridor",
    "application-control",
    "power-ethernet-edge",
    "display-edge"
  ]
  if (
    contract.zones.length !== expectedZones.length ||
    !contract.zones.every((zone, index) => zone.id === expectedZones[index] && zone.position === index + 1) ||
    contract.zones[3]?.domain !== "isolation" ||
    !contract.zones[5]?.contents.includes("Amphenol 10177070-00011LF") ||
    !contract.zones[5]?.contents.includes("W5500 and exact clock and support network") ||
    !contract.zones[5]?.contents.includes("Würth 7499011121A") ||
    !contract.zones[6]?.contents.includes("two SN74AHCT245PWR buffers")
  ) {
    throw new RangeError("The provisional zone order or its isolation, Ethernet, or display placement changed")
  }

  const drawing = contract.planningDrawing
  const powerEthernetZone = drawing.zones[5]
  const displayZone = drawing.zones[6]
  const usbConnector = drawing.connectorCoordinates.find((connector) => connector.id === "J_USB_C")
  const ethernetConnector = drawing.connectorCoordinates.find((connector) => connector.id === "J_ETHERNET_MAGJACK")
  const displayConnector = drawing.connectorCoordinates.find((connector) => connector.id === "J_HUB75")
  if (
    drawing.artifactStatus !== "provisional zoning coordinates; not a fabrication outline" ||
    drawing.units !== "mm" ||
    drawing.envelope.width !== 300 ||
    drawing.envelope.height !== 160 ||
    drawing.zones.length !== contract.zones.length ||
    !drawing.zones
      .slice(0, 5)
      .every(
        (zone, index) =>
          zone.id === expectedZones[index] &&
          zone.xMin === (index === 0 ? 0 : drawing.zones[index - 1]?.xMax) &&
          zone.xMax > zone.xMin &&
          zone.yMin === 0 &&
          zone.yMax === drawing.envelope.height
      ) ||
    drawing.zones[3]?.xMax - drawing.zones[3]?.xMin !== 20 ||
    powerEthernetZone?.id !== "power-ethernet-edge" ||
    powerEthernetZone.xMin !== drawing.zones[4]?.xMax ||
    powerEthernetZone.xMax !== drawing.envelope.width ||
    powerEthernetZone.yMin !== 60 ||
    powerEthernetZone.yMax !== drawing.envelope.height ||
    displayZone?.id !== "display-edge" ||
    displayZone.xMin !== powerEthernetZone.xMin ||
    displayZone.xMax !== drawing.envelope.width ||
    displayZone.yMin !== 0 ||
    displayZone.yMax !== powerEthernetZone.yMin ||
    usbConnector?.x !== powerEthernetZone.xMax ||
    usbConnector.y < powerEthernetZone.yMin ||
    usbConnector.y > powerEthernetZone.yMax ||
    ethernetConnector?.x !== powerEthernetZone.xMax ||
    ethernetConnector.y < powerEthernetZone.yMin ||
    ethernetConnector.y > powerEthernetZone.yMax ||
    displayConnector?.x !== displayZone.xMax ||
    displayConnector.y < displayZone.yMin ||
    displayConnector.y > displayZone.yMax ||
    drawing.connectorCoordinates.length !== contract.connectorEdges.length ||
    !drawing.connectorCoordinates.every(
      (connector, index) =>
        connector.id === contract.connectorEdges[index]?.id &&
        connector.edge === contract.connectorEdges[index]?.edge &&
        ((connector.edge === "left" && connector.x === 0) ||
          (connector.edge === "right" && connector.x === drawing.envelope.width) ||
          (connector.edge === "top" && connector.y === drawing.envelope.height))
    )
  ) {
    throw new RangeError("The non-fabrication planning envelope, zone coordinates, or connector edges changed")
  }

  const interfaces = contract.fixedInterfaces
  if (
    interfaces.display.productId !== "2277" ||
    interfaces.display.scan !== "1/16" ||
    interfaces.diagnosticInjection.boardHeaderMpn !== "Molex 43045-0400" ||
    interfaces.diagnosticInjection.mateHousingMpn !== "Molex 43025-0400" ||
    interfaces.diagnosticInjection.terminalMpn !== "Molex 43030-0007" ||
    interfaces.diagnosticInjection.voltageV !== 20 ||
    interfaces.diagnosticInjection.maximumCurrentA !== 2.3 ||
    interfaces.diagnosticInjection.injectionNode !== "LAB_POST_EFUSE_20V" ||
    interfaces.diagnosticInjection.normalProductInterface !== false ||
    !interfaces.diagnosticInjection.constraint.includes("bypasses the normal USB-C PD controller and eFuse") ||
    !interfaces.diagnosticInjection.constraint.includes("de-energized") ||
    interfaces.usbCPdPower.receptacleMpn !== "Amphenol 10177070-00011LF" ||
    interfaces.usbCPdPower.controllerMpn !== "Texas Instruments TPS25730ADREFR" ||
    interfaces.usbCPdPower.ccSbuProtectionMpn !== "Texas Instruments TPD4S201TRGRRQ1" ||
    interfaces.usbCPdPower.usb2DataProtectionMpn !== "Texas Instruments TPD2EUSB30DRTR" ||
    interfaces.usbCPdPower.vbusTvsMpn !== "Texas Instruments TVS2200DRVR" ||
    interfaces.usbCPdPower.reverseProtectionMpn !== "Diodes Incorporated B340A-13-F" ||
    interfaces.usbCPdPower.efuseMpn !== "Texas Instruments TPS259474ARPWR" ||
    !interfaces.usbCPdPower.usb2ServiceData.includes("TPD2EUSB30DRTR shunt") ||
    !interfaces.usbCPdPower.usb2ServiceData.includes("one matched 22 ohm series resistor per line") ||
    !interfaces.usbCPdPower.usb2ServiceData.includes("GPIO19 and GPIO20") ||
    !interfaces.usbCPdPower.usb2ServiceData.includes("TPD4S201TRGRRQ1 protects CC and SBU only") ||
    interfaces.usbCPdPower.sourceSelector.mpn !== "7101SYZQE" ||
    interfaces.usbCPdPower.sourceSelector.topology !== "physical SPDT" ||
    interfaces.usbCPdPower.sourceSelector.normalPdNode !== "PD_EFUSE_OUT_20V" ||
    interfaces.usbCPdPower.sourceSelector.diagnosticNode !== "LAB_POST_EFUSE_20V" ||
    interfaces.usbCPdPower.sourceSelector.commonNode !== "V20_TO_V5_BUCK" ||
    interfaces.usbCPdPower.sourceSelector.changeOnlyDeenergized !== true ||
    interfaces.usbCPdPower.sourceSelector.simultaneousSourcesProhibited !== true ||
    interfaces.weaponFixture.boardHeaderMpn !== "Molex 43045-1200" ||
    interfaces.weaponFixture.mateHousingMpn !== "Molex 43025-1200" ||
    interfaces.weaponFixture.terminalMpn !== "Molex 43030-0007" ||
    interfaces.weaponFixture.scoredConductors.length !== 7 ||
    interfaces.weaponFixture.pins.length !== 12 ||
    interfaces.weaponFixture.pins.filter((pin) => pin === "NC").length !== 2 ||
    interfaces.stm32Debug.candidateMpn !== "Samtec FTSH-105-01-L-DV-007-K" ||
    interfaces.stm32Debug.signals.join(",") !== "SWDIO,SWCLK,NRST,SCORING_3V3_SENSE,SCORING_SGND,PIN7_OMITTED_KEY" ||
    !interfaces.stm32Debug.voltageConstraint.includes("sense-only") ||
    interfaces.esp32Service.candidateMpn !== "Samtec TSW-106-07-G-S" ||
    interfaces.esp32Service.signals.length !== 6 ||
    !interfaces.esp32Service.voltageConstraint.includes("no 5 V TTL")
  ) {
    throw new RangeError("The selected panel, harness, fixture, or service-header planning interface changed")
  }

  if (
    contract.probeZones.required.length !== 6 ||
    !contract.probeZones.rule.includes("without removing") ||
    !contract.explicitDeferrals.includes("production release authority") ||
    contract.explicitDeferrals.some((deferral) => deferral.includes("USB-PD")) ||
    !contract.explicitDeferrals.some((deferral) => deferral.includes("battery or UPS")) ||
    !contract.explicitDeferrals.some((deferral) => deferral.includes("FIE supply-requirement reconciliation")) ||
    !contract.productionContractRule.includes("no production substitutions")
  ) {
    throw new RangeError("BP-010 must retain probe access, explicit deferrals, and production-contract noninterference")
  }

  return true
}
