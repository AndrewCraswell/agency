/**
 * BP-143 received-panel evidence intake.
 *
 * The canonical intake is deliberately empty.  A submitted record may prove
 * that a real, identified sample was inspected, but never authorizes
 * schematic, layout, or fabrication release by itself.
 */

import { parseCanonicalUtcTimestamp } from "./bench-prototype-evidence-time.js"
import { canonicalHub75HeaderPins } from "./display-panel-readiness.js"

type DataRecord = Record<PropertyKey, unknown>

type Artifact = {
  readonly artifactId: string
  readonly contentSha256: string
}

type InstrumentKind = "continuity-meter" | "current-meter" | "thermal-imager" | "voltage-meter"

type Instrument = {
  readonly instrumentId: string
  readonly kind: InstrumentKind
  readonly manufacturer: string
  readonly model: string
  readonly serialNumber: string
  readonly calibrationArtifact: Artifact
  readonly calibrationValidFromUtc: string
  readonly calibrationValidUntilUtc: string
}

const expectedPowerContacts = [
  { contact: 1, conductorColor: "red", net: "V5_DISPLAY_LIMITED" },
  { contact: 2, conductorColor: "red", net: "V5_DISPLAY_LIMITED" },
  { contact: 3, conductorColor: "black", net: "APP_GND" },
  { contact: 4, conductorColor: "black", net: "APP_GND" }
] as const

const expectedInstrumentKinds = ["continuity-meter", "current-meter", "voltage-meter", "thermal-imager"] as const

const expectedSignalContinuity = canonicalHub75HeaderPins.map((label, index) => ({
  boardPin: index + 1,
  panelPin: index + 1,
  label
}))

export type Bp143ReceivedPanelPhysicalEvidence = {
  readonly artifactKind: "bp143-received-panel-physical-evidence"
  readonly evidenceId: string
  readonly receivedAtUtc: string
  readonly recordedAtUtc: string
  readonly operator: string
  readonly panel: {
    readonly manufacturer: "Adafruit Industries"
    readonly productId: "2277"
    readonly model: "64x32 RGB LED Matrix - 5mm pitch"
    readonly pcbRevision: string
    readonly panelSerialOrAssetId: string
    readonly receiptArtifact: Artifact
  }
  readonly prototype: {
    readonly assemblyId: string
    readonly boardRevision: string
    readonly boardSerialOrAssetId: string
    readonly hub75BoardHeaderMpn: "TST-108-04-G-D-RA"
  }
  readonly signalCable: {
    readonly manufacturer: "Adafruit Industries"
    readonly productId: "4170"
    readonly cableSerialOrAssetId: string
    readonly pinOneMarker: "white stripe"
    readonly receiptArtifact: Artifact
  }
  readonly powerCable: {
    readonly manufacturer: "Adafruit Industries"
    readonly productId: "4767"
    readonly cableSerialOrAssetId: string
    readonly panelSideHousingMpn: "SMR-04V-N"
    readonly cableSideHousingMpn: "SMP-04V-NC"
    readonly receiptArtifact: Artifact
  }
  readonly procedure: Artifact & { readonly revision: string }
  readonly setupArtifact: Artifact
  readonly instruments: readonly Instrument[]
  readonly continuity: {
    readonly status: "measured"
    readonly instrumentId: string
    readonly acceptanceCriteriaArtifact: Artifact
    readonly captureArtifact: Artifact
    readonly signalPins: readonly {
      readonly boardPin: number
      readonly panelPin: number
      readonly label: string
      readonly resistanceOhms: number
    }[]
    readonly powerBranches: readonly {
      readonly branch: 1 | 2
      readonly contacts: readonly {
        readonly contact: number
        readonly conductorColor: string
        readonly net: string
        readonly resistanceOhms: number
      }[]
    }[]
  }
  readonly mating: {
    readonly status: "measured"
    readonly captureArtifact: Artifact
    readonly signalCableMatedToPanelInput: true
    readonly signalCableMatedToPanelOutput: false
    readonly signalKeyFullySeated: true
    readonly powerBranchOneLatchEngaged: true
    readonly powerBranchTwoLatchEngaged: true
  }
  readonly orientation: {
    readonly status: "measured"
    readonly captureArtifact: Artifact
    readonly panelInputPinOneIdentified: true
    readonly boardHeaderPinOneIdentified: true
    readonly cableWhiteStripeAtPinOne: true
    readonly powerPolarityConfirmed: true
  }
  readonly current: {
    readonly status: "measured"
    readonly instrumentId: string
    readonly declaredDisplayPatternArtifact: Artifact
    readonly captureArtifact: Artifact
    readonly averageCurrentA: number
    readonly peakCurrentA: number
    readonly panelEndVoltageV: number
  }
  readonly cableDrop: {
    readonly status: "measured"
    readonly voltageInstrumentId: string
    readonly branchCurrentInstrumentId: string
    readonly declaredDisplayPatternArtifactId: string
    readonly captureArtifact: Artifact
    readonly supplyEndVoltageV: number
    readonly panelEndVoltageV: number
    readonly dropV: number
    readonly powerBranchOneCurrentA: number
    readonly powerBranchTwoCurrentA: number
  }
  readonly connectorTemperature: {
    readonly status: "measured"
    readonly instrumentId: string
    readonly captureArtifact: Artifact
    readonly ambientTemperatureC: number
    readonly panelPowerConnectorTemperatureC: number
    readonly harnessPowerConnectorTemperatureC: number
  }
  readonly fit: {
    readonly status: "measured"
    readonly fixtureOrEnclosureId: string
    readonly captureArtifact: Artifact
    readonly panelInputAccessible: true
    readonly panelOutputUnconnected: true
    readonly signalCableNoForcedBend: true
    readonly powerCableNoForcedBend: true
    readonly connectorLatchesAccessible: true
    readonly interferenceObserved: false
  }
}

export type Bp143ReceivedPanelEvidenceEvaluation = {
  readonly intakeComplete: boolean
  readonly fabricationAuthorized: false
  readonly releaseState: "deny"
  readonly reasons: readonly string[]
}

function isPlainRecord(value: unknown): value is DataRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function hasExactKeys(value: unknown, expected: readonly string[]): value is DataRecord {
  if (!isPlainRecord(value)) return false
  const keys = Object.keys(value)
  return keys.length === expected.length && expected.every((key) => keys.includes(key))
}

function inspectDataGraph(value: unknown, path: string, seen: WeakSet<object>, reasons: string[]): void {
  if (value === null || typeof value !== "object") return
  if (seen.has(value)) {
    reasons.push(`${path} contains an alias or cycle`)
    return
  }
  seen.add(value)
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) {
      reasons.push(`${path} must be a dense plain array`)
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
  if (!isPlainRecord(value)) {
    reasons.push(`${path} must be a plain data record`)
    return
  }
  for (const key of Reflect.ownKeys(value)) {
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

function nonEmptyIdentity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !/\b(?:tbd|unknown|n\/a)\b/iu.test(value)
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function finiteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function denyEvaluation(reasons: readonly string[]): Bp143ReceivedPanelEvidenceEvaluation {
  return Object.freeze({
    intakeComplete: false,
    fabricationAuthorized: false,
    releaseState: "deny",
    reasons: Object.freeze([...reasons])
  })
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-143 canonical intake cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-143 canonical intake may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function validateArtifact(
  value: unknown,
  path: string,
  artifactIds: Set<string>,
  digests: Set<string>,
  reasons: string[]
): void {
  if (!hasExactKeys(value, ["artifactId", "contentSha256"])) {
    reasons.push(`${path} must contain an artifact ID and lowercase SHA-256`)
    return
  }
  if (!nonEmptyIdentity(value.artifactId) || !isSha256(value.contentSha256)) {
    reasons.push(`${path} must contain an artifact ID and lowercase SHA-256`)
    return
  }
  if (artifactIds.has(value.artifactId) || digests.has(value.contentSha256)) {
    reasons.push(`${path} artifact ID and SHA-256 must be unique`)
    return
  }
  artifactIds.add(value.artifactId)
  digests.add(value.contentSha256)
}

function validateInstrumentSet(
  value: unknown,
  recordedAtUtc: unknown,
  artifactIds: Set<string>,
  digests: Set<string>,
  reasons: string[]
): Map<string, InstrumentKind> {
  const kindsById = new Map<string, InstrumentKind>()
  if (!Array.isArray(value) || value.length !== expectedInstrumentKinds.length) {
    reasons.push(
      "exactly one calibrated continuity meter, current meter, voltage meter, and thermal imager are required"
    )
    return kindsById
  }
  const recordedAt = typeof recordedAtUtc === "string" ? parseCanonicalUtcTimestamp(recordedAtUtc) : null
  for (const instrument of value) {
    if (
      !hasExactKeys(instrument, [
        "instrumentId",
        "kind",
        "manufacturer",
        "model",
        "serialNumber",
        "calibrationArtifact",
        "calibrationValidFromUtc",
        "calibrationValidUntilUtc"
      ])
    ) {
      reasons.push("every instrument must use the exact calibrated-instrument schema")
      continue
    }
    if (
      !nonEmptyIdentity(instrument.instrumentId) ||
      !expectedInstrumentKinds.includes(instrument.kind as InstrumentKind) ||
      !nonEmptyIdentity(instrument.manufacturer) ||
      !nonEmptyIdentity(instrument.model) ||
      !nonEmptyIdentity(instrument.serialNumber) ||
      kindsById.has(instrument.instrumentId)
    ) {
      reasons.push("instrument identity must be exact, nonblank, and unique")
    } else {
      kindsById.set(instrument.instrumentId, instrument.kind as InstrumentKind)
    }
    validateArtifact(
      instrument.calibrationArtifact,
      `instrument ${String(instrument.instrumentId)} calibration`,
      artifactIds,
      digests,
      reasons
    )
    const validFrom =
      typeof instrument.calibrationValidFromUtc === "string"
        ? parseCanonicalUtcTimestamp(instrument.calibrationValidFromUtc)
        : null
    const validUntil =
      typeof instrument.calibrationValidUntilUtc === "string"
        ? parseCanonicalUtcTimestamp(instrument.calibrationValidUntilUtc)
        : null
    if (validFrom === null || validUntil === null || validFrom.getTime() >= validUntil.getTime()) {
      reasons.push(`instrument ${String(instrument.instrumentId)} calibration interval is invalid`)
    } else if (
      recordedAt === null ||
      recordedAt.getTime() < validFrom.getTime() ||
      recordedAt.getTime() > validUntil.getTime()
    ) {
      reasons.push(`instrument ${String(instrument.instrumentId)} calibration is not valid at the record time`)
    }
  }
  if (
    expectedInstrumentKinds.some(
      (kind) => !value.some((instrument) => isPlainRecord(instrument) && instrument.kind === kind)
    )
  ) {
    reasons.push("each required calibrated instrument kind must be present exactly once")
  }
  return kindsById
}

/**
 * Evaluates a submitted physical record. A complete intake is still not a
 * fabrication approval: numeric acceptance limits live in the separately
 * hash-bound procedure because the panel's source material does not publish
 * all needed test limits.
 */
export function evaluateBp143ReceivedPanelPhysicalEvidence(value: unknown): Bp143ReceivedPanelEvidenceEvaluation {
  const reasons: string[] = []
  inspectDataGraph(value, "bp143Evidence", new WeakSet<object>(), reasons)
  if (reasons.length > 0) return denyEvaluation(reasons)
  if (
    !hasExactKeys(value, [
      "artifactKind",
      "evidenceId",
      "receivedAtUtc",
      "recordedAtUtc",
      "operator",
      "panel",
      "prototype",
      "signalCable",
      "powerCable",
      "procedure",
      "setupArtifact",
      "instruments",
      "continuity",
      "mating",
      "orientation",
      "current",
      "cableDrop",
      "connectorTemperature",
      "fit"
    ])
  ) {
    return denyEvaluation(["physical evidence must contain only the exact BP-143 data keys"])
  }

  const artifactIds = new Set<string>()
  const digests = new Set<string>()
  if (value.artifactKind !== "bp143-received-panel-physical-evidence") reasons.push("artifact kind is invalid")
  if (!nonEmptyIdentity(value.evidenceId) || !nonEmptyIdentity(value.operator))
    reasons.push("evidence ID and operator are required")
  const receivedAt = typeof value.receivedAtUtc === "string" ? parseCanonicalUtcTimestamp(value.receivedAtUtc) : null
  const recordedAt = typeof value.recordedAtUtc === "string" ? parseCanonicalUtcTimestamp(value.recordedAtUtc) : null
  if (
    receivedAt === null ||
    recordedAt === null ||
    receivedAt.getTime() > recordedAt.getTime() ||
    receivedAt.getTime() > Date.now() ||
    recordedAt.getTime() > Date.now()
  ) {
    reasons.push("receipt and record timestamps must be real canonical UTC, non-future, and ordered")
  }

  if (
    !hasExactKeys(value.panel, [
      "manufacturer",
      "productId",
      "model",
      "pcbRevision",
      "panelSerialOrAssetId",
      "receiptArtifact"
    ]) ||
    value.panel.manufacturer !== "Adafruit Industries" ||
    value.panel.productId !== "2277" ||
    value.panel.model !== "64x32 RGB LED Matrix - 5mm pitch" ||
    !nonEmptyIdentity(value.panel.pcbRevision) ||
    !nonEmptyIdentity(value.panel.panelSerialOrAssetId)
  ) {
    reasons.push("received panel identity must be the exact 2277 manufacturer, model, revision, and serial or asset")
  } else validateArtifact(value.panel.receiptArtifact, "panel receipt", artifactIds, digests, reasons)
  if (
    !hasExactKeys(value.prototype, ["assemblyId", "boardRevision", "boardSerialOrAssetId", "hub75BoardHeaderMpn"]) ||
    !nonEmptyIdentity(value.prototype.assemblyId) ||
    !nonEmptyIdentity(value.prototype.boardRevision) ||
    !nonEmptyIdentity(value.prototype.boardSerialOrAssetId) ||
    value.prototype.hub75BoardHeaderMpn !== "TST-108-04-G-D-RA"
  )
    reasons.push("board or prototype identity must bind the exact Samtec HUB75 header")
  if (
    !hasExactKeys(value.signalCable, [
      "manufacturer",
      "productId",
      "cableSerialOrAssetId",
      "pinOneMarker",
      "receiptArtifact"
    ]) ||
    value.signalCable.manufacturer !== "Adafruit Industries" ||
    value.signalCable.productId !== "4170" ||
    !nonEmptyIdentity(value.signalCable.cableSerialOrAssetId) ||
    value.signalCable.pinOneMarker !== "white stripe"
  )
    reasons.push("received signal cable identity must be the exact Adafruit 4170 article with its pin-one marker")
  else validateArtifact(value.signalCable.receiptArtifact, "signal cable receipt", artifactIds, digests, reasons)
  if (
    !hasExactKeys(value.powerCable, [
      "manufacturer",
      "productId",
      "cableSerialOrAssetId",
      "panelSideHousingMpn",
      "cableSideHousingMpn",
      "receiptArtifact"
    ]) ||
    value.powerCable.manufacturer !== "Adafruit Industries" ||
    value.powerCable.productId !== "4767" ||
    !nonEmptyIdentity(value.powerCable.cableSerialOrAssetId) ||
    value.powerCable.panelSideHousingMpn !== "SMR-04V-N" ||
    value.powerCable.cableSideHousingMpn !== "SMP-04V-NC"
  )
    reasons.push("received power cable identity must be the exact Adafruit 4767 and JST SM mating identities")
  else validateArtifact(value.powerCable.receiptArtifact, "power cable receipt", artifactIds, digests, reasons)
  if (
    !hasExactKeys(value.procedure, ["revision", "artifactId", "contentSha256"]) ||
    !nonEmptyIdentity(value.procedure.revision)
  ) {
    reasons.push("an exact hash-bound procedure revision is required")
  } else {
    validateArtifact(
      { artifactId: value.procedure.artifactId, contentSha256: value.procedure.contentSha256 },
      "procedure",
      artifactIds,
      digests,
      reasons
    )
  }
  validateArtifact(value.setupArtifact, "setup", artifactIds, digests, reasons)
  const instrumentKinds = validateInstrumentSet(value.instruments, value.recordedAtUtc, artifactIds, digests, reasons)

  if (
    !hasExactKeys(value.continuity, [
      "status",
      "instrumentId",
      "acceptanceCriteriaArtifact",
      "captureArtifact",
      "signalPins",
      "powerBranches"
    ])
  ) {
    reasons.push("continuity must use the exact signal and two-branch power schema")
  } else {
    if (
      value.continuity.status !== "measured" ||
      instrumentKinds.get(String(value.continuity.instrumentId)) !== "continuity-meter"
    )
      reasons.push("continuity must name a calibrated continuity meter and measured status")
    validateArtifact(value.continuity.acceptanceCriteriaArtifact, "continuity criteria", artifactIds, digests, reasons)
    validateArtifact(value.continuity.captureArtifact, "continuity capture", artifactIds, digests, reasons)
    if (
      !Array.isArray(value.continuity.signalPins) ||
      value.continuity.signalPins.length !== expectedSignalContinuity.length ||
      value.continuity.signalPins.some((entry, index) => {
        const expected = expectedSignalContinuity[index]
        return (
          !hasExactKeys(entry, ["boardPin", "panelPin", "label", "resistanceOhms"]) ||
          entry.boardPin !== expected?.boardPin ||
          entry.panelPin !== expected?.panelPin ||
          entry.label !== expected?.label ||
          !finiteNonnegative(entry.resistanceOhms)
        )
      })
    )
      reasons.push("continuity must prove all 16 exact straight-through HUB75 pins with finite resistance")
    if (
      !Array.isArray(value.continuity.powerBranches) ||
      value.continuity.powerBranches.length !== 2 ||
      value.continuity.powerBranches.some(
        (branch, index) =>
          !hasExactKeys(branch, ["branch", "contacts"]) ||
          branch.branch !== index + 1 ||
          !Array.isArray(branch.contacts) ||
          branch.contacts.length !== expectedPowerContacts.length ||
          branch.contacts.some((contact, contactIndex) => {
            const expected = expectedPowerContacts[contactIndex]
            return (
              !hasExactKeys(contact, ["contact", "conductorColor", "net", "resistanceOhms"]) ||
              contact.contact !== expected?.contact ||
              contact.conductorColor !== expected?.conductorColor ||
              contact.net !== expected?.net ||
              !finiteNonnegative(contact.resistanceOhms)
            )
          })
      )
    )
      reasons.push("continuity must prove every red and black contact in both exact power branches")
  }

  if (
    !hasExactKeys(value.mating, [
      "status",
      "captureArtifact",
      "signalCableMatedToPanelInput",
      "signalCableMatedToPanelOutput",
      "signalKeyFullySeated",
      "powerBranchOneLatchEngaged",
      "powerBranchTwoLatchEngaged"
    ]) ||
    value.mating.status !== "measured" ||
    value.mating.signalCableMatedToPanelInput !== true ||
    value.mating.signalCableMatedToPanelOutput !== false ||
    value.mating.signalKeyFullySeated !== true ||
    value.mating.powerBranchOneLatchEngaged !== true ||
    value.mating.powerBranchTwoLatchEngaged !== true
  )
    reasons.push("mating must prove the keyed signal INPUT and both latched power branches")
  else validateArtifact(value.mating.captureArtifact, "mating capture", artifactIds, digests, reasons)
  if (
    !hasExactKeys(value.orientation, [
      "status",
      "captureArtifact",
      "panelInputPinOneIdentified",
      "boardHeaderPinOneIdentified",
      "cableWhiteStripeAtPinOne",
      "powerPolarityConfirmed"
    ]) ||
    value.orientation.status !== "measured" ||
    value.orientation.panelInputPinOneIdentified !== true ||
    value.orientation.boardHeaderPinOneIdentified !== true ||
    value.orientation.cableWhiteStripeAtPinOne !== true ||
    value.orientation.powerPolarityConfirmed !== true
  )
    reasons.push("orientation must prove both pin-one datums and power polarity")
  else validateArtifact(value.orientation.captureArtifact, "orientation capture", artifactIds, digests, reasons)

  if (
    !hasExactKeys(value.current, [
      "status",
      "instrumentId",
      "declaredDisplayPatternArtifact",
      "captureArtifact",
      "averageCurrentA",
      "peakCurrentA",
      "panelEndVoltageV"
    ])
  ) {
    reasons.push("current measurement must use the exact schema")
  } else {
    if (
      value.current.status !== "measured" ||
      instrumentKinds.get(String(value.current.instrumentId)) !== "current-meter" ||
      !finiteNonnegative(value.current.averageCurrentA) ||
      !finiteNonnegative(value.current.peakCurrentA) ||
      value.current.peakCurrentA < value.current.averageCurrentA ||
      !finiteNonnegative(value.current.panelEndVoltageV)
    )
      reasons.push("current measurement must be finite, ordered, and calibrated")
    validateArtifact(
      value.current.declaredDisplayPatternArtifact,
      "declared display pattern",
      artifactIds,
      digests,
      reasons
    )
    validateArtifact(value.current.captureArtifact, "current capture", artifactIds, digests, reasons)
  }
  const currentPatternArtifactId =
    isPlainRecord(value.current) && isPlainRecord(value.current.declaredDisplayPatternArtifact)
      ? value.current.declaredDisplayPatternArtifact.artifactId
      : null
  const currentPanelEndVoltageV = isPlainRecord(value.current) ? value.current.panelEndVoltageV : null
  if (
    !hasExactKeys(value.cableDrop, [
      "status",
      "voltageInstrumentId",
      "branchCurrentInstrumentId",
      "declaredDisplayPatternArtifactId",
      "captureArtifact",
      "supplyEndVoltageV",
      "panelEndVoltageV",
      "dropV",
      "powerBranchOneCurrentA",
      "powerBranchTwoCurrentA"
    ])
  ) {
    reasons.push("cable-drop measurement must use the exact schema")
  } else {
    const expectedDrop =
      typeof value.cableDrop.supplyEndVoltageV === "number" && typeof value.cableDrop.panelEndVoltageV === "number"
        ? value.cableDrop.supplyEndVoltageV - value.cableDrop.panelEndVoltageV
        : Number.NaN
    if (
      value.cableDrop.status !== "measured" ||
      instrumentKinds.get(String(value.cableDrop.voltageInstrumentId)) !== "voltage-meter" ||
      instrumentKinds.get(String(value.cableDrop.branchCurrentInstrumentId)) !== "current-meter" ||
      value.cableDrop.declaredDisplayPatternArtifactId !== currentPatternArtifactId ||
      Math.abs(Number(value.cableDrop.panelEndVoltageV) - Number(currentPanelEndVoltageV)) > 0.001 ||
      !finiteNonnegative(value.cableDrop.supplyEndVoltageV) ||
      !finiteNonnegative(value.cableDrop.panelEndVoltageV) ||
      !finiteNonnegative(value.cableDrop.dropV) ||
      !finiteNonnegative(value.cableDrop.powerBranchOneCurrentA) ||
      !finiteNonnegative(value.cableDrop.powerBranchTwoCurrentA) ||
      Math.abs(expectedDrop - Number(value.cableDrop.dropV)) > 0.001
    )
      reasons.push("cable-drop measurement must be finite, calibrated, and arithmetically bound")
    validateArtifact(value.cableDrop.captureArtifact, "cable-drop capture", artifactIds, digests, reasons)
  }
  if (
    !hasExactKeys(value.connectorTemperature, [
      "status",
      "instrumentId",
      "captureArtifact",
      "ambientTemperatureC",
      "panelPowerConnectorTemperatureC",
      "harnessPowerConnectorTemperatureC"
    ])
  ) {
    reasons.push("connector-temperature measurement must use the exact schema")
  } else {
    if (
      value.connectorTemperature.status !== "measured" ||
      instrumentKinds.get(String(value.connectorTemperature.instrumentId)) !== "thermal-imager" ||
      !finiteNumber(value.connectorTemperature.ambientTemperatureC) ||
      !finiteNumber(value.connectorTemperature.panelPowerConnectorTemperatureC) ||
      !finiteNumber(value.connectorTemperature.harnessPowerConnectorTemperatureC)
    )
      reasons.push("connector-temperature measurement must be finite and calibrated")
    validateArtifact(
      value.connectorTemperature.captureArtifact,
      "connector-temperature capture",
      artifactIds,
      digests,
      reasons
    )
  }
  if (
    !hasExactKeys(value.fit, [
      "status",
      "fixtureOrEnclosureId",
      "captureArtifact",
      "panelInputAccessible",
      "panelOutputUnconnected",
      "signalCableNoForcedBend",
      "powerCableNoForcedBend",
      "connectorLatchesAccessible",
      "interferenceObserved"
    ]) ||
    value.fit.status !== "measured" ||
    !nonEmptyIdentity(value.fit.fixtureOrEnclosureId) ||
    value.fit.panelInputAccessible !== true ||
    value.fit.panelOutputUnconnected !== true ||
    value.fit.signalCableNoForcedBend !== true ||
    value.fit.powerCableNoForcedBend !== true ||
    value.fit.connectorLatchesAccessible !== true ||
    value.fit.interferenceObserved !== false
  )
    reasons.push(
      "fit must prove accessible input, unconnected output, serviceable latches, no forced bend, and no interference"
    )
  else validateArtifact(value.fit.captureArtifact, "fit capture", artifactIds, digests, reasons)

  return Object.freeze({
    intakeComplete: reasons.length === 0,
    fabricationAuthorized: false,
    releaseState: "deny",
    reasons: Object.freeze([...reasons])
  })
}

/** Submission schema only. It intentionally contains no receipt or measurement. */
export const bp143ReceivedPanelPhysicalEvidenceIntake = deepFreeze({
  artifactKind: "bp143-received-panel-physical-evidence-intake",
  workUnit: "BP-143",
  state: "absent",
  requiredSections: [
    "identity",
    "continuity",
    "mating",
    "orientation",
    "current",
    "cable-drop",
    "connector-temperature",
    "fit"
  ],
  receivedPanelEvidence: null,
  authority: {
    physicalEvidenceAccepted: false,
    schematicIntegrationAuthorized: false,
    footprintAuthorized: false,
    layoutAuthorized: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const)
