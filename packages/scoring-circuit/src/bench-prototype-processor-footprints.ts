/** BP-032: fail-closed processor, isolation, reset, clock, and debug-footprint ledger. */

import { benchPrototypeBom, validateBenchPrototypeBom } from "./bench-prototype-bom.js"
import {
  benchPrototypeBp125MurataCapacitorFootprintGeometries,
  benchPrototypeBp125MurataCapacitorReviewBindings,
  bp125MurataCapacitorFootprintIntegrityErrors
} from "./bench-prototype-bp125-murata-capacitor-footprints.js"
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
import {
  bp031032C0603C104K3RactuFootprintEvidence,
  bp031032C0603C104K3RactuFootprintEvidenceFor,
  validateBp031032C0603C104K3RactuFootprintEvidence
} from "./bp031-032-c0603c104k3ractu-footprint-evidence.js"
import {
  bp032Esp32ServiceHeaderTsw10607gsFootprintEvidence,
  validateBp032Esp32ServiceHeaderTsw10607gsFootprintEvidence
} from "./bp032-esp32-service-header-tsw-106-07-g-s-footprint-evidence.js"
import {
  bp032Ftsh10501LDv007KFootprintEvidence,
  validateBp032Ftsh10501LDv007KFootprintEvidence
} from "./bp032-ftsh-105-01-l-dv-007-k-footprint.js"
import {
  bp032ResetSupportFootprintEvidence,
  validateBp032ResetSupportFootprintEvidence
} from "./bp032-reset-support-footprints.js"
import {
  bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence,
  validateBp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence
} from "./bp032-stm32g474ret3tr-lqfp64-project-footprint.js"
import {
  bp032SupervisorWatchdogFootprintEvidence,
  validateBp032SupervisorWatchdogFootprintEvidence
} from "./bp032-supervisor-watchdog-footprint-evidence.js"
import {
  bp032TdkC1608CapacitorFootprintEvidence,
  bp032TdkC1608FootprintEvidenceFor
} from "./bp032-tdk-c1608-capacitor-footprint-evidence.js"
import {
  bp032TiIsolatorFootprintEvidence,
  validateBp032TiIsolatorFootprintEvidence
} from "./bp032-ti-isolator-footprint-evidence.js"
import {
  bp032YageoRc0603FootprintEvidenceFor,
  bp032YageoRc0603ResistorFootprintEvidence
} from "./bp032-yageo-rc0603-resistor-footprint-evidence.js"
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
    GCM188R71H103KA37D: "0603 (1608M)",
    GCM188R71H104KA57D: "0603 (1608M)",
    GCM21BR71E225KA73L: "0805 (2012M)",
    GCM32EC71A476KE02L: "1210 (3225M)",
    GCM32ER71E106KA57L: "1210 (3225M)",
    ISO7721FDR: "SOIC-8",
    ISO7762FDWR: "SOIC-16 wide",
    NXE1S0505MC:
      "Surface-mount 14-position package, 5 solder lands at positions 1, 3, 7, 8, 14; 4 functional connections, position 14 NA/no-connect",
    "RC0603FR-07100KL": "0603",
    "RC0603FR-0710KL": "0603",
    SN74LVC2G07DCKR: "SC70-6",
    TPS3431SDRBR: "VSON-8 (DRB), 3 mm × 3 mm",
    TPS389033DSER: "WSON-6 (DSE), 1.5 mm × 1.5 mm"
  }
  const value = packages[mpn]
  if (value === undefined) throw new RangeError(`BP-032 has no reviewed package identity for ${mpn}`)
  return value
}

/**
 * A product URL identifies the selected orderable but does not close source
 * evidence. Only the bounded retained-byte records below are verified.
 */
const manufacturerPrimarySourceByMpn = {
  BSS138AKA: { manufacturer: "Nexperia", url: "https://www.nexperia.com/product/BSS138AKA" },
  C0603C104K3RACTU: {
    manufacturer: "KEMET (Yageo Group)",
    url: "https://search.kemet.com/component-documentation/download/specsheet/C0603C104K3RACTU"
  },
  C1608X5R1A105K080AC: {
    manufacturer: "TDK",
    url: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/0000?part_no=C1608X5R1A105K080AC"
  },
  "ESP32-S3-WROOM-1U-N16R2": {
    manufacturer: "Espressif",
    url: "https://www.espressif.com/en/products/modules/esp32-s3/esp32-s3-wroom-1"
  },
  GCM188R71H104KA57D: {
    manufacturer: "Murata",
    url: "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H104KA57D"
  },
  GCM188R71H103KA37D: {
    manufacturer: "Murata",
    url: "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H103KA37D"
  },
  GCM21BR71E225KA73L: {
    manufacturer: "Murata",
    url: "https://www.murata.com/en-us/products/productdetail?partno=GCM21BR71E225KA73L"
  },
  GCM32EC71A476KE02L: {
    manufacturer: "Murata",
    url: "https://www.murata.com/en-us/products/productdetail?partno=GCM32EC71A476KE02L"
  },
  GCM32ER71E106KA57L: {
    manufacturer: "Murata",
    url: "https://www.murata.com/en-us/products/productdetail?partno=GCM32ER71E106KA57L"
  },
  ISO7721FDR: { manufacturer: "Texas Instruments", url: "https://www.ti.com/product/ISO7721" },
  ISO7762FDWR: { manufacturer: "Texas Instruments", url: "https://www.ti.com/product/ISO7762" },
  NXE1S0505MC: {
    manufacturer: "Murata",
    url: "https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf"
  },
  "RC0603FR-07100KL": {
    manufacturer: "Yageo",
    url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL"
  },
  "RC0603FR-0710KL": {
    manufacturer: "Yageo",
    url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL"
  },
  SN74LVC2G07DCKR: { manufacturer: "Texas Instruments", url: "https://www.ti.com/product/SN74LVC2G07" },
  STM32G474RET3TR: {
    manufacturer: "STMicroelectronics",
    url: "https://www.st.com/en/microcontrollers-microprocessors/stm32g474re.html"
  },
  TPS3431SDRBR: { manufacturer: "Texas Instruments", url: "https://www.ti.com/product/TPS3431" },
  TPS389033DSER: { manufacturer: "Texas Instruments", url: "https://www.ti.com/product/TPS3890" }
} as const

const retainedManufacturerPrimarySources = deepFreeze([
  {
    requestIdentity: "BP032-TI-TPS3431SDRBR-20260824",
    mpn: "TPS3431SDRBR",
    package: "VSON-8 (DRB), 3 mm × 3 mm",
    artifactPath: "docs/evidence/bp-032/ti-tps3431.pdf",
    sourceUrl: "https://www.ti.com/lit/ds/symlink/tps3431.pdf",
    sha256: "99BF5DBFFFE06E8F85D9A86CFB777A0151E85B4A103033BC025F4897A0BDC6F3"
  },
  {
    requestIdentity: "BP032-TI-TPS389033DSER-20260824",
    mpn: "TPS389033DSER",
    package: "WSON-6 (DSE), 1.5 mm × 1.5 mm",
    artifactPath: "docs/evidence/bp-032/ti-tps3890.pdf",
    sourceUrl: "https://www.ti.com/lit/ds/symlink/tps3890.pdf",
    sha256: "EE79599730E7606BA9718D9820B411020E3DCD9FF7D44572F8EE63FEAD15B9D0"
  },
  {
    requestIdentity: "BP032-TDK-C1608X5R1A105K080AC-20260825",
    mpn: "C1608X5R1A105K080AC",
    package: "0603",
    artifactPath: "docs/evidence/bp-032/tdk-c1608x5r1a105k080ac-characterization.pdf",
    sourceUrl:
      "https://product.tdk.cn/system/files/dam/doc/product/capacitor/ceramic/mlcc/charasheet/c1608x5r1a105k080ac.pdf",
    sha256: "180BECCB71F93CF9C4E7FDF810F9295BBE2009EF4595D733D32BE9DC4DEFC00D"
  },
  {
    requestIdentity: "BP032-BP125-Yageo-RC0603FR-0710KL-20260824",
    mpn: "RC0603FR-0710KL",
    package: "0603",
    artifactPath: "docs/evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf",
    sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
    sha256: "EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497"
  },
  {
    requestIdentity: "BP032-BP033-Yageo-RC0603FR-07100KL-20260825",
    mpn: "RC0603FR-07100KL",
    package: "0603",
    artifactPath: "docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf",
    sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL",
    sha256: "E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054"
  }
] as const)

export const benchPrototypeProcessorFootprintsRetainedManufacturerSources = retainedManufacturerPrimarySources

export function validateBenchPrototypeProcessorFootprintsRetainedManufacturerSources(value: unknown): true {
  if (!sameDataGraph(value, retainedManufacturerPrimarySources))
    throw new RangeError(
      "BP-032 retained manufacturer-source evidence must exactly match the canonical request records"
    )
  const sources = retainedManufacturerPrimarySources
  if (
    sources.length !== 5 ||
    new Set(sources.map((source) => source.mpn)).size !== sources.length ||
    new Set(sources.map((source) => source.requestIdentity)).size !== sources.length ||
    new Set(sources.map((source) => source.artifactPath)).size !== sources.length ||
    sources.some(
      (source) =>
        source.package !== packageFor(source.mpn) ||
        (source.mpn.startsWith("RC0603FR-07", 0)
          ? !source.sourceUrl.startsWith("https://www.yageogroup.com/") ||
            !/^docs\/evidence\/bp-(?:125|033)\/yageo-rc0603fr-07(?:10|100)kl-datasheet\.pdf$/u.test(source.artifactPath)
          : source.mpn === "C1608X5R1A105K080AC"
            ? !source.sourceUrl.startsWith("https://product.tdk.cn/") ||
              source.artifactPath !== "docs/evidence/bp-032/tdk-c1608x5r1a105k080ac-characterization.pdf"
            : !source.sourceUrl.startsWith("https://www.ti.com/") ||
              !/^docs\/evidence\/bp-032\/[^/]+\.pdf$/u.test(source.artifactPath)) ||
        !/^[0-9A-F]{64}$/u.test(source.sha256)
    )
  )
    throw new RangeError("BP-032 retained manufacturer-source evidence has identity, package, path, or hash drift")
  return true
}

function hasManufacturerPrimarySource(mpn: string): mpn is keyof typeof manufacturerPrimarySourceByMpn {
  return Object.hasOwn(manufacturerPrimarySourceByMpn, mpn)
}

function retainedManufacturerPrimarySourceFor(mpn: string) {
  const matches = retainedManufacturerPrimarySources.filter((source) => source.mpn === mpn)
  if (matches.length > 1) throw new RangeError(`BP-032 has duplicate retained manufacturer sources for ${mpn}`)
  return matches[0]
}

const evidence = (mpn: string | null, reference: string | null = null) => ({
  priorGateReferences: mpn === null ? [] : [...(findFootprintReleaseEvidence(mpn)?.gateReferences ?? [])],
  manufacturerPrimarySource:
    mpn === null || !hasManufacturerPrimarySource(mpn) ? null : structuredClone(manufacturerPrimarySourceByMpn[mpn]),
  manufacturerPrimarySourceMapping:
    mpn === null
      ? "not-applicable"
      : retainedManufacturerPrimarySourceFor(mpn) !== undefined
        ? "verified-by-retained-manufacturer-primary-bytes"
        : hasManufacturerPrimarySource(mpn)
          ? "source-unverified-primary-url-only"
          : "missing",
  retainedManufacturerPrimarySource:
    mpn === null ? null : structuredClone(retainedManufacturerPrimarySourceFor(mpn) ?? null),
  manufacturerDrawing: "required-not-acquired",
  manufacturerCad: "required-not-acquired",
  copper: "not-claimed",
  solderMask: "not-claimed",
  paste: "not-claimed",
  courtyard: "not-claimed",
  artwork: "not-generated",
  orientation: "unreviewed",
  footprintEvidence:
    mpn === null || reference === null
      ? null
      : mpn === "C0603C104K3RACTU"
        ? bp031032C0603C104K3RactuFootprintEvidenceFor(mpn, reference)
        : mpn === "SN74LVC2G07DCKR" || mpn === "BSS138AKA"
          ? resetSupportFootprintEvidenceFor(mpn, reference)
          : mpn === "FTSH-105-01-L-DV-007-K"
            ? ftshFootprintEvidenceFor(mpn, reference)
            : mpn === "C1608X5R1A105K080AC"
              ? bp032TdkC1608FootprintEvidenceFor(mpn, reference)
              : mpn.startsWith("GCM")
                ? murataProcessorSupportFootprintEvidenceFor(mpn, reference)
                : mpn === "ISO7762FDWR" || mpn === "ISO7721FDR"
                  ? tiIsolatorFootprintEvidenceFor(mpn, reference)
                  : mpn === "STM32G474RET3TR"
                    ? stm32FootprintEvidenceFor(mpn, reference)
                    : mpn === "TPS389033DSER" || mpn === "TPS3431SDRBR"
                      ? supervisorWatchdogFootprintEvidenceFor(mpn, reference)
                      : mpn === "TSW-106-07-G-S"
                        ? esp32ServiceHeaderFootprintEvidenceFor(mpn, reference)
                        : bp032YageoRc0603FootprintEvidenceFor(mpn, reference)
})

function esp32ServiceHeaderFootprintEvidenceFor(mpn: string, reference: string) {
  const candidate = bp032Esp32ServiceHeaderTsw10607gsFootprintEvidence
  if (candidate.boundary.exactMpn !== mpn || candidate.boundary.reference !== reference) return null
  return {
    artifactKind: candidate.artifactKind,
    exactMpn: mpn,
    reference,
    sourceId: "samtec-tsw-106-07-g-s-primary-set",
    sourceArtifactPaths: candidate.manufacturerSources.map((source) => source.artifactPath),
    sourceSha256s: candidate.manufacturerSources.map((source) => source.sha256),
    upstreamContract: "BP-124",
    projectFootprintId: "tsw-106-07-g-s-project-review",
    manufacturerCad: candidate.gates.cadRelease,
    manufacturerLandPattern: candidate.landPattern.holes.definition,
    artwork: candidate.gates.cadRelease,
    orientation: candidate.orientation.state,
    releaseState: candidate.gates.fabricationRelease,
    fabricationAuthority: candidate.gates.fabricationRelease,
    accepted: candidate.gates.accepted
  } as const
}

function stm32FootprintEvidenceFor(mpn: string, reference: string) {
  const candidate = bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence
  if (candidate.source.manufacturerPartNumber !== mpn || candidate.canonicalReference !== reference) return null
  return {
    artifactKind: candidate.artifactKind,
    exactMpn: mpn,
    reference,
    sourceId: "st-ds12288-rev6",
    sourceArtifactPath: candidate.source.artifactPath,
    sourceSha256: candidate.source.sha256,
    upstreamContract: "BP-120/BP-125",
    projectFootprintId: "stm32g474ret3tr-lqfp64-project-review",
    manufacturerCad: candidate.manufacturerCad.state,
    manufacturerLandPattern: candidate.manufacturerDrawing.state,
    artwork: candidate.projectFootprint.state,
    orientation: candidate.orientation.status,
    releaseState: candidate.releaseState,
    fabricationAuthority: candidate.fabricationAuthority,
    accepted: candidate.accepted
  } as const
}

function tiIsolatorFootprintEvidenceFor(mpn: string, reference: string) {
  const device = bp032TiIsolatorFootprintEvidence.devices.find(
    (item) => item.manufacturerPartNumber === mpn && item.canonicalReference === reference
  )
  if (device === undefined) return null
  return {
    artifactKind: bp032TiIsolatorFootprintEvidence.artifactKind,
    exactMpn: mpn,
    reference,
    sourceId: `ti-${mpn.toLowerCase()}-datasheet`,
    sourceArtifactPath: device.manufacturerSource.artifactPath,
    sourceSha256: device.manufacturerSource.sha256,
    upstreamContract: "BP-122",
    projectFootprintId: `ti-${mpn.toLowerCase()}-project-review`,
    manufacturerCad: device.manufacturerCad.state,
    manufacturerLandPattern: device.manufacturerFacts.landPatternStatus,
    artwork: device.projectGeometry.status,
    orientation: device.projectGeometry.orientation.status,
    releaseState: device.gates.release,
    fabricationAuthority: device.gates.fabrication,
    accepted: false
  } as const
}

function murataProcessorSupportFootprintEvidenceFor(mpn: string, reference: string) {
  const binding = benchPrototypeBp125MurataCapacitorReviewBindings.find(
    (item) => item.manufacturerPartNumber === mpn && item.reference === reference
  )
  if (binding === undefined) return null
  const geometry =
    benchPrototypeBp125MurataCapacitorFootprintGeometries[
      binding.candidateKey as keyof typeof benchPrototypeBp125MurataCapacitorFootprintGeometries
    ]
  if (geometry === undefined) return null
  const selection = geometry.appliesTo.find((item) => item.manufacturerPartNumber === mpn)
  const exactEvidence = geometry.exactMpnEvidence.find((item) => item.manufacturerPartNumber === mpn)
  if (selection === undefined || exactEvidence === undefined) return null
  const selectionReferences: readonly string[] = selection.references
  if (!selectionReferences.includes(reference)) return null
  return {
    artifactKind: geometry.artifactKind,
    exactMpn: mpn,
    reference,
    sourceId: `murata-${mpn.toLowerCase()}-retained-evidence`,
    sourceArtifactPath: exactEvidence.artifactPath,
    sourceSha256: exactEvidence.sha256,
    upstreamContract: "BP-125",
    projectFootprintId: `murata-${binding.candidateKey}-project-review`,
    manufacturerCad: geometry.manufacturerCad.state,
    manufacturerLandPattern: binding.landGuidanceScope,
    artwork: "project-review-only",
    orientation: geometry.orientation.state,
    releaseState: "deny",
    fabricationAuthority: geometry.fabricationAuthority,
    accepted: geometry.accepted
  } as const
}

function supervisorWatchdogFootprintEvidenceFor(mpn: string, reference: string) {
  const candidate = bp032SupervisorWatchdogFootprintEvidence
  const assignment = candidate.assignments.find(
    (item) => item.reference === reference && item.manufacturerPartNumber === mpn
  )
  if (assignment === undefined) return null
  const geometry =
    mpn === "TPS389033DSER"
      ? candidate.candidates.TPS389033DSER
      : mpn === "TPS3431SDRBR"
        ? candidate.candidates.TPS3431SDRBR
        : null
  if (geometry === null) return null
  const source = geometry.officialSources[0]
  if (source === undefined) return null
  return {
    artifactKind: candidate.artifactKind,
    exactMpn: mpn,
    reference,
    sourceId: assignment.sourceId,
    sourceArtifactPath: source.artifactPath,
    sourceSha256: source.sha256,
    upstreamContract: "BP-123",
    projectFootprintId: `${mpn.toLowerCase()}-project-review`,
    manufacturerCad: geometry.manufacturerCad.state,
    manufacturerLandPattern: source.packageGeometryEvidence.status,
    artwork: "project-review-only",
    orientation: geometry.orientation.state,
    releaseState: "deny",
    fabricationAuthority: geometry.fabricationAuthority,
    accepted: geometry.accepted
  } as const
}

function resetSupportFootprintEvidenceFor(mpn: string, reference: string) {
  const part = bp032ResetSupportFootprintEvidence.parts.find(
    (candidate) =>
      candidate.manufacturerPartNumber === mpn && candidate.affectedReferences.some((item) => item === reference)
  )
  if (part === undefined) return null
  return {
    artifactKind: bp032ResetSupportFootprintEvidence.artifactKind,
    exactMpn: mpn,
    reference,
    sourceId: mpn === "SN74LVC2G07DCKR" ? "ti-sn74lvc2g07-datasheet" : "nexperia-bss138aka-datasheet",
    sourceArtifactPath: part.source.artifactPath,
    sourceSha256: part.source.sha256,
    upstreamContract: "BP-123",
    projectFootprintId: `${mpn.toLowerCase()}-project-review`,
    manufacturerCad: part.manufacturerCad.state,
    manufacturerLandPattern: "retained-manufacturer-guidance",
    artwork: part.artwork.state,
    orientation: part.projectFootprint.orientation.state,
    releaseState: bp032ResetSupportFootprintEvidence.releaseState,
    fabricationAuthority: bp032ResetSupportFootprintEvidence.fabricationAuthority,
    accepted: bp032ResetSupportFootprintEvidence.accepted
  } as const
}

function ftshFootprintEvidenceFor(mpn: string, reference: string) {
  const candidate = bp032Ftsh10501LDv007KFootprintEvidence
  if (mpn !== candidate.connector.manufacturerPartNumber || reference !== candidate.reference) return null
  return {
    artifactKind: candidate.artifactKind,
    exactMpn: mpn,
    reference,
    sourceId: "samtec-ftsh-105-01-l-dv-007-k-primary-set",
    sourceArtifactPaths: candidate.manufacturerLandPattern.sourceDocuments.map((source) => source.artifactPath),
    sourceSha256s: candidate.manufacturerLandPattern.sourceDocuments.map((source) => source.sha256),
    upstreamContract: "BP-124",
    projectFootprintId: "ftsh-105-01-l-dv-007-k-project-review",
    manufacturerCad: candidate.manufacturerCad.state,
    manufacturerLandPattern: candidate.manufacturerLandPattern.authority,
    artwork: candidate.projectFootprint.artwork.state,
    orientation: candidate.projectFootprint.pinOne.orientationStatus,
    releaseState: candidate.releaseState,
    fabricationAuthority: candidate.fabricationAuthority,
    accepted: candidate.accepted
  } as const
}

const resetLedger = benchPrototypeResetWatchdog.parts.map((part) => ({
  reference: part.reference,
  mpn: part.mpn,
  package: packageFor(part.mpn),
  population: "selected-awaiting-footprint-evidence",
  source: "BP-123 reset/watchdog contract",
  evidence: evidence(part.mpn, part.reference)
}))

function processorSupportReferenceContract() {
  const support = benchPrototypeProcessorSupport
  const capacitorMpnFor = (references: readonly string[], index: number) => {
    const reference = references[index]
    if (reference === undefined) throw new RangeError("BP-125 capacitor reference index drifted")
    const selection = support.supportSelectionEvidence.capacitorSelections.find((candidate) =>
      candidate.references.some((candidateReference) => candidateReference === reference)
    )
    if (selection === undefined) throw new RangeError(`BP-125 has no exact capacitor selection for ${reference}`)
    return selection.mpn
  }
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
      mpn: capacitorMpnFor(support.bypassAndBulk.stm32Analog.vdDa.references, index),
      value: support.bypassAndBulk.stm32Analog.vdDa.values[index],
      population: support.bypassAndBulk.stm32Analog.population,
      section: "stm32-vdda"
    })),
    ...support.bypassAndBulk.stm32Analog.vref.references.map((reference, index) => ({
      reference,
      mpn: capacitorMpnFor(support.bypassAndBulk.stm32Analog.vref.references, index),
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
      mpn: capacitorMpnFor(support.bypassAndBulk.esp32.references, index),
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
      evidence: evidence(support.mpn, support.reference)
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
        evidence: evidence(selected.mpn, selected.reference)
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
      evidence: evidence("STM32G474RET3TR", "U_SCORING")
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
      evidence: evidence("ISO7762FDWR", "U_ISO_MAIN")
    },
    {
      reference: "U_ISO_AUX",
      boardReference: "U_ISO_AUX",
      mpn: "ISO7721FDR",
      package: "SOIC-8",
      population: "selected-awaiting-footprint-evidence",
      source: "BP-122 auxiliary isolation channel",
      evidence: evidence("ISO7721FDR", "U_ISO_AUX")
    },
    {
      reference: "U_ISO_POWER",
      boardReference: "U_ISOLATED_POWER",
      mpn: "NXE1S0505MC",
      package:
        "Surface-mount 14-position package, 5 solder lands at positions 1, 3, 7, 8, 14; 4 functional connections, position 14 NA/no-connect",
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
      evidence: evidence("FTSH-105-01-L-DV-007-K", "J_STM_SWD")
    },
    {
      reference: "J_ESP_SERVICE",
      mpn: "TSW-106-07-G-S",
      package: "1x6 2.54 mm through-hole header",
      population: "DNP-until-footprint-and-mating-evidence",
      source: "BP-124 ESP32 service header",
      evidence: evidence("TSW-106-07-G-S", "J_ESP_SERVICE")
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
  if (validateBp031032C0603C104K3RactuFootprintEvidence().length !== 0) {
    throw new RangeError("BP-032 C0603C104K3RACTU project-review candidate drifted")
  }
  if (validateBp032ResetSupportFootprintEvidence().length !== 0) {
    throw new RangeError("BP-032 reset-support project-review candidates drifted")
  }
  if (validateBp032Ftsh10501LDv007KFootprintEvidence().length !== 0) {
    throw new RangeError("BP-032 FTSH service-header project-review candidate drifted")
  }
  validateBp032Esp32ServiceHeaderTsw10607gsFootprintEvidence(bp032Esp32ServiceHeaderTsw10607gsFootprintEvidence)
  validateBp032SupervisorWatchdogFootprintEvidence(bp032SupervisorWatchdogFootprintEvidence)
  if (bp125MurataCapacitorFootprintIntegrityErrors().length !== 0) {
    throw new RangeError("BP-032 Murata processor-support footprint candidate drifted")
  }
  if (validateBp032TiIsolatorFootprintEvidence(bp032TiIsolatorFootprintEvidence).length !== 0) {
    throw new RangeError("BP-032 TI isolator footprint candidate drifted")
  }
  if (
    validateBp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence(bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence)
      .length !== 0
  ) {
    throw new RangeError("BP-032 STM32 footprint candidate drifted")
  }
  validateBenchPrototypeProcessorFootprintsRetainedManufacturerSources(retainedManufacturerPrimarySources)
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
  const yageoReferenceBindings = bp032YageoRc0603ResistorFootprintEvidence.referenceBindings
  const tdkReferenceBindings = bp032TdkC1608CapacitorFootprintEvidence.affectedReferences.map((reference) => ({
    reference,
    manufacturerPartNumber: "C1608X5R1A105K080AC",
    sourceId: bp032TdkC1608CapacitorFootprintEvidence.sources[0].id,
    upstreamContract: "BP-123"
  }))
  const kemetReferenceBindings = bp031032C0603C104K3RactuFootprintEvidence.referenceSets.bp032.references.map(
    (reference) => ({
      reference,
      manufacturerPartNumber: bp031032C0603C104K3RactuFootprintEvidence.manufacturerPartNumber,
      sourceId: bp031032C0603C104K3RactuFootprintEvidence.sources[0].id,
      upstreamContract: "BP-123"
    })
  )
  const yageoLedgerRows = references.filter(
    (entry) => entry.mpn === "RC0603FR-0710KL" || entry.mpn === "RC0603FR-07100KL"
  )
  const tdkSupportRows = ledger.processorSupportReferences.filter(
    (entry) => entry.reference === "C_ESP_EN_DELAY" && entry.selectedMpn === "C1608X5R1A105K080AC"
  )
  const kemetResetRows = ledger.populatedReferences.filter((entry) => entry.mpn === "C0603C104K3RACTU")
  const resetSupportRows = ledger.populatedReferences.filter((entry) =>
    ["SN74LVC2G07DCKR", "BSS138AKA"].includes(entry.mpn)
  )
  const supervisorWatchdogRows = ledger.populatedReferences.filter((entry) =>
    ["TPS389033DSER", "TPS3431SDRBR"].includes(entry.mpn)
  )
  const murataProcessorSupportRows = ledger.processorSupportReferences.filter((entry) => entry.mpn.startsWith("GCM"))
  const isolatorRows = ledger.populatedReferences.filter((entry) => ["ISO7762FDWR", "ISO7721FDR"].includes(entry.mpn))
  const stm32Rows = ledger.populatedReferences.filter((entry) => entry.mpn === "STM32G474RET3TR")
  const ftshRows = ledger.debugReferences.filter((entry) => entry.mpn === "FTSH-105-01-L-DV-007-K")
  const esp32ServiceHeaderRows = ledger.debugReferences.filter((entry) => entry.mpn === "TSW-106-07-G-S")
  if (
    new Set(references.map((entry) => entry.reference)).size !== references.length ||
    ledger.populatedReferences.some(
      (entry) =>
        entry.mpn === null ||
        entry.population !== "selected-awaiting-footprint-evidence" ||
        entry.evidence.copper !== "not-claimed" ||
        entry.evidence.manufacturerPrimarySourceMapping === "missing" ||
        entry.evidence.manufacturerPrimarySource === null
    ) ||
    ledger.debugReferences.some((entry) => entry.population !== "DNP-until-footprint-and-mating-evidence") ||
    ledger.clockReferences[0].population !== "DNP" ||
    ledger.clockReferences[1].population !== "DNP" ||
    ledger.clockReferences[2].population !== "module-integrated" ||
    ledger.processorSupportReferences.length !== processorSupportSnapshot.length ||
    unresolvedProcessorSupport.some((entry) => entry.selectedMpn !== null || entry.mpn !== "TBD") ||
    bp125SelectedSupport.some(
      (entry) =>
        entry.mpn === "TBD" ||
        entry.selectedMpn !== entry.mpn ||
        entry.package === null ||
        entry.evidence.manufacturerPrimarySourceMapping === "missing" ||
        entry.evidence.manufacturerPrimarySource === null
    ) ||
    yageoLedgerRows.length !== yageoReferenceBindings.length ||
    yageoReferenceBindings.some((expected) => {
      const row = yageoLedgerRows.find((candidate) => candidate.reference === expected.reference)
      return (
        row === undefined ||
        row.mpn !== expected.manufacturerPartNumber ||
        !("evidence" in row) ||
        row.evidence.footprintEvidence === null ||
        row.evidence.footprintEvidence?.exactMpn !== expected.manufacturerPartNumber ||
        row.evidence.footprintEvidence?.reference !== expected.reference ||
        row.evidence.footprintEvidence?.sourceId !== expected.sourceId ||
        row.evidence.footprintEvidence?.upstreamContract !== expected.upstreamContract ||
        row.evidence.footprintEvidence?.projectFootprintId !== "yageo-rc0603-project-review" ||
        row.evidence.footprintEvidence?.releaseState !== "deny" ||
        row.evidence.footprintEvidence?.fabricationAuthority !== "deny" ||
        row.evidence.footprintEvidence?.accepted
      )
    }) ||
    tdkSupportRows.length !== tdkReferenceBindings.length ||
    tdkReferenceBindings.some((expected) => {
      const row = tdkSupportRows.find((candidate) => candidate.reference === expected.reference)
      return (
        row === undefined ||
        row.mpn !== "TBD" ||
        row.selectedMpn !== expected.manufacturerPartNumber ||
        row.package !== "0603" ||
        row.reconciliation !== "selected-by-BP-123" ||
        row.evidence.footprintEvidence === null ||
        row.evidence.footprintEvidence?.exactMpn !== expected.manufacturerPartNumber ||
        row.evidence.footprintEvidence?.reference !== expected.reference ||
        row.evidence.footprintEvidence?.sourceId !== expected.sourceId ||
        row.evidence.footprintEvidence?.upstreamContract !== expected.upstreamContract ||
        row.evidence.footprintEvidence?.projectFootprintId !== "tdk-c1608-c1608x5r1a105k080ac-project-review" ||
        row.evidence.footprintEvidence?.releaseState !== "deny" ||
        row.evidence.footprintEvidence?.fabricationAuthority !== "deny" ||
        row.evidence.footprintEvidence?.accepted
      )
    }) ||
    kemetResetRows.length !== kemetReferenceBindings.length ||
    kemetReferenceBindings.some((expected) => {
      const row = kemetResetRows.find((candidate) => candidate.reference === expected.reference)
      return (
        row === undefined ||
        row.mpn !== expected.manufacturerPartNumber ||
        row.evidence.footprintEvidence === null ||
        row.evidence.footprintEvidence?.exactMpn !== expected.manufacturerPartNumber ||
        row.evidence.footprintEvidence?.reference !== expected.reference ||
        row.evidence.footprintEvidence?.sourceId !== expected.sourceId ||
        row.evidence.footprintEvidence?.upstreamContract !== expected.upstreamContract ||
        row.evidence.footprintEvidence?.projectFootprintId !== "c0603c104k3ractu-project-review" ||
        row.evidence.footprintEvidence?.manufacturerCad !== "not-acquired" ||
        row.evidence.footprintEvidence?.manufacturerLandPattern !== "not-published" ||
        row.evidence.footprintEvidence?.releaseState !== "deny" ||
        row.evidence.footprintEvidence?.fabricationAuthority !== "deny" ||
        row.evidence.footprintEvidence?.accepted
      )
    }) ||
    resetSupportRows.length !== 3 ||
    resetSupportRows.some(
      (row) =>
        row.evidence.footprintEvidence === null ||
        row.evidence.footprintEvidence.exactMpn !== row.mpn ||
        row.evidence.footprintEvidence.reference !== row.reference ||
        row.evidence.footprintEvidence.upstreamContract !== "BP-123" ||
        row.evidence.footprintEvidence.releaseState !== "deny" ||
        row.evidence.footprintEvidence.fabricationAuthority !== "deny" ||
        row.evidence.footprintEvidence.accepted
    ) ||
    supervisorWatchdogRows.length !== 4 ||
    supervisorWatchdogRows.some(
      (row) =>
        row.evidence.footprintEvidence === null ||
        row.evidence.footprintEvidence.exactMpn !== row.mpn ||
        row.evidence.footprintEvidence.reference !== row.reference ||
        row.evidence.footprintEvidence.upstreamContract !== "BP-123" ||
        row.evidence.footprintEvidence.releaseState !== "deny" ||
        row.evidence.footprintEvidence.fabricationAuthority !== "deny" ||
        row.evidence.footprintEvidence.accepted
    ) ||
    murataProcessorSupportRows.length !== 12 ||
    murataProcessorSupportRows.some(
      (row) =>
        row.evidence.footprintEvidence === null ||
        row.evidence.footprintEvidence.exactMpn !== row.mpn ||
        row.evidence.footprintEvidence.reference !== row.reference ||
        row.evidence.footprintEvidence.upstreamContract !== "BP-125" ||
        row.evidence.footprintEvidence.releaseState !== "deny" ||
        row.evidence.footprintEvidence.fabricationAuthority !== "deny" ||
        row.evidence.footprintEvidence.accepted
    ) ||
    isolatorRows.length !== 2 ||
    isolatorRows.some(
      (row) =>
        row.evidence.footprintEvidence === null ||
        row.evidence.footprintEvidence.exactMpn !== row.mpn ||
        row.evidence.footprintEvidence.reference !== row.reference ||
        row.evidence.footprintEvidence.upstreamContract !== "BP-122" ||
        row.evidence.footprintEvidence.releaseState !== "deny" ||
        row.evidence.footprintEvidence.fabricationAuthority !== "deny" ||
        row.evidence.footprintEvidence.accepted
    ) ||
    stm32Rows.length !== 1 ||
    stm32Rows.some(
      (row) =>
        row.evidence.footprintEvidence === null ||
        row.evidence.footprintEvidence.exactMpn !== row.mpn ||
        row.evidence.footprintEvidence.reference !== row.reference ||
        row.evidence.footprintEvidence.upstreamContract !== "BP-120/BP-125" ||
        row.evidence.footprintEvidence.releaseState !== "deny" ||
        row.evidence.footprintEvidence.fabricationAuthority !== "deny" ||
        row.evidence.footprintEvidence.accepted
    ) ||
    ftshRows.length !== 1 ||
    ftshRows.some(
      (row) =>
        row.evidence.footprintEvidence === null ||
        row.evidence.footprintEvidence.exactMpn !== row.mpn ||
        row.evidence.footprintEvidence.reference !== row.reference ||
        row.evidence.footprintEvidence.upstreamContract !== "BP-124" ||
        row.evidence.footprintEvidence.releaseState !== "deny" ||
        row.evidence.footprintEvidence.fabricationAuthority !== "deny" ||
        row.evidence.footprintEvidence.accepted
    ) ||
    esp32ServiceHeaderRows.length !== 1 ||
    esp32ServiceHeaderRows.some(
      (row) =>
        row.evidence.footprintEvidence === null ||
        row.evidence.footprintEvidence.exactMpn !== row.mpn ||
        row.evidence.footprintEvidence.reference !== row.reference ||
        row.evidence.footprintEvidence.upstreamContract !== "BP-124" ||
        row.evidence.footprintEvidence.releaseState !== "deny" ||
        row.evidence.footprintEvidence.fabricationAuthority !== "deny" ||
        row.evidence.footprintEvidence.accepted
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
