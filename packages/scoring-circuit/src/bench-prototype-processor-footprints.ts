/** BP-032: fail-closed processor, isolation, reset, clock, and debug-footprint ledger. */

import { benchPrototypeBom, validateBenchPrototypeBom } from "./bench-prototype-bom.js"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import {
  benchPrototypeFootprintReviewTemplate,
  validateBenchPrototypeFootprintReview
} from "./bench-prototype-footprint-review.js"
import {
  benchPrototypeIsolationChannel,
  validateBenchPrototypeIsolationChannel
} from "./bench-prototype-isolation-channel.js"
import {
  benchPrototypeProcessorSupport,
  validateBenchPrototypeProcessorSupport
} from "./bench-prototype-processor-support.js"
import { benchPrototypeResetWatchdog, validateBenchPrototypeResetWatchdog } from "./bench-prototype-reset-watchdog.js"
import {
  benchPrototypeServiceHeaders,
  validateBenchPrototypeServiceHeaders
} from "./bench-prototype-service-headers.js"
import { findFootprintReleaseEvidence } from "./footprint-release-evidence.js"
import { stm32PinAllocation, validateStm32PinAllocation } from "./stm32-pin-allocation.js"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Canonical BP-032 ledger cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-032 ledger may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object")
    return Object.is(actual, expected)
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
  )
    return false
  return expectedKeys.every((key) => {
    const left = Object.getOwnPropertyDescriptor(actual, key)
    const right = Object.getOwnPropertyDescriptor(expected, key)
    return (
      left !== undefined &&
      right !== undefined &&
      "value" in left &&
      "value" in right &&
      left.enumerable === right.enumerable &&
      sameDataGraph(left.value, right.value, actualSeen, expectedSeen)
    )
  })
}

function packageFor(mpn: string): string {
  const packages: Record<string, string> = {
    BSS138AKA: "SOT-23",
    C0603C104K3RACTU: "0603",
    C1608X5R1A105K080AC: "0603",
    ISO7721FDR: "SOIC-8",
    ISO7762FDWR: "SOIC-16 wide",
    NXE1S0505MC: "SMD 7-pin",
    "RC0603FR-07100KL": "0603",
    "RC0603FR-0710KL": "0603",
    SN74LVC2G07DCKR: "SC70-6",
    TPS3431SDRBR: "VSON-8",
    TPS389033DSER: "WSON-6"
  }
  const value = packages[mpn]
  if (value === undefined) throw new RangeError(`BP-032 has no reviewed package identity for ${mpn}`)
  return value
}

const evidence = (mpn: string | null) => ({
  priorGateReferences: mpn === null ? [] : [...(findFootprintReleaseEvidence(mpn)?.gateReferences ?? [])],
  manufacturerDrawing: "required-not-acquired",
  manufacturerCad: "required-not-acquired",
  copper: "not-claimed",
  solderMask: "not-claimed",
  paste: "not-claimed",
  courtyard: "not-claimed",
  artwork: "not-generated",
  orientation: "unreviewed"
})

const resetLedger = benchPrototypeResetWatchdog.parts.map((part) => ({
  reference: part.reference,
  mpn: part.mpn,
  package: packageFor(part.mpn),
  population: "selected-awaiting-footprint-evidence",
  source: "BP-123 reset/watchdog contract",
  evidence: evidence(part.mpn)
}))

function processorSupportReferenceContract() {
  const support = benchPrototypeProcessorSupport
  const rows = [
    ...support.bypassAndBulk.stm32Digital.references.map((reference) => ({
      reference,
      mpn: support.bypassAndBulk.stm32Digital.capacitorMpn,
      value: support.bypassAndBulk.stm32Digital.value,
      population: support.bypassAndBulk.stm32Digital.population,
      section: "stm32-digital-bypass"
    })),
    {
      reference: support.bypassAndBulk.stm32Digital.bulk.reference,
      mpn: support.bypassAndBulk.stm32Digital.bulk.capacitorMpn,
      value: support.bypassAndBulk.stm32Digital.bulk.value,
      population: support.bypassAndBulk.stm32Digital.population,
      section: "stm32-digital-bulk"
    },
    ...support.bypassAndBulk.stm32Analog.vdDa.references.map((reference, index) => ({
      reference,
      mpn: support.bypassAndBulk.stm32Analog.capacitorMpn,
      value: support.bypassAndBulk.stm32Analog.vdDa.values[index],
      population: support.bypassAndBulk.stm32Analog.population,
      section: "stm32-vdda"
    })),
    ...support.bypassAndBulk.stm32Analog.vref.references.map((reference, index) => ({
      reference,
      mpn: support.bypassAndBulk.stm32Analog.capacitorMpn,
      value: support.bypassAndBulk.stm32Analog.vref.values[index],
      population: support.bypassAndBulk.stm32Analog.population,
      section: "stm32-vref"
    })),
    {
      reference: support.bypassAndBulk.stm32Vbat.reference,
      mpn: support.bypassAndBulk.stm32Vbat.capacitorMpn,
      value: support.bypassAndBulk.stm32Vbat.value,
      population: support.bypassAndBulk.stm32Vbat.population,
      section: "stm32-vbat"
    },
    ...support.bypassAndBulk.esp32.references.map((reference, index) => ({
      reference,
      mpn: support.bypassAndBulk.esp32.capacitorMpn,
      value: support.bypassAndBulk.esp32.values[index],
      population: support.bypassAndBulk.esp32.population,
      section: "esp32-supply"
    })),
    {
      reference: support.bootAndReset.stm32.boot0.reference,
      mpn: support.bootAndReset.stm32.boot0.mpn,
      value: support.bootAndReset.stm32.boot0.value,
      population: support.bootAndReset.stm32.boot0.disposition,
      section: "stm32-boot"
    },
    {
      reference: support.bootAndReset.esp32.en.reference,
      mpn: support.bootAndReset.esp32.en.mpn,
      value: support.bootAndReset.esp32.en.value,
      population: "required",
      section: "esp32-reset"
    },
    {
      reference: support.bootAndReset.esp32.en.capacitorReference,
      mpn: support.bootAndReset.esp32.en.capacitorMpn,
      value: support.bootAndReset.esp32.en.capacitorValue,
      population: "required",
      section: "esp32-reset"
    },
    {
      reference: support.bootAndReset.esp32.gpio0.reference,
      mpn: support.bootAndReset.esp32.gpio0.mpn,
      value: support.bootAndReset.esp32.gpio0.value,
      population: "required",
      section: "esp32-boot"
    }
  ]
  if (rows.some((row) => row.value === undefined))
    throw new RangeError("BP-125 processor-support references and values must remain one-to-one")
  return rows
}

const processorSupportSnapshot = deepFreeze(structuredClone(processorSupportReferenceContract()))

const processorSupportLedger = processorSupportSnapshot.map((support) => {
  const selections = resetLedger.filter((part) => part.reference === support.reference)
  if (selections.length > 1) throw new RangeError(`BP-032 has duplicate BP-123 selections for ${support.reference}`)
  const selected = selections[0]
  if (selected === undefined && support.mpn !== "TBD") {
    return {
      ...structuredClone(support),
      reconciliation: "selected-by-BP-125",
      selectedMpn: support.mpn,
      package: packageFor(support.mpn),
      source: "BP-125 exact manufacturer-source selection",
      evidence: evidence(support.mpn)
    }
  }
  return selected === undefined
    ? {
        ...structuredClone(support),
        reconciliation: "DNP-until-exact-selection",
        selectedMpn: null,
        package: null,
        source: "BP-125 required support with MPN intentionally TBD",
        evidence: evidence(null)
      }
    : {
        ...structuredClone(support),
        reconciliation: "selected-by-BP-123",
        selectedMpn: selected.mpn,
        package: selected.package,
        source: "BP-125 requirement reconciled to BP-123 exact selection",
        evidence: evidence(selected.mpn)
      }
})

const definition = {
  artifactKind: "bench-prototype-processor-footprint-closure-ledger",
  workUnit: "BP-032",
  releaseState: "deny",
  fabricationAuthorized: false,
  upstream: {
    method: "BP-030",
    isolation: "BP-122",
    reset: "BP-123",
    debug: "BP-124",
    processorSupport: "BP-125"
  },
  populatedReferences: [
    {
      reference: "U_SCORING",
      boardReference: "U_STM32",
      mpn: "STM32G474RET3TR",
      package: "LQFP-64",
      population: "selected-awaiting-footprint-evidence",
      source: "BP-120 STM32 allocation",
      evidence: evidence("STM32G474RET3TR")
    },
    {
      reference: "U_APP",
      boardReference: "U_ESP32",
      mpn: "ESP32-S3-WROOM-1U-N16R2",
      package: "WROOM-1U module",
      population: "selected-awaiting-footprint-evidence",
      source: "BP-121 ESP32 allocation and BP-125 module support",
      evidence: evidence("ESP32-S3-WROOM-1U-N16R2")
    },
    {
      reference: "U_ISO_MAIN",
      boardReference: "U_ISO_MAIN",
      mpn: "ISO7762FDWR",
      package: "SOIC-16 wide",
      population: "selected-awaiting-footprint-evidence",
      source: "BP-122 main isolation channel",
      evidence: evidence("ISO7762FDWR")
    },
    {
      reference: "U_ISO_AUX",
      boardReference: "U_ISO_AUX",
      mpn: "ISO7721FDR",
      package: "SOIC-8",
      population: "selected-awaiting-footprint-evidence",
      source: "BP-122 auxiliary isolation channel",
      evidence: evidence("ISO7721FDR")
    },
    {
      reference: "U_ISO_POWER",
      boardReference: "U_ISOLATED_POWER",
      mpn: "NXE1S0505MC",
      package: "SMD 7-pin",
      population: "selected-awaiting-footprint-evidence",
      source: "BP-122 isolated-power channel",
      evidence: evidence("NXE1S0505MC")
    },
    ...resetLedger
  ],
  debugReferences: [
    {
      reference: "J_STM_SWD",
      mpn: "FTSH-105-01-L-DV-007-K",
      package: "2x5 1.27 mm surface-mount keyed header",
      population: "DNP-until-footprint-and-mating-evidence",
      source: "BP-124 STM32 service header",
      evidence: evidence("FTSH-105-01-L-DV-007-K")
    },
    {
      reference: "J_ESP_SERVICE",
      mpn: "TSW-106-07-G-S",
      package: "1x6 2.54 mm through-hole header",
      population: "DNP-until-footprint-and-mating-evidence",
      source: "BP-124 ESP32 service header",
      evidence: evidence("TSW-106-07-G-S")
    }
  ],
  clockReferences: [
    {
      reference: "X_STM_HSE",
      pads: ["PF0-OSC_IN", "PF1-OSC_OUT"],
      mpn: null,
      population: "DNP",
      rule: "No HSE oscillator, crystal, loads, or bias network is selected."
    },
    {
      reference: "X_STM_LSE",
      pads: ["PC14-OSC32_IN", "PC15-OSC32_OUT"],
      mpn: null,
      population: "DNP",
      rule: "No LSE or backup-time source is allocated."
    },
    {
      reference: "X_ESP32_MODULE",
      mpn: "inside ESP32-S3-WROOM-1U-N16R2",
      population: "module-integrated",
      rule: "No host-board 40 MHz source or crystal is authorized."
    }
  ],
  processorSupportReferences: processorSupportLedger,
  requiredIndependentEvidence: [
    "Exact manufacturer package drawing revision and SHA-256 archive.",
    "Exact manufacturer CAD/land-pattern revision and SHA-256 archive.",
    "Generated CAD artwork review for copper, solder mask, paste, and courtyard; no geometry is claimed by BP-032.",
    "Independent pin-1, exposed-pad, key, antenna, and assembly-orientation review with dated reviewer record.",
    "For the WROOM-1U, module land pattern, EPAD vias/paste, external antenna connector/cable clearance, retention, and antenna keepout review."
  ],
  evidence: {
    drawingCadEvidenceComplete: false,
    artworkGenerated: false,
    orientationReviewed: false,
    HseLseSelectionApproved: false,
    footprintClosure: false,
    fabricationAuthorized: false
  }
} as const

export const benchPrototypeProcessorFootprints = deepFreeze(definition)
const upstreamSnapshot = deepFreeze({
  footprintMethod: {
    artifactKind: benchPrototypeFootprintReviewTemplate.artifactKind,
    methodId: benchPrototypeFootprintReviewTemplate.methodId,
    bomArtifactKind: benchPrototypeFootprintReviewTemplate.bomArtifactKind,
    fabricationRelease: benchPrototypeFootprintReviewTemplate.fabricationRelease,
    footprintClosure: benchPrototypeFootprintReviewTemplate.footprintClosure,
    releaseState: benchPrototypeFootprintReviewTemplate.releaseState
  },
  stm32: { part: stm32PinAllocation.part, package: stm32PinAllocation.package },
  esp32: { moduleMpn: benchPrototypeEsp32Allocation.moduleMpn },
  isolators: {
    main: benchPrototypeIsolationChannel.isolators.main.part,
    auxiliary: benchPrototypeIsolationChannel.isolators.auxiliary.part,
    power: benchPrototypeIsolationChannel.domains.digitalIsolation.powerPart
  },
  resetParts: structuredClone(benchPrototypeResetWatchdog.parts),
  debug: {
    stm: benchPrototypeServiceHeaders.stm32.header.mpn,
    esp: benchPrototypeServiceHeaders.esp32.header.mpn
  },
  clocks: structuredClone(benchPrototypeProcessorSupport.oscillators),
  processorSupportReferences: structuredClone(processorSupportSnapshot)
})

export const benchPrototypeProcessorFootprintsUpstreamProvenance = upstreamSnapshot

function currentUpstreamSnapshot() {
  return {
    footprintMethod: {
      artifactKind: benchPrototypeFootprintReviewTemplate.artifactKind,
      methodId: benchPrototypeFootprintReviewTemplate.methodId,
      bomArtifactKind: benchPrototypeFootprintReviewTemplate.bomArtifactKind,
      fabricationRelease: benchPrototypeFootprintReviewTemplate.fabricationRelease,
      footprintClosure: benchPrototypeFootprintReviewTemplate.footprintClosure,
      releaseState: benchPrototypeFootprintReviewTemplate.releaseState
    },
    stm32: { part: stm32PinAllocation.part, package: stm32PinAllocation.package },
    esp32: { moduleMpn: benchPrototypeEsp32Allocation.moduleMpn },
    isolators: {
      main: benchPrototypeIsolationChannel.isolators.main.part,
      auxiliary: benchPrototypeIsolationChannel.isolators.auxiliary.part,
      power: benchPrototypeIsolationChannel.domains.digitalIsolation.powerPart
    },
    resetParts: structuredClone(benchPrototypeResetWatchdog.parts),
    debug: {
      stm: benchPrototypeServiceHeaders.stm32.header.mpn,
      esp: benchPrototypeServiceHeaders.esp32.header.mpn
    },
    clocks: structuredClone(benchPrototypeProcessorSupport.oscillators),
    processorSupportReferences: structuredClone(processorSupportReferenceContract())
  }
}

export function validateBenchPrototypeProcessorFootprintsUpstreamProvenance(value: unknown): true {
  if (!sameDataGraph(value, upstreamSnapshot))
    throw new RangeError("BP-032 BP-030 method or complete BP-125 processor-support provenance drifted")
  return true
}

export function validateBenchPrototypeProcessorFootprints(value: unknown): true {
  validateBenchPrototypeBom(benchPrototypeBom)
  validateBenchPrototypeFootprintReview(benchPrototypeFootprintReviewTemplate)
  validateStm32PinAllocation(stm32PinAllocation)
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  validateBenchPrototypeIsolationChannel(benchPrototypeIsolationChannel)
  validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)
  validateBenchPrototypeServiceHeaders(benchPrototypeServiceHeaders)
  validateBenchPrototypeProcessorSupport(benchPrototypeProcessorSupport)
  if (!sameDataGraph(value, benchPrototypeProcessorFootprints))
    throw new RangeError("BP-032 ledger must exactly match the reviewed canonical decision")
  validateBenchPrototypeProcessorFootprintsUpstreamProvenance(currentUpstreamSnapshot())
  const ledger = benchPrototypeProcessorFootprints
  const unresolvedProcessorSupport = ledger.processorSupportReferences.filter(
    (entry) => entry.reconciliation === "DNP-until-exact-selection"
  )
  const bp125SelectedSupport = ledger.processorSupportReferences.filter(
    (entry) => entry.reconciliation === "selected-by-BP-125"
  )
  const references = [
    ...ledger.populatedReferences,
    ...ledger.debugReferences,
    ...ledger.clockReferences,
    ...unresolvedProcessorSupport,
    ...bp125SelectedSupport
  ]
  if (
    new Set(references.map((entry) => entry.reference)).size !== references.length ||
    ledger.populatedReferences.some(
      (entry) =>
        entry.mpn === null ||
        entry.population !== "selected-awaiting-footprint-evidence" ||
        entry.evidence.copper !== "not-claimed"
    ) ||
    ledger.debugReferences.some((entry) => entry.population !== "DNP-until-footprint-and-mating-evidence") ||
    ledger.clockReferences[0].population !== "DNP" ||
    ledger.clockReferences[1].population !== "DNP" ||
    ledger.clockReferences[2].population !== "module-integrated" ||
    ledger.processorSupportReferences.length !== processorSupportSnapshot.length ||
    unresolvedProcessorSupport.some((entry) => entry.selectedMpn !== null || entry.mpn !== "TBD") ||
    bp125SelectedSupport.some(
      (entry) => entry.mpn === "TBD" || entry.selectedMpn !== entry.mpn || entry.package === null
    ) ||
    ledger.processorSupportReferences
      .filter((entry) => entry.reconciliation === "selected-by-BP-123")
      .some(
        (entry) =>
          (entry.mpn !== "TBD" && entry.mpn !== entry.selectedMpn) ||
          !ledger.populatedReferences.some(
            (selected) => selected.reference === entry.reference && selected.mpn === entry.selectedMpn
          )
      ) ||
    ledger.evidence.drawingCadEvidenceComplete ||
    ledger.evidence.artworkGenerated ||
    ledger.evidence.orientationReviewed ||
    ledger.evidence.footprintClosure ||
    ledger.evidence.fabricationAuthorized ||
    ledger.releaseState !== "deny"
  )
    throw new RangeError(
      "BP-032 must keep every unreviewed geometry, unresolved support part, and fabrication release denied"
    )
  const expectedBom = new Map([
    ["U_SCORING", "STM32G474RET3TR"],
    ["U_APP", "ESP32-S3-WROOM-1U-N16R2"],
    ["U_ISO_MAIN", "ISO7762FDWR"],
    ["U_ISO_AUX", "ISO7721FDR"],
    ["U_ISO_POWER", "NXE1S0505MC"]
  ])
  for (const [reference, mpn] of expectedBom) {
    const row = benchPrototypeBom.rows.filter((candidate) => candidate.reference === reference)
    if (row.length !== 1 || row[0]?.disposition !== "selected" || row[0]?.mpn !== mpn)
      throw new RangeError("BP-032 selected processor/isolation BOM provenance drifted")
  }
  return true
}
