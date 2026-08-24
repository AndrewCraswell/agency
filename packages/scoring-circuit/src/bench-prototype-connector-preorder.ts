/**
 * BP-034 defines the immutable evidence needed before selected bench-board
 * connectors may be released. It never substitutes catalog data for received
 * samples, physical mates, photographs, or measured continuity.
 */

import { benchPrototypeEthernetMdi, validateBenchPrototypeEthernetMdi } from "./bench-prototype-ethernet-mdi.js"
import { parseCanonicalUtcTimestamp, parseRealUtcDate } from "./bench-prototype-evidence-time.js"
import {
  benchPrototypeFixtureHarness,
  benchPrototypeContinuityThresholds,
  evaluateBenchPrototypeContinuityEvidence,
  validateBenchPrototypeFixtureHarness,
  type BenchPrototypeContinuityEvidence
} from "./bench-prototype-fixture-harness.js"
import {
  benchPrototypeHub75Connector,
  validateBenchPrototypeHub75Connector
} from "./bench-prototype-hub75-connector.js"
import { calculateBenchPrototypePowerContract, defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"
import {
  benchPrototypeServiceHeaders,
  validateBenchPrototypeServiceHeaders
} from "./bench-prototype-service-headers.js"

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-034 cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) throw new RangeError("BP-034 allows data only")
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

const component = (manufacturer: string, mpn: string, quantity: number) => ({ manufacturer, mpn, quantity })
const measurement = (id: string, from: string, to: string) => ({ id, from, to })
const sourceAsset = (sourceUrl: string, assetPath: string, sha256: string) => ({ sourceUrl, assetPath, sha256 })

type BenchPrototypeConnectorSampleId =
  | "usb-c-input"
  | "lab-injection"
  | "measurement-link"
  | "weapon-fixture"
  | "weapon-test-plug"
  | "stm32-service"
  | "esp32-service"
  | "ethernet-magjack"
  | "hub75-signal"
  | "hub75-panel-power"

type ConnectorSampleSelection =
  | { readonly selectionState: "exact"; readonly selectionBlocker: null }
  | { readonly selectionState: "blocked"; readonly selectionBlocker: string }

type RequiredConnectorSample = ConnectorSampleSelection & {
  readonly id: BenchPrototypeConnectorSampleId
  readonly interfaceReferences: readonly string[]
  readonly requiredComponents: readonly ReturnType<typeof component>[]
  readonly continuityMeasurements: readonly ReturnType<typeof measurement>[]
  readonly sourceEvidence?: ReturnType<typeof sourceAsset>
  readonly selectionBasis?: Readonly<Record<string, string | number>>
}

const measurementLinkContracts = [
  defaultBenchPrototypePowerInputs.measurementLinks.input,
  defaultBenchPrototypePowerInputs.measurementLinks.display,
  defaultBenchPrototypePowerInputs.measurementLinks.application,
  defaultBenchPrototypePowerInputs.measurementLinks.isolatedScoring
] as const

const requiredSamples: readonly RequiredConnectorSample[] = [
  {
    id: "usb-c-input",
    interfaceReferences: ["J_USB_C"],
    requiredComponents: [
      component("Amphenol Communications Solutions", "10177070-00011LF", 1),
      component("StarTech.com", "USB2CC1M", 1)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    sourceEvidence: sourceAsset(
      "https://media.startech.com/cms/pdfs/usb2cc1m_datasheet.pdf",
      "docs/evidence/bp-034/startech-usb2cc1m-datasheet.pdf",
      "AE5241D2A65A5B64F737D4205FD428B0432567EA98FA1482520AB0D9F345FAE7"
    ),
    selectionBasis: {
      cableEnds: "USB-C male to USB-C male",
      nominalLengthM: 1,
      maximumPowerW: 60,
      maximumVoltageV: 20,
      maximumCurrentA: 3,
      sourceScope:
        "The manufacturer datasheet names USB2CC1M, USB-C-to-USB-C ends, 60 W (3 A) PD, and USB-IF certification."
    },
    continuityMeasurements: [
      "A1",
      "A4",
      "A5",
      "A6",
      "A7",
      "A8",
      "A9",
      "A12",
      "B1",
      "B4",
      "B5",
      "B6",
      "B7",
      "B8",
      "B9",
      "B12"
    ].map((pin) => measurement(pin, `J_USB_C.${pin}`, `SELECTED_USB_C_CABLE.${pin}`))
  },
  {
    id: "lab-injection",
    interfaceReferences: ["J_LAB_INJECTION"],
    requiredComponents: [
      component("Molex", "43045-0400", 1),
      component("Molex", "43025-0400", 1),
      component("Molex", "43030-0007", 4)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: [
      measurement("pin-1", "J_LAB_INJECTION.1[LAB_20V]", "43025-0400.1[LAB_20V]"),
      measurement("pin-2", "J_LAB_INJECTION.2[LAB_20V]", "43025-0400.2[LAB_20V]"),
      measurement("pin-3", "J_LAB_INJECTION.3[LAB_RETURN]", "43025-0400.3[LAB_RETURN]"),
      measurement("pin-4", "J_LAB_INJECTION.4[LAB_RETURN]", "43025-0400.4[LAB_RETURN]")
    ]
  },
  {
    id: "measurement-link",
    interfaceReferences: ["J_LINK_INPUT", "J_LINK_DISPLAY", "J_LINK_APPLICATION", "J_LINK_SCORING"],
    requiredComponents: [
      component("Molex", "39-28-1023", 4),
      component("Molex", "39-01-2020", 4),
      component("Molex", "39-00-0039", 8)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: measurementLinkContracts.flatMap((link) =>
      [link.pin1Net, link.pin2Net].map((net, index) =>
        measurement(
          `${link.label}-${index + 1}`,
          `${link.label}.${index + 1}[${net}]`,
          `${link.matingHousingMpn}.${index + 1}[${net}]`
        )
      )
    )
  },
  {
    id: "weapon-fixture",
    interfaceReferences: ["J_WEAPON_FIXTURE"],
    requiredComponents: [
      component("Molex", "43045-1200", 1),
      component("Molex", "43025-1200", 1),
      component("Molex", "43030-0007", 7)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: []
  },
  {
    id: "weapon-test-plug",
    interfaceReferences: ["J_WEAPON_FIXTURE_TEST"],
    requiredComponents: [component("Molex", "44242-0005", 1), component("Molex", "43045-1200", 1)],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: []
  },
  {
    id: "stm32-service",
    interfaceReferences: ["J_STM_SWD"],
    requiredComponents: [
      component("Samtec", "FTSH-105-01-L-DV-007-K", 1),
      component("Samtec", "FFSD-05-D-06.00-01-N", 1)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: [
      [1, "SCORING_3V3_SENSE"],
      [2, "SWDIO"],
      [3, "SCORING_SGND"],
      [4, "SWCLK"],
      [5, "SCORING_SGND"],
      [6, "NC_SWD_SWO_RESERVED"],
      [8, "NC_SWD_RESERVED"],
      [9, "SCORING_SGND"],
      [10, "SCORING_NRST_N"]
    ].map(([pin, net]) => measurement(`pin-${pin}`, `J_STM_SWD.${pin}[${net}]`, `FFSD-05-D-06.00-01-N.${pin}[${net}]`))
  },
  {
    id: "esp32-service",
    interfaceReferences: ["J_ESP32_SERVICE", "J_ESP_SERVICE"],
    requiredComponents: [component("Samtec", "TSW-106-07-G-S", 1), component("Samtec", "SSW-106-01-G-S", 1)],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: ["APP_GND", "APP_3V3_SENSE", "UART0_TX", "UART0_RX", "BOOT_N", "MANUAL_RESET_ASSERT"].map(
      (net, index) =>
        measurement(`pin-${index + 1}`, `J_ESP_SERVICE.${index + 1}[${net}]`, `SSW-106-01-G-S.${index + 1}[${net}]`)
    )
  },
  {
    id: "ethernet-magjack",
    interfaceReferences: ["J_ETH"],
    requiredComponents: [
      component("Würth Elektronik", "7499011121A", 1),
      component("Eaton, Tripp Lite series", "N201-003-BL", 1)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    sourceEvidence: sourceAsset(
      "https://assets.tripplite.com/product-pdfs/en/n201003bl.pdf",
      "docs/evidence/bp-034/eaton-tripp-lite-n201-003-bl-datasheet.pdf",
      "BB81E709DFD1E57546379D2962431CD1D1C2445E038E81B053521B6231A14C12"
    ),
    selectionBasis: {
      cableEnds: "RJ45 male to RJ45 male (8P8C patch cable)",
      nominalLengthM: 0.91,
      cableCategory: "Cat6",
      sourceScope:
        "The manufacturer datasheet names N201-003-BL and states RJ45 male connectors at both ends with integral strain relief."
    },
    continuityMeasurements: [
      ...Array.from({ length: 8 }, (_, index) =>
        measurement(`8p8c-contact-${index + 1}`, `J_ETH.8P8C-${index + 1}`, `SELECTED_8P8C_TEST_MATE.8P8C-${index + 1}`)
      ),
      measurement("shield-shell", "J_ETH.SHIELD_SHELL[CHASSIS_ETHERNET]", "CHASSIS_ETHERNET")
    ]
  },
  {
    id: "hub75-signal",
    interfaceReferences: ["J_HUB75"],
    requiredComponents: [
      component("Samtec", "TST-108-04-G-D-RA", 1),
      component("Adafruit Industries", "4170", 1),
      component("Adafruit Industries", "2277", 1)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: [
      "R1",
      "G1",
      "B1",
      "GND1",
      "R2",
      "G2",
      "B2",
      "GND2",
      "A",
      "B",
      "C",
      "D",
      "CLK",
      "LAT",
      "OE",
      "GND3"
    ].map((net, index) =>
      measurement(`pin-${index + 1}`, `J_HUB75.${index + 1}[${net}]`, `Adafruit-4170.${index + 1}[${net}]`)
    )
  },
  {
    id: "hub75-panel-power",
    interfaceReferences: ["J_DISPLAY_POWER_PIGTAIL"],
    requiredComponents: [
      component("Adafruit Industries", "4767", 1),
      component("JST", "SMR-04V-N", 2),
      component("JST", "SYM-001T-P0.6", 8),
      component("JST", "SMP-04V-NC", 2),
      component("JST", "SHF-001T-0.8BS", 8),
      component("Adafruit Industries", "2277", 1)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: Array.from({ length: 2 }, (_, branch) =>
      ["V5_DISPLAY_LIMITED", "V5_DISPLAY_LIMITED", "APP_GND", "APP_GND"].map((net, pin) =>
        measurement(
          `branch-${branch + 1}-pin-${pin + 1}`,
          `J_DISPLAY_POWER_PIGTAIL.branch-${branch + 1}.${pin + 1}[${net}]`,
          `Adafruit-4767.branch-${branch + 1}.${pin + 1}[${net}]`
        )
      )
    ).flat()
  }
] as const

const sampleIds = requiredSamples.map((sample) => sample.id)
export type { BenchPrototypeConnectorSampleId }

export const benchPrototypeConnectorContinuityThresholds = deepFreeze({
  maximumContactPathResistanceOhms: 2,
  maximumLeadCompensationOhms: 0.2,
  maximumTestVoltageV: 5
})

export const benchPrototypeConnectorPreorder = deepFreeze({
  artifactKind: "bench-prototype-connector-preorder-contract",
  workUnit: "BP-034",
  targetAssembly: "one-board bench prototype",
  prototypeOnly: true,
  fabricationDisposition: "DENY",
  releaseState: "deny",
  samples: requiredSamples,
  weaponFixtureContinuityAuthority: {
    contract: "BP-104",
    requiredReadings: "7 end-to-end, 66 isolation, and 5 intentional-open",
    thresholds: benchPrototypeContinuityThresholds,
    delegatedArtifacts: {
      procedure: "benchPrototypeFixtureHarness.connector.sampleFitProcedure",
      continuityAndCalibration: "evaluateBenchPrototypeContinuityEvidence",
      physicalFitAndNegativeTests: "evaluateBenchPrototypeFixturePhysicalEvidence"
    }
  },
  openGates: [
    "No physical sample, mate, immutable artifact, retention observation, strain observation, or continuity record is claimed.",
    "The USB-C and Ethernet cable selections are source-backed only; receipt, fit, continuity, retention, strain, SI/EMC, CAD/artwork, and release evidence remain open.",
    "Passing BP-034 does not clear the electrical, isolation, recovery, inrush, thermal, or fabrication gates held upstream."
  ]
})

type ConnectorUpstreamProvenance = {
  readonly bp050: unknown
  readonly bp104: unknown
  readonly bp124: unknown
  readonly bp141: unknown
  readonly bp143: unknown
}

const upstreamProvenanceDefinition = {
  bp050: {
    workUnit: "BP-050",
    displayDisconnectReference: "J_DISPLAY_DISCONNECT",
    normalInput: {
      receptacleMpn: "10177070-00011LF",
      contractVoltageV: 20,
      contractCurrentA: 3,
      requestedMinimumVoltageV: 20,
      requestedMaximumVoltageV: 20,
      sinkOnly: true
    },
    labInjection: {
      connectorMpn: "43045-0400",
      matingHousingMpn: "43025-0400",
      terminalMpn: "43030-0007",
      pin1Net: "LAB_20V",
      pin2Net: "LAB_20V",
      pin3Net: "LAB_RETURN",
      pin4Net: "LAB_RETURN"
    },
    measurementLinks: [
      {
        label: "J_LINK_INPUT",
        boardHeaderMpn: "39-28-1023",
        matingHousingMpn: "39-01-2020",
        terminalMpn: "39-00-0039",
        pin1Net: "V20_TO_V5_BUCK",
        pin2Net: "V20_BUCK_INPUT",
        contactProjectScreenA: 6
      },
      {
        label: "J_LINK_DISPLAY",
        boardHeaderMpn: "39-28-1023",
        matingHousingMpn: "39-01-2020",
        terminalMpn: "39-00-0039",
        pin1Net: "V5_DISPLAY_LIMITED",
        pin2Net: "V5_DISPLAY_LOAD",
        contactProjectScreenA: 6
      },
      {
        label: "J_LINK_APPLICATION",
        boardHeaderMpn: "39-28-1023",
        matingHousingMpn: "39-01-2020",
        terminalMpn: "39-00-0039",
        pin1Net: "V5",
        pin2Net: "V5_APPLICATION",
        contactProjectScreenA: 6
      },
      {
        label: "J_LINK_SCORING",
        boardHeaderMpn: "39-28-1023",
        matingHousingMpn: "39-01-2020",
        terminalMpn: "39-00-0039",
        pin1Net: "V5",
        pin2Net: "V5_SCORING_ISOLATOR_INPUT",
        contactProjectScreenA: 6
      }
    ],
    authority: {
      displayConnectedPermit: "deny-until-inrush-measured",
      physicalPresenceVerified: false,
      releaseState: "deny"
    }
  },
  bp104: {
    artifactKind: "bench-prototype-fixture-harness-contract",
    workUnit: "BP-104",
    targetAssembly: "one-board bench prototype",
    prototypeOnly: true,
    schematicInputOnly: true,
    fabricationDisposition: "DENY",
    releaseState: "deny",
    connector: {
      boardReference: "J_WEAPON_FIXTURE",
      header: {
        manufacturer: "Molex",
        mpn: "43045-1200",
        positions: 12,
        rows: 2,
        pitchMm: 3
      },
      mate: {
        manufacturer: "Molex",
        mpn: "43025-1200",
        positions: 12,
        rows: 2,
        pitchMm: 3,
        terminalMpn: "43030-0007"
      },
      testPlug: {
        manufacturer: "Molex",
        mpn: "44242-0005",
        materialNumber: "442420005",
        positions: 12,
        rows: 2,
        pitchMm: 3
      },
      conductorOrder: [
        "LEFT_WEAPON_A",
        "LEFT_WEAPON_B",
        "LEFT_WEAPON_C",
        "RIGHT_WEAPON_A",
        "RIGHT_WEAPON_B",
        "RIGHT_WEAPON_C",
        "PISTE"
      ],
      continuityAcceptance: {
        status: "unresolved",
        testPlugMpn: "44242-0005",
        maxEndToEndResistanceOhms: 2,
        minimumIsolationResistanceOhms: 10_000_000,
        isolationTestVoltageV: 5,
        maximumLeadCompensationOhms: 0.2
      },
      physicalEvidenceAcceptanceStatus: "unresolved",
      authority: {
        exactSelectionFrozen: true,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    }
  },
  bp124: {
    artifactKind: "bench-prototype-service-header-contract",
    workUnit: "BP-124",
    targetAssembly: "one-board bench prototype",
    prototypeOnly: true,
    schematicInputOnly: true,
    fabricationDisposition: "DENY",
    releaseState: "deny",
    stm32: {
      reference: "J_STM_SWD",
      bomReference: "J_STM32_SWD",
      headerMpn: "FTSH-105-01-L-DV-007-K",
      matingCableMpn: "FFSD-05-D-06.00-01-N",
      omittedPins: [7],
      pinout: [
        { pin: 1, net: "SCORING_3V3_SENSE" },
        { pin: 2, net: "SWDIO" },
        { pin: 3, net: "SCORING_SGND" },
        { pin: 4, net: "SWCLK" },
        { pin: 5, net: "SCORING_SGND" },
        { pin: 6, net: "NC_SWD_SWO_RESERVED" },
        { pin: 8, net: "NC_SWD_RESERVED" },
        { pin: 9, net: "SCORING_SGND" },
        { pin: 10, net: "SCORING_NRST_N" }
      ]
    },
    esp32: {
      reference: "J_ESP_SERVICE",
      bomReference: "J_ESP32_SERVICE",
      headerMpn: "TSW-106-07-G-S",
      matingSocketMpn: "SSW-106-01-G-S",
      pinout: [
        { pin: 1, net: "APP_GND" },
        { pin: 2, net: "APP_3V3_SENSE" },
        { pin: 3, net: "UART0_TX" },
        { pin: 4, net: "UART0_RX" },
        { pin: 5, net: "BOOT_N" },
        { pin: 6, net: "MANUAL_RESET_ASSERT" }
      ]
    }
  },
  bp141: {
    artifactKind: "bench-prototype-w5500-mdi-contract",
    targetAssembly: "one-board bench prototype",
    prototypeOnly: true,
    integrationRelease: false,
    fabricationRelease: false,
    layoutRelease: false,
    benchValidationRelease: false,
    releaseState: "deny",
    controller: { reference: "U_W5500", manufacturer: "WIZnet", mpn: "W5500" },
    magJack: { reference: "J_ETH", manufacturer: "Würth Elektronik", mpn: "7499011121A" },
    mdiPairs: [
      { controllerEndpoint: "U_W5500.TXP", controllerPad: 2, jackEndpoint: "J_ETH.TD+", jackPin: 1, net: "ETH_TX_P" },
      { controllerEndpoint: "U_W5500.TXN", controllerPad: 1, jackEndpoint: "J_ETH.TD-", jackPin: 3, net: "ETH_TX_N" },
      { controllerEndpoint: "U_W5500.RXP", controllerPad: 6, jackEndpoint: "J_ETH.RD+", jackPin: 4, net: "ETH_RX_P" },
      { controllerEndpoint: "U_W5500.RXN", controllerPad: 5, jackEndpoint: "J_ETH.RD-", jackPin: 6, net: "ETH_RX_N" }
    ],
    shieldAndEsdReturn: {
      chassisNet: "CHASSIS_ETHERNET",
      endpoints: ["J_ETH.8", "J_ETH.S1", "J_ETH.S2"]
    },
    noMdiHarnessCrossing: false
  },
  bp143: {
    artifactKind: "bench-prototype-hub75-connector-contract",
    task: "BP-143",
    targetAssembly: "one-board bench prototype",
    prototypeOnly: true,
    schematicInputOnly: true,
    layoutRelease: false,
    fabricationRelease: false,
    fabricationDisposition: "DENY",
    releaseState: "deny",
    boardConnector: {
      reference: "J_HUB75",
      manufacturer: "Samtec",
      mpn: "TST-108-04-G-D-RA",
      positions: 16,
      rows: 2,
      pitchMm: 2.54
    },
    signalCable: {
      manufacturer: "Adafruit Industries",
      productId: "4170",
      quantity: 1,
      conductorCount: 16,
      panelConnection: "panel HUB75 INPUT only; panel OUTPUT remains unconnected"
    },
    powerCable: {
      manufacturer: "Adafruit Industries",
      productId: "4767",
      quantity: 1,
      panelSideHousingMpn: "SMR-04V-N",
      panelSideContactMpn: "SYM-001T-P0.6",
      cableSideHousingMpn: "SMP-04V-NC",
      cableSideContactMpn: "SHF-001T-0.8BS",
      contactCurrentRatingA: 3,
      parallelPowerContactsPerConnector: 2,
      minimumConnectedPowerBranches: 2
    },
    panel: {
      manufacturer: "Adafruit Industries",
      productId: "2277",
      inputHeader: "one keyed 16-position IDC connector",
      separatePowerRequired: true
    },
    powerPath: {
      supplyNet: "V5_DISPLAY_LIMITED",
      returnNet: "APP_GND",
      displayDisconnectReference: "J_DISPLAY_DISCONNECT",
      measurementLinkReference: "J_LINK_DISPLAY"
    },
    authority: {
      exactSelectionFrozen: true,
      schematicIntegrationApproved: false,
      footprintApproved: false,
      layoutApproved: false,
      purchasedPanelVerified: false,
      continuityVerified: false,
      currentRatingVerified: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    }
  }
} as const

export const benchPrototypeConnectorUpstreamProvenance = deepFreeze(upstreamProvenanceDefinition)

function sameDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)
  const expectedArray = Array.isArray(expected)
  if (Array.isArray(actual) !== expectedArray) return false
  if (expectedArray) {
    if (!Array.isArray(actual) || !Array.isArray(expected) || Object.getPrototypeOf(actual) !== Array.prototype) {
      return false
    }
    const expectedKeys = Array.from({ length: expected.length }, (_, index) => String(index)).concat("length")
    const actualKeys = Reflect.ownKeys(actual)
    if (actual.length !== expected.length || actualKeys.length !== expectedKeys.length) return false
    if (actualKeys.some((key, index) => key !== expectedKeys[index])) return false
    return expected.every((entry, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(actual, String(index))
      return (
        descriptor !== undefined &&
        "value" in descriptor &&
        descriptor.enumerable &&
        sameDataGraph(descriptor.value, entry, seen)
      )
    })
  }
  if (Object.getPrototypeOf(actual) !== Object.prototype || Object.getPrototypeOf(expected) !== Object.prototype) {
    return false
  }
  const expectedKeys = Reflect.ownKeys(expected)
  const actualKeys = Reflect.ownKeys(actual)
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index]))
    return false
  return expectedKeys.every((key) => {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return (
      actualDescriptor !== undefined &&
      expectedDescriptor !== undefined &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
    )
  })
}

function measurementLinkProvenance(
  link: (typeof defaultBenchPrototypePowerInputs.measurementLinks)[keyof typeof defaultBenchPrototypePowerInputs.measurementLinks]
) {
  return {
    label: link.label,
    boardHeaderMpn: link.boardHeaderMpn,
    matingHousingMpn: link.matingHousingMpn,
    terminalMpn: link.terminalMpn,
    pin1Net: link.pin1Net,
    pin2Net: link.pin2Net,
    contactProjectScreenA: link.contactProjectScreenA
  }
}

function currentUpstreamProvenance(): ConnectorUpstreamProvenance {
  const powerResult = calculateBenchPrototypePowerContract(defaultBenchPrototypePowerInputs)
  const fixture = benchPrototypeFixtureHarness.connector
  const service = benchPrototypeServiceHeaders
  const mdi = benchPrototypeEthernetMdi
  const hub75 = benchPrototypeHub75Connector
  return {
    bp050: {
      workUnit: "BP-050",
      displayDisconnectReference: defaultBenchPrototypePowerInputs.displayDisconnectReference,
      normalInput: {
        receptacleMpn: defaultBenchPrototypePowerInputs.normalInput.parts.receptacleMpn,
        contractVoltageV: defaultBenchPrototypePowerInputs.normalInput.contractVoltageV,
        contractCurrentA: defaultBenchPrototypePowerInputs.normalInput.contractCurrentA,
        requestedMinimumVoltageV: defaultBenchPrototypePowerInputs.normalInput.requestedMinimumVoltageV,
        requestedMaximumVoltageV: defaultBenchPrototypePowerInputs.normalInput.requestedMaximumVoltageV,
        sinkOnly: defaultBenchPrototypePowerInputs.normalInput.sinkOnly
      },
      labInjection: {
        connectorMpn: defaultBenchPrototypePowerInputs.labInjection.connectorMpn,
        matingHousingMpn: defaultBenchPrototypePowerInputs.labInjection.matingHousingMpn,
        terminalMpn: defaultBenchPrototypePowerInputs.labInjection.terminalMpn,
        pin1Net: defaultBenchPrototypePowerInputs.labInjection.pin1Net,
        pin2Net: defaultBenchPrototypePowerInputs.labInjection.pin2Net,
        pin3Net: defaultBenchPrototypePowerInputs.labInjection.pin3Net,
        pin4Net: defaultBenchPrototypePowerInputs.labInjection.pin4Net
      },
      measurementLinks: [
        measurementLinkProvenance(defaultBenchPrototypePowerInputs.measurementLinks.input),
        measurementLinkProvenance(defaultBenchPrototypePowerInputs.measurementLinks.display),
        measurementLinkProvenance(defaultBenchPrototypePowerInputs.measurementLinks.application),
        measurementLinkProvenance(defaultBenchPrototypePowerInputs.measurementLinks.isolatedScoring)
      ],
      authority: {
        displayConnectedPermit: powerResult.displayConnectedPermit,
        physicalPresenceVerified: powerResult.physicalPresenceVerified,
        releaseState: powerResult.releaseState
      }
    },
    bp104: {
      artifactKind: benchPrototypeFixtureHarness.artifactKind,
      workUnit: benchPrototypeFixtureHarness.workUnit,
      targetAssembly: benchPrototypeFixtureHarness.targetAssembly,
      prototypeOnly: benchPrototypeFixtureHarness.prototypeOnly,
      schematicInputOnly: benchPrototypeFixtureHarness.schematicInputOnly,
      fabricationDisposition: benchPrototypeFixtureHarness.fabricationDisposition,
      releaseState: benchPrototypeFixtureHarness.releaseState,
      connector: {
        boardReference: fixture.boardReference,
        header: {
          manufacturer: fixture.header.manufacturer,
          mpn: fixture.header.mpn,
          positions: fixture.header.positions,
          rows: fixture.header.rows,
          pitchMm: fixture.header.pitchMm
        },
        mate: {
          manufacturer: fixture.mate.manufacturer,
          mpn: fixture.mate.mpn,
          positions: fixture.mate.positions,
          rows: fixture.mate.rows,
          pitchMm: fixture.mate.pitchMm,
          terminalMpn: fixture.mate.terminalMpn
        },
        testPlug: {
          manufacturer: fixture.testPlug.manufacturer,
          mpn: fixture.testPlug.mpn,
          materialNumber: fixture.testPlug.materialNumber,
          positions: fixture.testPlug.positions,
          rows: fixture.testPlug.rows,
          pitchMm: fixture.testPlug.pitchMm
        },
        conductorOrder: [...fixture.conductorOrder],
        continuityAcceptance: {
          status: fixture.continuityAcceptance.status,
          testPlugMpn: fixture.continuityAcceptance.testPlugMpn,
          maxEndToEndResistanceOhms: fixture.continuityAcceptance.thresholds.maxEndToEndResistanceOhms,
          minimumIsolationResistanceOhms: fixture.continuityAcceptance.thresholds.minimumIsolationResistanceOhms,
          isolationTestVoltageV: fixture.continuityAcceptance.thresholds.isolationTestVoltageV,
          maximumLeadCompensationOhms: fixture.continuityAcceptance.thresholds.maximumLeadCompensationOhms
        },
        physicalEvidenceAcceptanceStatus: fixture.physicalEvidenceAcceptance.status,
        authority: {
          exactSelectionFrozen: benchPrototypeFixtureHarness.authority.exactSelectionFrozen,
          fabricationAuthorized: benchPrototypeFixtureHarness.authority.fabricationAuthorized,
          releaseState: benchPrototypeFixtureHarness.authority.releaseState
        }
      }
    },
    bp124: {
      artifactKind: service.artifactKind,
      workUnit: service.workUnit,
      targetAssembly: service.targetAssembly,
      prototypeOnly: service.prototypeOnly,
      schematicInputOnly: service.schematicInputOnly,
      fabricationDisposition: service.fabricationDisposition,
      releaseState: service.releaseState,
      stm32: {
        reference: service.stm32.reference,
        bomReference: service.stm32.bomReference,
        headerMpn: service.stm32.header.mpn,
        matingCableMpn: service.stm32.matingCable.mpn,
        omittedPins: [...service.stm32.omittedPins],
        pinout: service.stm32.pinout.map((pin) => ({ pin: pin.pin, net: pin.net }))
      },
      esp32: {
        reference: service.esp32.reference,
        bomReference: service.esp32.bomReference,
        headerMpn: service.esp32.header.mpn,
        matingSocketMpn: service.esp32.header.matingSocket.mpn,
        pinout: service.esp32.pinout.map((pin) => ({ pin: pin.pin, net: pin.net }))
      }
    },
    bp141: {
      artifactKind: mdi.artifactKind,
      targetAssembly: mdi.targetAssembly,
      prototypeOnly: mdi.prototypeOnly,
      integrationRelease: mdi.integrationRelease,
      fabricationRelease: mdi.fabricationRelease,
      layoutRelease: mdi.layoutRelease,
      benchValidationRelease: mdi.benchValidationRelease,
      releaseState: mdi.releaseState,
      controller: { ...mdi.controller },
      magJack: { ...mdi.magJack },
      mdiPairs: mdi.mdiPairs.map((pair) => ({
        controllerEndpoint: pair.controllerEndpoint,
        controllerPad: pair.controllerPad,
        jackEndpoint: pair.jackEndpoint,
        jackPin: pair.jackPin,
        net: pair.net
      })),
      shieldAndEsdReturn: {
        chassisNet: mdi.shieldAndEsdReturn.chassisNet,
        endpoints: [...mdi.shieldAndEsdReturn.endpoints]
      },
      noMdiHarnessCrossing: mdi.noMdiHarnessCrossing.externalMdiHarness
    },
    bp143: {
      artifactKind: hub75.artifactKind,
      task: hub75.task,
      targetAssembly: hub75.targetAssembly,
      prototypeOnly: hub75.prototypeOnly,
      schematicInputOnly: hub75.schematicInputOnly,
      layoutRelease: hub75.layoutRelease,
      fabricationRelease: hub75.fabricationRelease,
      fabricationDisposition: hub75.fabricationDisposition,
      releaseState: hub75.releaseState,
      boardConnector: {
        reference: hub75.boardConnector.reference,
        manufacturer: hub75.boardConnector.manufacturer,
        mpn: hub75.boardConnector.mpn,
        positions: hub75.boardConnector.positions,
        rows: hub75.boardConnector.rows,
        pitchMm: hub75.boardConnector.pitchMm
      },
      signalCable: {
        manufacturer: hub75.signalCable.manufacturer,
        productId: hub75.signalCable.productId,
        quantity: hub75.signalCable.quantity,
        conductorCount: hub75.signalCable.conductorCount,
        panelConnection: hub75.signalCable.panelConnection
      },
      powerCable: {
        manufacturer: hub75.powerCable.manufacturer,
        productId: hub75.powerCable.productId,
        quantity: hub75.powerCable.quantity,
        panelSideHousingMpn: hub75.powerCable.panelSideHousingMpn,
        panelSideContactMpn: hub75.powerCable.panelSideContactMpn,
        cableSideHousingMpn: hub75.powerCable.cableSideHousingMpn,
        cableSideContactMpn: hub75.powerCable.cableSideContactMpn,
        contactCurrentRatingA: hub75.powerCable.contactCurrentRatingA,
        parallelPowerContactsPerConnector: hub75.powerCable.parallelPowerContactsPerConnector,
        minimumConnectedPowerBranches: hub75.powerCable.minimumConnectedPowerBranches
      },
      panel: {
        manufacturer: hub75.panel.manufacturer,
        productId: hub75.panel.productId,
        inputHeader: hub75.panel.inputHeader,
        separatePowerRequired: hub75.panel.separatePowerRequired
      },
      powerPath: {
        supplyNet: hub75.powerPath.supplyNet,
        returnNet: hub75.powerPath.returnNet,
        displayDisconnectReference: hub75.powerPath.displayDisconnectReference,
        measurementLinkReference: hub75.powerPath.measurementLinkReference
      },
      authority: { ...hub75.authority }
    }
  }
}

export function validateBenchPrototypeConnectorUpstreamProvenance(value: unknown): true {
  if (!sameDataGraph(value, benchPrototypeConnectorUpstreamProvenance)) {
    throw new RangeError("BP-034 upstream interface provenance drifted from BP-050, BP-104, BP-124, BP-141, or BP-143")
  }
  return true
}

function assertUpstreamProvenance(): void {
  calculateBenchPrototypePowerContract(defaultBenchPrototypePowerInputs)
  validateBenchPrototypeFixtureHarness(benchPrototypeFixtureHarness)
  validateBenchPrototypeServiceHeaders(benchPrototypeServiceHeaders)
  validateBenchPrototypeEthernetMdi(benchPrototypeEthernetMdi)
  validateBenchPrototypeHub75Connector(benchPrototypeHub75Connector)
  validateBenchPrototypeConnectorUpstreamProvenance(currentUpstreamProvenance())
}

export type ImmutableEvidenceArtifact = { readonly artifactId: string; readonly sha256: string }

type ReceivedComponent = {
  readonly manufacturer: string
  readonly mpn: string
  readonly supplier: string
  readonly receiptId: string
  readonly lotOrDateCode: string
  readonly quantity: number
}

export type BenchPrototypeConnectorPreorderEvidence = {
  readonly artifactKind: "bench-prototype-connector-preorder-evidence"
  readonly status: "measured"
  readonly evidenceId: string
  readonly recordedAtUtc: string
  readonly operator: string
  readonly samples: readonly {
    readonly id: BenchPrototypeConnectorSampleId
    readonly components: readonly ReceivedComponent[]
  }[]
  readonly drawingAndCad: readonly {
    readonly id: BenchPrototypeConnectorSampleId
    readonly drawingRevision: string
    readonly drawingArtifact: ImmutableEvidenceArtifact
    readonly cadArtifact: ImmutableEvidenceArtifact
    readonly footprintReference: string
    readonly pinOneOverlayAccepted: true
    readonly boardEdgeAndKeepoutAccepted: true
    readonly reviewer: string
  }[]
  readonly matingAndOrientation: readonly {
    readonly id: BenchPrototypeConnectorSampleId
    readonly mates: readonly {
      readonly manufacturer: string
      readonly mpn: string
      readonly quantity: number
      readonly pinOneOrKeyPhoto: ImmutableEvidenceArtifact
      readonly fullySeatedPhoto: ImmutableEvidenceArtifact
    }[]
    readonly insertionDirection: string
    readonly powerState: "off-and-discharged"
    readonly forcedMateObserved: false
    readonly noForceMateAndUnmateResult: "accepted"
    readonly retentionObserved: true
    readonly rejectedMateOrReversalArtifact: ImmutableEvidenceArtifact
  }[]
  readonly retentionAndStrain: readonly {
    readonly id: BenchPrototypeConnectorSampleId
    readonly loadPath: string
    readonly cableExitDirection: string
    readonly retentionMethod: string
    readonly retentionLoadN: number
    readonly retentionResult: "accepted"
    readonly retentionArtifact: ImmutableEvidenceArtifact
    readonly strainMethod: string
    readonly strainLoadN: number
    readonly strainResult: "accepted"
    readonly strainArtifact: ImmutableEvidenceArtifact
    readonly solderJointsAreNotSoleRetention: true
  }[]
  readonly continuity: readonly {
    readonly id: BenchPrototypeConnectorSampleId
    readonly checklistRevision: string
    readonly evidenceArtifact: ImmutableEvidenceArtifact
    readonly equipment: {
      readonly manufacturer: string
      readonly model: string
      readonly serialNumber: string
      readonly calibrationCertificate: ImmutableEvidenceArtifact
      readonly calibrationDueDate: string
    }
    readonly method: {
      readonly powerState: "off-and-discharged"
      readonly testVoltageV: number
      readonly leadCompensationMethod: "zeroed-with-same-leads-at-fixture"
      readonly compensatedLeadResidualOhms: number
    }
    readonly measurements: readonly {
      readonly id: string
      readonly from: string
      readonly to: string
      readonly resistanceOhms: number
    }[]
    readonly negativeTests: readonly {
      readonly id: "open" | "polarity" | "reversal" | "swap"
      readonly result: "rejected"
      readonly observation: string
      readonly artifact: ImmutableEvidenceArtifact
    }[]
  }[]
  readonly weaponFixtureContinuity: BenchPrototypeContinuityEvidence
}

export type BenchPrototypeConnectorPreorderEvaluation = {
  readonly accepted: boolean
  readonly reasons: readonly string[]
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function hasExactStringArray(value: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(value) && value.length === expected.length && expected.every((entry, index) => value[index] === entry)
  )
}

function inspectDataGraph(value: unknown, path: string, seen: WeakSet<object>, reasons: string[]): void {
  if (value === null || typeof value !== "object") return
  if (seen.has(value)) {
    reasons.push(`${path} contains a cycle or object alias`)
    return
  }
  seen.add(value)
  const keys = Reflect.ownKeys(value)
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      reasons.push(`${path} must be a plain array`)
      return
    }
    const expectedKeys: PropertyKey[] = Array.from({ length: value.length }, (_, index) => String(index))
    expectedKeys.push("length")
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
      reasons.push(`${path} must be a dense plain array with no extra or symbol keys`)
      return
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        reasons.push(`${path}[${index}] must be an enumerable data property`)
        return
      }
      inspectDataGraph(descriptor.value, `${path}[${index}]`, seen, reasons)
    }
    return
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    reasons.push(`${path} must be a plain data record`)
    return
  }
  for (const key of keys) {
    if (typeof key === "symbol") {
      reasons.push(`${path} must not contain symbol keys`)
      return
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      reasons.push(`${path}.${key} must be an enumerable data property`)
      return
    }
    inspectDataGraph(descriptor.value, `${path}.${key}`, seen, reasons)
  }
}

function hasExactKeys(value: unknown, expected: readonly string[]): value is DataRecord {
  if (!isPlainRecord(value)) return false
  const actual = Object.keys(value)
  return actual.length === expected.length && expected.every((key) => actual.includes(key))
}

type ArtifactUse = {
  readonly equipmentIdentity: string | null
  readonly role: "calibration-certificate" | "exclusive"
  readonly sha256: string
}

function validateArtifact(
  value: unknown,
  artifacts: Map<string, ArtifactUse>,
  reasons: string[],
  field: string,
  role: ArtifactUse["role"] = "exclusive",
  equipmentIdentity: string | null = null
): boolean {
  if (
    !hasExactKeys(value, ["artifactId", "sha256"]) ||
    !nonEmptyString(value.artifactId) ||
    !/^[0-9A-F]{64}$/u.test(String(value.sha256))
  ) {
    reasons.push(`${field} must link an immutable artifact ID to an uppercase SHA-256`)
    return false
  }
  const existing = artifacts.get(value.artifactId)
  if (existing !== undefined) {
    if (existing.sha256 !== value.sha256) {
      reasons.push(`${field} reuses artifact ID ${value.artifactId} with a different SHA-256`)
      return false
    }
    if (existing.role !== "calibration-certificate" || role !== "calibration-certificate") {
      reasons.push(`${field} reuses artifact ID ${value.artifactId} outside the explicit calibration-certificate rule`)
      return false
    }
    if (existing.equipmentIdentity !== equipmentIdentity) {
      reasons.push(`${field} reuses calibration certificate ${value.artifactId} for a different instrument`)
      return false
    }
  }
  artifacts.set(value.artifactId, { equipmentIdentity, role, sha256: String(value.sha256) })
  return true
}

function exactRows(
  value: unknown,
  expectedIds: readonly BenchPrototypeConnectorSampleId[],
  field: string,
  predicate: (row: DataRecord, id: BenchPrototypeConnectorSampleId) => boolean,
  reasons: string[]
): void {
  if (!Array.isArray(value) || value.length !== expectedIds.length) {
    reasons.push(`${field} must contain exactly one ordered record for every required identity`)
    return
  }
  expectedIds.forEach((id, index) => {
    const row = value[index]
    if (!isPlainRecord(row) || row.id !== id || !predicate(row, id)) {
      reasons.push(`${field} record ${index + 1} must be a complete ${id} record`)
    }
  })
}

function exactComponents(
  value: unknown,
  expected: readonly { manufacturer: string; mpn: string; quantity: number }[]
): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    expected.every((entry, index) => {
      const actual = value[index]
      return (
        isPlainRecord(actual) &&
        actual.manufacturer === entry.manufacturer &&
        actual.mpn === entry.mpn &&
        actual.quantity === entry.quantity
      )
    })
  )
}

function weaponEvidenceHasExactShape(value: unknown): boolean {
  if (
    !hasExactKeys(value, [
      "artifactKind",
      "evidenceId",
      "status",
      "recordedAtUtc",
      "operator",
      "boardId",
      "harnessId",
      "testPlugMpn",
      "equipment",
      "method",
      "endToEnd",
      "isolation",
      "openCircuitChecks",
      "negativeTests"
    ]) ||
    !hasExactKeys(value.equipment, [
      "manufacturer",
      "model",
      "serialNumber",
      "calibrationCertificate",
      "calibrationDueDate"
    ]) ||
    !hasExactKeys(value.method, [
      "powerState",
      "continuityTestVoltageV",
      "isolationTestVoltageV",
      "leadCompensationMethod",
      "compensatedLeadResidualOhms"
    ]) ||
    !Array.isArray(value.endToEnd) ||
    !Array.isArray(value.isolation) ||
    !Array.isArray(value.openCircuitChecks) ||
    !Array.isArray(value.negativeTests)
  )
    return false
  return (
    value.endToEnd.every((row) => hasExactKeys(row, ["boardPin", "harnessCircuit", "signal", "resistanceOhms"])) &&
    value.isolation.every((row) => hasExactKeys(row, ["boardPinA", "boardPinB", "resistanceOhms", "testVoltageV"])) &&
    value.openCircuitChecks.every((row) => hasExactKeys(row, ["boardPin", "harnessCircuit", "resistanceOhms"])) &&
    value.negativeTests.every((row) => hasExactKeys(row, ["id", "result", "observation"]))
  )
}

const genericContinuitySamples = requiredSamples.filter((sample) => sample.continuityMeasurements.length > 0)
const genericContinuityIds = genericContinuitySamples.map((sample) => sample.id)
const negativeIds = ["open", "polarity", "reversal", "swap"] as const

export function evaluateBenchPrototypeConnectorPreorderEvidence(
  value: unknown
): BenchPrototypeConnectorPreorderEvaluation {
  assertUpstreamProvenance()
  const reasons: string[] = []
  inspectDataGraph(value, "evidence", new WeakSet<object>(), reasons)
  if (reasons.length > 0) return { accepted: false, reasons }
  if (
    !hasExactKeys(value, [
      "artifactKind",
      "status",
      "evidenceId",
      "recordedAtUtc",
      "operator",
      "samples",
      "drawingAndCad",
      "matingAndOrientation",
      "retentionAndStrain",
      "continuity",
      "weaponFixtureContinuity"
    ])
  ) {
    return { accepted: false, reasons: ["evidence must contain only the exact BP-034 enumerable data keys"] }
  }
  const artifacts = new Map<string, ArtifactUse>()
  if (value.artifactKind !== "bench-prototype-connector-preorder-evidence") reasons.push("artifact kind is invalid")
  if (value.status !== "measured") reasons.push("status must be measured")
  const recordedAt = parseCanonicalUtcTimestamp(value.recordedAtUtc)
  if (!nonEmptyString(value.evidenceId) || !nonEmptyString(value.operator) || recordedAt === null) {
    reasons.push("evidenceId, operator, and a canonical UTC timestamp are required")
  }

  for (const sample of requiredSamples) {
    if (sample.selectionState !== "exact")
      reasons.push(`${sample.id} selection remains blocked: ${sample.selectionBlocker}`)
  }

  exactRows(
    value.samples,
    sampleIds,
    "samples",
    (row, id) => {
      const expected = requiredSamples.find((sample) => sample.id === id)!.requiredComponents
      return (
        hasExactKeys(row, ["id", "components"]) &&
        exactComponents(row.components, expected) &&
        Array.isArray(row.components) &&
        row.components.every(
          (entry) =>
            hasExactKeys(entry, ["manufacturer", "mpn", "supplier", "receiptId", "lotOrDateCode", "quantity"]) &&
            nonEmptyString(entry.supplier) &&
            nonEmptyString(entry.receiptId) &&
            nonEmptyString(entry.lotOrDateCode) &&
            finiteNumber(entry.quantity) &&
            Number.isInteger(entry.quantity) &&
            entry.quantity > 0
        )
      )
    },
    reasons
  )

  exactRows(
    value.drawingAndCad,
    sampleIds,
    "drawingAndCad",
    (row, id) =>
      hasExactKeys(row, [
        "id",
        "drawingRevision",
        "drawingArtifact",
        "cadArtifact",
        "footprintReference",
        "pinOneOverlayAccepted",
        "boardEdgeAndKeepoutAccepted",
        "reviewer"
      ]) &&
      nonEmptyString(row.drawingRevision) &&
      validateArtifact(row.drawingArtifact, artifacts, reasons, `${id}.drawingArtifact`) &&
      validateArtifact(row.cadArtifact, artifacts, reasons, `${id}.cadArtifact`) &&
      nonEmptyString(row.footprintReference) &&
      row.pinOneOverlayAccepted === true &&
      row.boardEdgeAndKeepoutAccepted === true &&
      nonEmptyString(row.reviewer),
    reasons
  )

  exactRows(
    value.matingAndOrientation,
    sampleIds,
    "matingAndOrientation",
    (row, id) => {
      const sample = requiredSamples.find((candidate) => candidate.id === id)!
      const expectedMates = sample.requiredComponents.slice(1)
      if (
        !hasExactKeys(row, [
          "id",
          "mates",
          "insertionDirection",
          "powerState",
          "forcedMateObserved",
          "noForceMateAndUnmateResult",
          "retentionObserved",
          "rejectedMateOrReversalArtifact"
        ]) ||
        !exactComponents(row.mates, expectedMates) ||
        !Array.isArray(row.mates)
      )
        return false
      const artifactLinksValid = row.mates.every(
        (mate, index) =>
          hasExactKeys(mate, ["manufacturer", "mpn", "quantity", "pinOneOrKeyPhoto", "fullySeatedPhoto"]) &&
          validateArtifact(mate.pinOneOrKeyPhoto, artifacts, reasons, `${id}.mates[${index}].pinOneOrKeyPhoto`) &&
          validateArtifact(mate.fullySeatedPhoto, artifacts, reasons, `${id}.mates[${index}].fullySeatedPhoto`)
      )
      return (
        artifactLinksValid &&
        nonEmptyString(row.insertionDirection) &&
        row.powerState === "off-and-discharged" &&
        row.forcedMateObserved === false &&
        row.noForceMateAndUnmateResult === "accepted" &&
        row.retentionObserved === true &&
        validateArtifact(row.rejectedMateOrReversalArtifact, artifacts, reasons, `${id}.rejectedMateOrReversalArtifact`)
      )
    },
    reasons
  )

  exactRows(
    value.retentionAndStrain,
    sampleIds,
    "retentionAndStrain",
    (row, id) =>
      hasExactKeys(row, [
        "id",
        "loadPath",
        "cableExitDirection",
        "retentionMethod",
        "retentionLoadN",
        "retentionResult",
        "retentionArtifact",
        "strainMethod",
        "strainLoadN",
        "strainResult",
        "strainArtifact",
        "solderJointsAreNotSoleRetention"
      ]) &&
      nonEmptyString(row.loadPath) &&
      nonEmptyString(row.cableExitDirection) &&
      nonEmptyString(row.retentionMethod) &&
      finiteNumber(row.retentionLoadN) &&
      row.retentionLoadN > 0 &&
      row.retentionResult === "accepted" &&
      validateArtifact(row.retentionArtifact, artifacts, reasons, `${id}.retentionArtifact`) &&
      nonEmptyString(row.strainMethod) &&
      finiteNumber(row.strainLoadN) &&
      row.strainLoadN > 0 &&
      row.strainResult === "accepted" &&
      validateArtifact(row.strainArtifact, artifacts, reasons, `${id}.strainArtifact`) &&
      row.solderJointsAreNotSoleRetention === true,
    reasons
  )

  exactRows(
    value.continuity,
    genericContinuityIds,
    "continuity",
    (row, id) => {
      const sample = genericContinuitySamples.find((candidate) => candidate.id === id)!
      if (
        !hasExactKeys(row, [
          "id",
          "checklistRevision",
          "evidenceArtifact",
          "equipment",
          "method",
          "measurements",
          "negativeTests"
        ]) ||
        !hasExactKeys(row.equipment, [
          "manufacturer",
          "model",
          "serialNumber",
          "calibrationCertificate",
          "calibrationDueDate"
        ]) ||
        !hasExactKeys(row.method, [
          "powerState",
          "testVoltageV",
          "leadCompensationMethod",
          "compensatedLeadResidualOhms"
        ])
      )
        return false
      const due = parseRealUtcDate(row.equipment.calibrationDueDate)
      const equipmentIdentity =
        typeof row.equipment.manufacturer === "string" &&
        typeof row.equipment.model === "string" &&
        typeof row.equipment.serialNumber === "string"
          ? `${row.equipment.manufacturer}\u001f${row.equipment.model}\u001f${row.equipment.serialNumber}`
          : null
      const equipmentValid =
        nonEmptyString(row.equipment.manufacturer) &&
        nonEmptyString(row.equipment.model) &&
        nonEmptyString(row.equipment.serialNumber) &&
        due !== null &&
        (recordedAt === null ||
          due.getTime() >= Date.UTC(recordedAt.getUTCFullYear(), recordedAt.getUTCMonth(), recordedAt.getUTCDate())) &&
        validateArtifact(
          row.equipment.calibrationCertificate,
          artifacts,
          reasons,
          `${id}.calibrationCertificate`,
          "calibration-certificate",
          equipmentIdentity
        )
      const methodValid =
        row.method.powerState === "off-and-discharged" &&
        finiteNumber(row.method.testVoltageV) &&
        row.method.testVoltageV > 0 &&
        row.method.testVoltageV <= benchPrototypeConnectorContinuityThresholds.maximumTestVoltageV &&
        row.method.leadCompensationMethod === "zeroed-with-same-leads-at-fixture" &&
        finiteNumber(row.method.compensatedLeadResidualOhms) &&
        row.method.compensatedLeadResidualOhms >= 0 &&
        row.method.compensatedLeadResidualOhms <=
          benchPrototypeConnectorContinuityThresholds.maximumLeadCompensationOhms
      const measurements = row.measurements
      const measurementsValid =
        Array.isArray(measurements) &&
        measurements.length === sample.continuityMeasurements.length &&
        sample.continuityMeasurements.every((expectedMeasurement, index) => {
          const actualMeasurement = measurements[index]
          return (
            hasExactKeys(actualMeasurement, ["id", "from", "to", "resistanceOhms"]) &&
            actualMeasurement.id === expectedMeasurement.id &&
            actualMeasurement.from === expectedMeasurement.from &&
            actualMeasurement.to === expectedMeasurement.to &&
            finiteNumber(actualMeasurement.resistanceOhms) &&
            actualMeasurement.resistanceOhms >= 0 &&
            actualMeasurement.resistanceOhms <=
              benchPrototypeConnectorContinuityThresholds.maximumContactPathResistanceOhms
          )
        })
      const negativeTests = row.negativeTests
      const negativeValid =
        Array.isArray(negativeTests) &&
        negativeTests.length === negativeIds.length &&
        negativeIds.every((negativeId, index) => {
          const negative = negativeTests[index]
          return (
            hasExactKeys(negative, ["id", "result", "observation", "artifact"]) &&
            negative.id === negativeId &&
            negative.result === "rejected" &&
            nonEmptyString(negative.observation) &&
            validateArtifact(negative.artifact, artifacts, reasons, `${id}.negativeTests[${index}].artifact`)
          )
        })
      return (
        nonEmptyString(row.checklistRevision) &&
        validateArtifact(row.evidenceArtifact, artifacts, reasons, `${id}.evidenceArtifact`) &&
        equipmentValid &&
        methodValid &&
        measurementsValid &&
        negativeValid
      )
    },
    reasons
  )

  if (!weaponEvidenceHasExactShape(value.weaponFixtureContinuity)) {
    reasons.push("weaponFixtureContinuity must contain only the exact BP-104 evidence keys")
  } else {
    const weaponEvaluation = evaluateBenchPrototypeContinuityEvidence(value.weaponFixtureContinuity)
    reasons.push(...weaponEvaluation.reasons.map((reason) => `weaponFixtureContinuity: ${reason}`))
  }
  return { accepted: reasons.length === 0, reasons }
}

const panelCircuitOrder = ["A", "B", "C"] as const
const panelNegativeTestIds = ["open", "swap", "reversal"] as const

/**
 * This is deliberately a separate scope from BP-104.  BP-104 owns the
 * seven-channel fixture harness; this contract owns a single custom, three
 * socket weapon panel and its short board harness.  The owner has confirmed
 * the existing OK Fencing weapon cable is compatible with market scoring
 * boxes.  That fact authorizes no part selection, fabrication, or release.
 */
export const benchPrototypeWeaponPanelHarness = deepFreeze({
  artifactKind: "bench-prototype-custom-weapon-panel-harness-contract",
  workUnit: "BP-034",
  targetAssembly: "per-side custom three-socket prototype weapon interface",
  prototypeOnly: true,
  cableCompatibility: {
    supplier: "OK Fencing",
    status: "owner-validated-not-a-blocker",
    scope:
      "Existing three-pin weapon cable compatibility only; no socket, panel, harness, or board-end identity is implied."
  },
  ownerReferencePhotos: [
    {
      assetPath: "docs/evidence/bp-034/owner-weapon-socket-reference-1.jpg",
      sha256: "F82EC60AA16BE02BC93D00F31A610E3859ECAA158D63E2CED121A0A05CEBE41B",
      boundedObservation:
        "Owner-supplied reference image shows three separate metal sockets retained in a transparent insulating carrier with threaded bodies."
    },
    {
      assetPath: "docs/evidence/bp-034/owner-weapon-socket-reference-2.jpg",
      sha256: "100831D56FD5F3F1759B83CC5A5568AD3236F1D3065BE699093CA0472774617E",
      boundedObservation:
        "Owner-supplied reference image shows the same three-socket assembly and a separately fastened metal bracket or tang."
    }
  ],
  photoNonClaims: [
    "The photos are non-dimensional reference evidence only.",
    "They do not identify a socket SKU, spacing, material, rating, final panel geometry, or board-side connector."
  ],
  perPanelCircuitOrder: panelCircuitOrder,
  prototypeImplementationAlternatives: [
    {
      id: "direct-carrier-pcb-mount",
      scope: "Prototype only",
      requiredEvidence:
        "Mounting holes, hardware, an insertion-load path, and proof that electrical solder joints are not the sole mechanical retention."
    },
    {
      id: "separate-sockets-to-board-landing-pads",
      scope: "Prototype only",
      requiredEvidence:
        "Labeled plated through-hole and test landing pads, conductor gauge and insulation, strain-relief anchor, clearance, A/B/C map, and no exposed shorts."
    }
  ],
  productionHarness: {
    status: "later-gate",
    requirement: "Production uses a replaceable insulated socket module and keyed short connectorized harness.",
    selectionState: "unselected"
  },
  requiredEvidence: [
    "Exact socket manufacturer and MPN, one panel side, and three individual socket identities in A/B/C order.",
    "Either direct carrier PCB mount with independent insertion-load retention, or separate sockets wired to labeled board landing pads.",
    "De-energized continuity, isolation, open, swap, and reversal captures.",
    "A received sample and non-forced mate/unmate evidence before any prototype wiring decision."
  ],
  fabricationDisposition: "DENY",
  releaseState: "deny"
})

export type BenchPrototypeWeaponPanelHarnessEvidence = {
  readonly artifactKind: "bench-prototype-custom-weapon-panel-harness-evidence"
  readonly status: "measured"
  readonly evidenceId: string
  readonly recordedAtUtc: string
  readonly operator: string
  readonly ownerCableCompatibility: "accepted-not-blocker"
  readonly panel: {
    readonly side: "left" | "right"
    readonly socketManufacturer: string
    readonly socketMpn: string
    readonly socketQuantity: 3
    readonly socketIdentityArtifact: ImmutableEvidenceArtifact
    readonly circuitOrder: readonly ["A", "B", "C"]
    readonly panelMountMethod: string
    readonly insulationMethod: string
    readonly mountAndInsulationArtifact: ImmutableEvidenceArtifact
  }
  readonly rearTerminations: readonly {
    readonly circuit: "A" | "B" | "C"
    readonly socketRearTermination: string
    readonly boardEndContact: string
    readonly artifact: ImmutableEvidenceArtifact
  }[]
  readonly prototypeImplementation:
    | {
        readonly approach: "direct-carrier-pcb-mount"
        readonly mountingHoleReferences: readonly string[]
        readonly mountingHardware: string
        readonly insertionLoadPath: string
        readonly solderJointsAreNotSoleMechanicalRetention: true
        readonly artifact: ImmutableEvidenceArtifact
      }
    | {
        readonly approach: "separate-sockets-to-board-landing-pads"
        readonly landingPads: readonly {
          readonly circuit: "A" | "B" | "C"
          readonly reference: string
          readonly labeled: true
          readonly platedThroughHole: true
          readonly testLandingPad: true
        }[]
        readonly conductorMaterial: string
        readonly conductorGaugeAwg: number
        readonly insulation: string
        readonly lengthMm: number
        readonly strainReliefAnchor: string
        readonly clearanceMethod: string
        readonly noExposedShorts: true
        readonly artifact: ImmutableEvidenceArtifact
      }
  readonly mate: {
    readonly powerState: "off-and-discharged"
    readonly forcedMateObserved: false
    readonly noForceMateAndUnmateResult: "accepted"
    readonly artifact: ImmutableEvidenceArtifact
  }
  readonly continuity: readonly {
    readonly circuit: "A" | "B" | "C"
    readonly from: string
    readonly to: string
    readonly resistanceOhms: number
    readonly artifact: ImmutableEvidenceArtifact
  }[]
  readonly isolation: {
    readonly testVoltageV: number
    readonly minimumResistanceOhms: number
    readonly artifact: ImmutableEvidenceArtifact
  }
  readonly negativeTests: readonly {
    readonly id: "open" | "swap" | "reversal"
    readonly result: "rejected"
    readonly artifact: ImmutableEvidenceArtifact
  }[]
}

export function evaluateBenchPrototypeWeaponPanelHarnessEvidence(
  value: unknown
): BenchPrototypeConnectorPreorderEvaluation {
  const reasons: string[] = []
  inspectDataGraph(value, "weaponPanelHarnessEvidence", new WeakSet<object>(), reasons)
  if (reasons.length > 0) return { accepted: false, reasons }
  if (
    !hasExactKeys(value, [
      "artifactKind",
      "status",
      "evidenceId",
      "recordedAtUtc",
      "operator",
      "ownerCableCompatibility",
      "panel",
      "rearTerminations",
      "prototypeImplementation",
      "mate",
      "continuity",
      "isolation",
      "negativeTests"
    ])
  ) {
    return {
      accepted: false,
      reasons: ["weapon panel harness evidence must contain only the exact declared data keys"]
    }
  }
  const artifacts = new Map<string, ArtifactUse>()
  if (value.artifactKind !== "bench-prototype-custom-weapon-panel-harness-evidence")
    reasons.push("artifact kind is invalid")
  if (value.status !== "measured") reasons.push("status must be measured")
  if (
    !nonEmptyString(value.evidenceId) ||
    !nonEmptyString(value.operator) ||
    parseCanonicalUtcTimestamp(value.recordedAtUtc) === null ||
    value.ownerCableCompatibility !== "accepted-not-blocker"
  ) {
    reasons.push("identity, canonical timestamp, and owner cable compatibility acceptance are required")
  }
  const panel = value.panel
  const panelValid =
    hasExactKeys(panel, [
      "side",
      "socketManufacturer",
      "socketMpn",
      "socketQuantity",
      "socketIdentityArtifact",
      "circuitOrder",
      "panelMountMethod",
      "insulationMethod",
      "mountAndInsulationArtifact"
    ]) &&
    (panel.side === "left" || panel.side === "right") &&
    nonEmptyString(panel.socketManufacturer) &&
    nonEmptyString(panel.socketMpn) &&
    panel.socketQuantity === 3 &&
    hasExactStringArray(panel.circuitOrder, panelCircuitOrder) &&
    nonEmptyString(panel.panelMountMethod) &&
    nonEmptyString(panel.insulationMethod) &&
    validateArtifact(panel.socketIdentityArtifact, artifacts, reasons, "panel.socketIdentityArtifact") &&
    validateArtifact(panel.mountAndInsulationArtifact, artifacts, reasons, "panel.mountAndInsulationArtifact")
  if (!panelValid) reasons.push("panel must define one insulated A/B/C three-socket panel with immutable evidence")
  const rearTerminations = value.rearTerminations
  if (
    !Array.isArray(rearTerminations) ||
    rearTerminations.length !== panelCircuitOrder.length ||
    !panelCircuitOrder.every((circuit, index) => {
      const row = rearTerminations[index]
      return (
        hasExactKeys(row, ["circuit", "socketRearTermination", "boardEndContact", "artifact"]) &&
        row.circuit === circuit &&
        nonEmptyString(row.socketRearTermination) &&
        nonEmptyString(row.boardEndContact) &&
        validateArtifact(row.artifact, artifacts, reasons, `rearTerminations[${index}].artifact`)
      )
    })
  ) {
    reasons.push("rear terminations must define exactly A, B, and C socket-to-board contacts")
  }
  const prototypeImplementation = value.prototypeImplementation
  let prototypeImplementationValid = false
  if (isPlainRecord(prototypeImplementation) && prototypeImplementation.approach === "direct-carrier-pcb-mount") {
    prototypeImplementationValid =
      hasExactKeys(prototypeImplementation, [
        "approach",
        "mountingHoleReferences",
        "mountingHardware",
        "insertionLoadPath",
        "solderJointsAreNotSoleMechanicalRetention",
        "artifact"
      ]) &&
      Array.isArray(prototypeImplementation.mountingHoleReferences) &&
      prototypeImplementation.mountingHoleReferences.length > 0 &&
      prototypeImplementation.mountingHoleReferences.every(nonEmptyString) &&
      nonEmptyString(prototypeImplementation.mountingHardware) &&
      nonEmptyString(prototypeImplementation.insertionLoadPath) &&
      prototypeImplementation.solderJointsAreNotSoleMechanicalRetention === true &&
      validateArtifact(prototypeImplementation.artifact, artifacts, reasons, "prototypeImplementation.artifact")
  } else if (
    isPlainRecord(prototypeImplementation) &&
    prototypeImplementation.approach === "separate-sockets-to-board-landing-pads"
  ) {
    const landingPads = prototypeImplementation.landingPads
    prototypeImplementationValid =
      hasExactKeys(prototypeImplementation, [
        "approach",
        "landingPads",
        "conductorMaterial",
        "conductorGaugeAwg",
        "insulation",
        "lengthMm",
        "strainReliefAnchor",
        "clearanceMethod",
        "noExposedShorts",
        "artifact"
      ]) &&
      Array.isArray(landingPads) &&
      landingPads.length === panelCircuitOrder.length &&
      panelCircuitOrder.every((circuit, index) => {
        const row = landingPads[index]
        return (
          hasExactKeys(row, ["circuit", "reference", "labeled", "platedThroughHole", "testLandingPad"]) &&
          row.circuit === circuit &&
          nonEmptyString(row.reference) &&
          row.labeled === true &&
          row.platedThroughHole === true &&
          row.testLandingPad === true
        )
      }) &&
      nonEmptyString(prototypeImplementation.conductorMaterial) &&
      finiteNumber(prototypeImplementation.conductorGaugeAwg) &&
      prototypeImplementation.conductorGaugeAwg > 0 &&
      nonEmptyString(prototypeImplementation.insulation) &&
      finiteNumber(prototypeImplementation.lengthMm) &&
      prototypeImplementation.lengthMm > 0 &&
      nonEmptyString(prototypeImplementation.strainReliefAnchor) &&
      nonEmptyString(prototypeImplementation.clearanceMethod) &&
      prototypeImplementation.noExposedShorts === true &&
      validateArtifact(prototypeImplementation.artifact, artifacts, reasons, "prototypeImplementation.artifact")
  }
  if (!prototypeImplementationValid) {
    reasons.push("prototype implementation must be one complete reviewed direct mount or landing-pad alternative")
  }
  const mate = value.mate
  if (
    !hasExactKeys(mate, ["powerState", "forcedMateObserved", "noForceMateAndUnmateResult", "artifact"]) ||
    mate.powerState !== "off-and-discharged" ||
    mate.forcedMateObserved !== false ||
    mate.noForceMateAndUnmateResult !== "accepted" ||
    !validateArtifact(mate.artifact, artifacts, reasons, "mate.artifact")
  ) {
    reasons.push("mate must be de-energized, non-forced, accepted for mate/unmate, and immutable")
  }
  const continuity = value.continuity
  if (
    !Array.isArray(continuity) ||
    continuity.length !== panelCircuitOrder.length ||
    !panelCircuitOrder.every((circuit, index) => {
      const row = continuity[index]
      return (
        hasExactKeys(row, ["circuit", "from", "to", "resistanceOhms", "artifact"]) &&
        row.circuit === circuit &&
        nonEmptyString(row.from) &&
        nonEmptyString(row.to) &&
        finiteNumber(row.resistanceOhms) &&
        row.resistanceOhms >= 0 &&
        row.resistanceOhms <= benchPrototypeConnectorContinuityThresholds.maximumContactPathResistanceOhms &&
        validateArtifact(row.artifact, artifacts, reasons, `continuity[${index}].artifact`)
      )
    })
  ) {
    reasons.push("continuity must capture exactly the A, B, and C paths at no more than 2 ohms")
  }
  const isolation = value.isolation
  if (
    !hasExactKeys(isolation, ["testVoltageV", "minimumResistanceOhms", "artifact"]) ||
    !finiteNumber(isolation.testVoltageV) ||
    isolation.testVoltageV <= 0 ||
    isolation.testVoltageV > benchPrototypeConnectorContinuityThresholds.maximumTestVoltageV ||
    !finiteNumber(isolation.minimumResistanceOhms) ||
    isolation.minimumResistanceOhms < 10_000_000 ||
    !validateArtifact(isolation.artifact, artifacts, reasons, "isolation.artifact")
  ) {
    reasons.push("isolation must record at least 10 Mohm at an allowed positive test voltage")
  }
  const negativeTests = value.negativeTests
  if (
    !Array.isArray(negativeTests) ||
    negativeTests.length !== panelNegativeTestIds.length ||
    !panelNegativeTestIds.every((id, index) => {
      const row = negativeTests[index]
      return (
        hasExactKeys(row, ["id", "result", "artifact"]) &&
        row.id === id &&
        row.result === "rejected" &&
        validateArtifact(row.artifact, artifacts, reasons, `negativeTests[${index}].artifact`)
      )
    })
  ) {
    reasons.push("open, swap, and reversal negative captures are required and must be rejected")
  }
  return { accepted: reasons.length === 0, reasons }
}

export type BenchPrototypeWeaponPanelPairEvidence = {
  readonly artifactKind: "bench-prototype-custom-weapon-panel-pair-evidence"
  readonly status: "measured"
  readonly evidenceId: string
  readonly recordedAtUtc: string
  readonly operator: string
  readonly pairArtifact: ImmutableEvidenceArtifact
  readonly sides: readonly [BenchPrototypeWeaponPanelHarnessEvidence, BenchPrototypeWeaponPanelHarnessEvidence]
}

function collectImmutableArtifactIds(value: unknown, results: Set<string>): void {
  if (value === null || typeof value !== "object") return
  if (hasExactKeys(value, ["artifactId", "sha256"])) {
    results.add(String(value.artifactId))
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectImmutableArtifactIds(entry, results)
    return
  }
  if (isPlainRecord(value)) {
    for (const key of Object.keys(value)) collectImmutableArtifactIds(value[key], results)
  }
}

export function evaluateBenchPrototypeWeaponPanelPairEvidence(
  value: unknown
): BenchPrototypeConnectorPreorderEvaluation {
  const reasons: string[] = []
  inspectDataGraph(value, "weaponPanelPairEvidence", new WeakSet<object>(), reasons)
  if (reasons.length > 0) return { accepted: false, reasons }
  if (
    !hasExactKeys(value, ["artifactKind", "status", "evidenceId", "recordedAtUtc", "operator", "pairArtifact", "sides"])
  ) {
    return { accepted: false, reasons: ["weapon panel pair evidence must contain only the exact declared data keys"] }
  }
  const artifacts = new Map<string, ArtifactUse>()
  if (value.artifactKind !== "bench-prototype-custom-weapon-panel-pair-evidence")
    reasons.push("artifact kind is invalid")
  if (value.status !== "measured") reasons.push("status must be measured")
  if (
    !nonEmptyString(value.evidenceId) ||
    !nonEmptyString(value.operator) ||
    parseCanonicalUtcTimestamp(value.recordedAtUtc) === null ||
    !validateArtifact(value.pairArtifact, artifacts, reasons, "pairArtifact")
  ) {
    reasons.push("pair identity, canonical timestamp, operator, and immutable pair artifact are required")
  }
  const sides = value.sides
  if (!Array.isArray(sides) || sides.length !== 2) {
    reasons.push("pair evidence must contain exactly one left and one right interface")
  } else {
    const expectedSides = ["left", "right"] as const
    const sideEvidenceIds = new Set<string>()
    const sideArtifactIds = new Set<string>()
    expectedSides.forEach((expectedSide, index) => {
      const side = sides[index]
      const panel = isPlainRecord(side) ? side.panel : null
      if (!isPlainRecord(side) || !isPlainRecord(panel) || panel.side !== expectedSide) {
        reasons.push(`pair side ${index + 1} must be the ${expectedSide} interface`)
        return
      }
      const evaluation = evaluateBenchPrototypeWeaponPanelHarnessEvidence(side)
      reasons.push(...evaluation.reasons.map((reason) => `${expectedSide}: ${reason}`))
      const sideEvidenceId = nonEmptyString(side.evidenceId) ? side.evidenceId : null
      if (sideEvidenceId === null || sideEvidenceIds.has(sideEvidenceId)) {
        reasons.push(`${expectedSide} evidence ID must be unique across the left and right interfaces`)
      }
      if (sideEvidenceId !== null) sideEvidenceIds.add(sideEvidenceId)
      const artifactsForSide = new Set<string>()
      collectImmutableArtifactIds(side, artifactsForSide)
      for (const artifactId of artifactsForSide) {
        if (sideArtifactIds.has(artifactId)) {
          reasons.push(`${expectedSide} reuses immutable artifact ID ${artifactId} across interfaces`)
        }
        sideArtifactIds.add(artifactId)
      }
    })
  }
  return { accepted: reasons.length === 0, reasons }
}

export function validateBenchPrototypeWeaponPanelHarness(value: unknown): true {
  if (value !== benchPrototypeWeaponPanelHarness) {
    throw new RangeError("custom weapon-panel harness contract must use its reviewed canonical object")
  }
  if (
    benchPrototypeWeaponPanelHarness.cableCompatibility.status !== "owner-validated-not-a-blocker" ||
    benchPrototypeWeaponPanelHarness.targetAssembly !== "per-side custom three-socket prototype weapon interface" ||
    benchPrototypeWeaponPanelHarness.perPanelCircuitOrder.join(",") !== "A,B,C" ||
    benchPrototypeWeaponPanelHarness.ownerReferencePhotos[0]?.sha256 !==
      "F82EC60AA16BE02BC93D00F31A610E3859ECAA158D63E2CED121A0A05CEBE41B" ||
    benchPrototypeWeaponPanelHarness.ownerReferencePhotos[1]?.sha256 !==
      "100831D56FD5F3F1759B83CC5A5568AD3236F1D3065BE699093CA0472774617E" ||
    benchPrototypeWeaponPanelHarness.photoNonClaims.length !== 2 ||
    benchPrototypeWeaponPanelHarness.prototypeImplementationAlternatives.length !== 2 ||
    benchPrototypeWeaponPanelHarness.prototypeImplementationAlternatives[0]?.id !== "direct-carrier-pcb-mount" ||
    benchPrototypeWeaponPanelHarness.prototypeImplementationAlternatives[1]?.id !==
      "separate-sockets-to-board-landing-pads" ||
    benchPrototypeWeaponPanelHarness.productionHarness.status !== "later-gate" ||
    benchPrototypeWeaponPanelHarness.productionHarness.selectionState !== "unselected" ||
    benchPrototypeWeaponPanelHarness.fabricationDisposition !== "DENY" ||
    benchPrototypeWeaponPanelHarness.releaseState !== "deny"
  ) {
    throw new RangeError("custom weapon-panel harness must retain owner cable scope and deny release")
  }
  return true
}

export function validateBenchPrototypeConnectorPreorder(value: unknown): true {
  assertUpstreamProvenance()
  if (value !== benchPrototypeConnectorPreorder) {
    throw new RangeError("BP-034 connector preorder contract must use its reviewed canonical object")
  }
  const usbCable = benchPrototypeConnectorPreorder.samples[0].requiredComponents[1]
  const ethernetCable = benchPrototypeConnectorPreorder.samples[7].requiredComponents[1]
  const usbSource = benchPrototypeConnectorPreorder.samples[0].sourceEvidence
  const ethernetSource = benchPrototypeConnectorPreorder.samples[7].sourceEvidence
  const ethernetContinuity = benchPrototypeConnectorPreorder.samples[7].continuityMeasurements
  if (
    benchPrototypeConnectorPreorder.fabricationDisposition !== "DENY" ||
    benchPrototypeConnectorPreorder.releaseState !== "deny" ||
    benchPrototypeConnectorPreorder.samples.length !== 10 ||
    benchPrototypeConnectorPreorder.samples.some((sample) => sample.selectionState !== "exact") ||
    usbCable.manufacturer !== "StarTech.com" ||
    usbCable.mpn !== "USB2CC1M" ||
    usbSource?.sourceUrl !== "https://media.startech.com/cms/pdfs/usb2cc1m_datasheet.pdf" ||
    usbSource?.assetPath !== "docs/evidence/bp-034/startech-usb2cc1m-datasheet.pdf" ||
    usbSource?.sha256 !== "AE5241D2A65A5B64F737D4205FD428B0432567EA98FA1482520AB0D9F345FAE7" ||
    benchPrototypeConnectorPreorder.samples[0].selectionBasis?.["maximumVoltageV"] !== 20 ||
    benchPrototypeConnectorPreorder.samples[0].selectionBasis?.["maximumCurrentA"] !== 3 ||
    ethernetCable.manufacturer !== "Eaton, Tripp Lite series" ||
    ethernetCable.mpn !== "N201-003-BL" ||
    ethernetSource?.sourceUrl !== "https://assets.tripplite.com/product-pdfs/en/n201003bl.pdf" ||
    ethernetSource?.assetPath !== "docs/evidence/bp-034/eaton-tripp-lite-n201-003-bl-datasheet.pdf" ||
    ethernetSource?.sha256 !== "BB81E709DFD1E57546379D2962431CD1D1C2445E038E81B053521B6231A14C12" ||
    benchPrototypeConnectorPreorder.samples[7].selectionBasis?.["cableEnds"] !==
      "RJ45 male to RJ45 male (8P8C patch cable)" ||
    ethernetContinuity.length !== 9 ||
    !ethernetContinuity.slice(0, 8).every((entry, index) => entry.id === `8p8c-contact-${index + 1}`) ||
    ethernetContinuity[8]?.id !== "shield-shell" ||
    benchPrototypeConnectorPreorder.weaponFixtureContinuityAuthority.delegatedArtifacts.procedure !==
      "benchPrototypeFixtureHarness.connector.sampleFitProcedure" ||
    benchPrototypeConnectorPreorder.weaponFixtureContinuityAuthority.delegatedArtifacts.continuityAndCalibration !==
      "evaluateBenchPrototypeContinuityEvidence" ||
    benchPrototypeConnectorPreorder.weaponFixtureContinuityAuthority.delegatedArtifacts.physicalFitAndNegativeTests !==
      "evaluateBenchPrototypeFixturePhysicalEvidence" ||
    benchPrototypeConnectorPreorder.samples[1].interfaceReferences[0] !== "J_LAB_INJECTION" ||
    !benchPrototypeConnectorPreorder.samples[6].interfaceReferences.includes("J_ESP_SERVICE") ||
    !benchPrototypeConnectorPreorder.samples[9].requiredComponents.some((entry) => entry.mpn === "SYM-001T-P0.6") ||
    !benchPrototypeConnectorPreorder.samples[9].requiredComponents.some((entry) => entry.mpn === "SHF-001T-0.8BS")
  ) {
    throw new RangeError("BP-034 must retain exact identities and deny release until physical evidence exists")
  }
  return true
}
