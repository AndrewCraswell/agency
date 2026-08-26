/**
 * BP-034 defines the immutable evidence needed before selected bench-board
 * connectors may be released. It never substitutes catalog data for received
 * samples, physical mates, photographs, or measured continuity.
 */

import {
  benchPrototypeContinuityThresholds,
  evaluateBenchPrototypeContinuityEvidence
} from "./bench-prototype-fixture-harness.js"
import { defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"

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
const numberedMeasurements = (ids: readonly (number | string)[], from: string, to: string) =>
  ids.map((id) => measurement(`pin-${id}`, `${from}.pin-${id}`, `${to}.pin-${id}`))

const measurementLinkContracts = [
  defaultBenchPrototypePowerInputs.measurementLinks.input,
  defaultBenchPrototypePowerInputs.measurementLinks.display,
  defaultBenchPrototypePowerInputs.measurementLinks.application,
  defaultBenchPrototypePowerInputs.measurementLinks.isolatedScoring
] as const

const requiredSamples = [
  {
    id: "usb-c-input",
    interfaceReferences: ["J_USB_C"],
    requiredComponents: [component("Amphenol Communications Solutions", "10177070-00011LF", 1)],
    selectionState: "blocked-no-exact-source-cable",
    selectionBlocker:
      "Select an exact source-backed USB-C cable MPN rated for the 20 V / 3 A contract before sample acceptance.",
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
    requiredComponents: [component("Würth Elektronik", "7499011121A", 1)],
    selectionState: "blocked-no-exact-test-plug",
    selectionBlocker: "Select and source an exact 8P8C test-plug or patch-cable MPN before sample acceptance.",
    continuityMeasurements: [
      ...numberedMeasurements(
        Array.from({ length: 12 }, (_, index) => index + 1),
        "J_ETH",
        "SELECTED_8P8C_TEST_MATE"
      ),
      measurement("shield-S1", "J_ETH.S1[CHASSIS_ETHERNET]", "7499011121A.S1[CHASSIS_ETHERNET]"),
      measurement("shield-S2", "J_ETH.S2[CHASSIS_ETHERNET]", "7499011121A.S2[CHASSIS_ETHERNET]")
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
export type BenchPrototypeConnectorSampleId = (typeof requiredSamples)[number]["id"]

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
    thresholds: benchPrototypeContinuityThresholds
  },
  openGates: [
    "No physical sample, mate, immutable artifact, retention observation, strain observation, or continuity record is claimed.",
    "USB-C and Ethernet cable/test-plug selection remain blocked until exact source-backed MPNs replace generic descriptions.",
    "Passing BP-034 does not clear the electrical, isolation, recovery, inrush, thermal, or fabrication gates held upstream."
  ]
})

export type ImmutableEvidenceArtifact = { readonly artifactId: string; readonly sha256: string }

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

function parseUtc(value: unknown): Date | null {
  if (typeof value !== "string") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) || date.toISOString() !== value ? null : date
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
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
  const recordedAt = parseUtc(value.recordedAtUtc)
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
        !hasExactKeys(row, ["id", "mates", "insertionDirection", "retentionObserved", "wrongMateOrReversalRejected"]) ||
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
        row.retentionObserved === true &&
        row.wrongMateOrReversalRejected === true
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
        "retentionArtifact",
        "strainArtifact",
        "solderJointsAreNotSoleRetention"
      ]) &&
      nonEmptyString(row.loadPath) &&
      nonEmptyString(row.cableExitDirection) &&
      validateArtifact(row.retentionArtifact, artifacts, reasons, `${id}.retentionArtifact`) &&
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
      const due = parseDate(row.equipment.calibrationDueDate)
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

export function validateBenchPrototypeConnectorPreorder(value: unknown): true {
  if (value !== benchPrototypeConnectorPreorder) {
    throw new RangeError("BP-034 connector preorder contract must use its reviewed canonical object")
  }
  if (
    benchPrototypeConnectorPreorder.fabricationDisposition !== "DENY" ||
    benchPrototypeConnectorPreorder.releaseState !== "deny" ||
    benchPrototypeConnectorPreorder.samples.length !== 10 ||
    benchPrototypeConnectorPreorder.samples[1].interfaceReferences[0] !== "J_LAB_INJECTION" ||
    !benchPrototypeConnectorPreorder.samples[6].interfaceReferences.includes("J_ESP_SERVICE") ||
    !benchPrototypeConnectorPreorder.samples[9].requiredComponents.some((entry) => entry.mpn === "SYM-001T-P0.6") ||
    !benchPrototypeConnectorPreorder.samples[9].requiredComponents.some((entry) => entry.mpn === "SHF-001T-0.8BS")
  ) {
    throw new RangeError("BP-034 must retain exact identities and deny release until physical evidence exists")
  }
  return true
}
