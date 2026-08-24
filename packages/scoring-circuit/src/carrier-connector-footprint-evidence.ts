/**
 * Source-backed review models for the selected carrier interconnect.
 *
 * These records are intentionally isolated from the circuit and readiness
 * manifests. They describe what the current manufacturer drawings support;
 * they do not clear a DNP gate or emit PCB artwork.
 */

export type CarrierConnectorMpn =
  | "43045-0400"
  | "43025-0400"
  | "43030-0007"
  | "HSEC8-113-01-L-DV-A-L2"
  | "ECDP-08-07.87-L1-L2-1-3"

export type CarrierEvidenceStatus =
  | "manufacturer-recommended"
  | "manufacturer-specified"
  | "series-print-controlled"
  | "not-published"
  | "not-imported"
  | "not-independently-tested"

export type CarrierAcquiredSourceArtifact = {
  readonly acquiredDate: "2026-08-24"
  readonly evidenceFile: `apps/scoring/docs/evidence/m4-11/${string}`
  readonly sha256: string
}

export type CarrierPrimarySource = {
  readonly access: "manufacturer-acquired-hash-bound" | "manufacturer-listed"
  /** Present only when the manufacturer download is vendored and SHA-256 bound. */
  readonly acquiredArtifact?: CarrierAcquiredSourceArtifact
  readonly kind:
    | "product-page"
    | "product-drawing"
    | "product-specification"
    | "test-summary"
    | "mechanical-series-print"
    | "footprint-series-print"
  readonly revision: string
  readonly url: string
}

export type CarrierHole = {
  readonly diameterMm: number
  readonly id: string
  readonly kind: "plated-hole" | "non-plated-hole"
  readonly role: "contact" | "alignment" | "latch"
  readonly xMm?: number
  readonly yMm?: number
}

export type CarrierFootprintModel = {
  readonly boardEdgePlacementMaxMm?: number
  readonly boardThicknessMm?: number
  readonly boardThicknessToleranceMm?: number
  readonly body: {
    readonly heightMm?: number
    readonly lengthMm?: number
    readonly widthMm?: number
    readonly sourceStatus: CarrierEvidenceStatus
  }
  readonly copper: {
    readonly contactCount?: number
    readonly contactLandMm?: { readonly heightMm: number; readonly widthMm: number }
    readonly pitchMm?: number
    readonly rowCount?: number
    readonly sourceStatus: CarrierEvidenceStatus
  }
  readonly courtyard: {
    readonly sourceStatus: CarrierEvidenceStatus
  }
  readonly holes: readonly CarrierHole[]
  readonly orientation: {
    readonly pinOne: string
    readonly sourceStatus: CarrierEvidenceStatus
  }
  readonly paste: {
    readonly process: string
    readonly stencilThicknessMm?: number
    readonly sourceStatus: CarrierEvidenceStatus
  }
  readonly solderMask: {
    readonly sourceStatus: CarrierEvidenceStatus
  }
}

export type CarrierIndependentVerification = {
  readonly assemblyProcessQualified: boolean
  readonly cadOverlayComplete: boolean
  readonly contactAssignmentVerified: boolean
  readonly enclosureKeepoutVerified: boolean
  readonly fabricationPreviewChecked: boolean
  readonly physicalMateTested: boolean
}

export type CarrierConnectorEvidence = {
  readonly exactMates: readonly CarrierConnectorMpn[]
  readonly footprint?: CarrierFootprintModel
  readonly harness?: {
    readonly cableLengthIn: number
    readonly cableLengthMm: number
    readonly cableOption: "100-ohm-eyespeed"
    readonly firstEnd: "L1"
    readonly overallLengthReferenceMm: number
    readonly pairCount: number
    readonly secondEnd: "L2"
    readonly wiringOption: "pin-1-to-pin-1"
  }
  readonly independentVerification: CarrierIndependentVerification
  readonly manufacturer: "Molex" | "Samtec"
  readonly missingReleaseEvidence: readonly string[]
  readonly mpn: CarrierConnectorMpn
  readonly package: string
  readonly primarySources: readonly CarrierPrimarySource[]
  readonly releaseState: "deny"
  readonly role: "carrier-pcb-header" | "carrier-harness-mate" | "carrier-harness-terminal" | "carrier-usb2-cable"
}

const molexHeaderHoles: readonly CarrierHole[] = [
  { diameterMm: 1.02, id: "1", kind: "plated-hole", role: "contact", xMm: 0, yMm: 0 },
  { diameterMm: 1.02, id: "2", kind: "plated-hole", role: "contact", xMm: 0, yMm: 3 },
  { diameterMm: 1.02, id: "3", kind: "plated-hole", role: "contact", xMm: 3, yMm: 0 },
  { diameterMm: 1.02, id: "4", kind: "plated-hole", role: "contact", xMm: 3, yMm: 3 }
] as const

const molexDrawingSources: readonly CarrierPrimarySource[] = [
  {
    access: "manufacturer-listed",
    kind: "product-drawing",
    revision: "Molex SD-43045-001 H1, released 2024-09-27",
    url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43045/430451400_sd.pdf"
  },
  {
    access: "manufacturer-listed",
    kind: "product-specification",
    revision: "Molex PS-43045 P5, revised 2025-07-16",
    url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/productspecificationpdf/430/43045/PS-43045-001.pdf"
  },
  {
    access: "manufacturer-listed",
    kind: "test-summary",
    revision: "Molex 430450005-TS-000, released 2018-06-01",
    url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/testsummarypdf/430/43045/430450005-TS-000.pdf"
  }
] as const

const hsec8Holes: readonly CarrierHole[] = [
  { diameterMm: 1.27, id: "ALIGN_L", kind: "non-plated-hole", role: "alignment" },
  { diameterMm: 1.27, id: "ALIGN_R", kind: "non-plated-hole", role: "alignment" },
  { diameterMm: 0.84, id: "LATCH_L", kind: "plated-hole", role: "latch" },
  { diameterMm: 0.84, id: "LATCH_R", kind: "plated-hole", role: "latch" }
] as const

const samtecHsec8Sources: readonly CarrierPrimarySource[] = [
  {
    access: "manufacturer-listed",
    kind: "product-page",
    revision: "HSEC8-113-01-L-DV-A-L2 product page checked 2026-08-23",
    url: "https://www.samtec.com/products/hsec8-113-01-l-dv-a-l2"
  },
  {
    access: "manufacturer-acquired-hash-bound",
    acquiredArtifact: {
      acquiredDate: "2026-08-24",
      evidenceFile: "apps/scoring/docs/evidence/m4-11/samtec-hsec8-mkt-rev-bz.pdf",
      sha256: "7C94D52B1F5F1687411125862913A902620A3FF5D12B0992F1C657C664E08896"
    },
    kind: "mechanical-series-print",
    revision: "HSEC8-1XXX-XX-XX-DV-X-XX-X-XX MKT revision BZ",
    url: "https://suddendocs.samtec.com/prints/hsec8-1xxx-xx-xx-dv-x-xx-x-xx-mkt.pdf"
  },
  {
    access: "manufacturer-acquired-hash-bound",
    acquiredArtifact: {
      acquiredDate: "2026-08-24",
      evidenceFile: "apps/scoring/docs/evidence/m4-11/samtec-hsec8-footprint-rev-ah.pdf",
      sha256: "444530543B34CF92F87AE037FB52C55F0583EB257ACB0BC0B7558853190DB383"
    },
    kind: "footprint-series-print",
    revision: "HSEC8-1XXX-XX-XX-DV-X-XX-FOOTPRINT revision AH",
    url: "https://suddendocs.samtec.com/prints/hsec8-1xxx-xx-xx-dv-x-xx-footprint.pdf"
  },
  {
    access: "manufacturer-listed",
    kind: "test-summary",
    revision: "ECDP/HSEC8 design qualification report 217284 revision 1",
    url: "https://suddendocs.samtec.com/testreports/217284_report_rev_1_qua.pdf"
  }
] as const

const ecdpSources: readonly CarrierPrimarySource[] = [
  {
    access: "manufacturer-listed",
    kind: "product-page",
    revision: "ECDP product page checked 2026-08-23",
    url: "https://www.samtec.com/products/ecdp"
  },
  {
    access: "manufacturer-acquired-hash-bound",
    acquiredArtifact: {
      acquiredDate: "2026-08-24",
      evidenceFile: "apps/scoring/docs/evidence/m4-11/samtec-ecdp-mkt-rev-x.pdf",
      sha256: "7808FF959CF6C2AE84B252620FE8D1B69808FE8766A232B4AFA78EE7B361B1C4"
    },
    kind: "mechanical-series-print",
    revision: "ECDP-XX-XX.XX-XX-XX-X-X MKT revision X",
    url: "https://suddendocs.samtec.com/prints/ecdp-xx-xx.xx-xx-xx-x-x-mkt.pdf"
  },
  {
    access: "manufacturer-listed",
    kind: "test-summary",
    revision: "ECDP/HSEC8 100 ohm characterization report",
    url: "https://suddendocs.samtec.com/testreports/20161207_web_hsc-report-sma_ecdp-08-xxxx-l1-l1-3-3_eyespeed100.pdf"
  }
] as const

const notVerified: CarrierIndependentVerification = {
  assemblyProcessQualified: false,
  cadOverlayComplete: false,
  contactAssignmentVerified: false,
  enclosureKeepoutVerified: false,
  fabricationPreviewChecked: false,
  physicalMateTested: false
}

export const carrierConnectorFootprintEvidence: readonly CarrierConnectorEvidence[] = [
  {
    exactMates: ["43025-0400"],
    footprint: {
      boardEdgePlacementMaxMm: 10.16,
      boardThicknessMm: 1.57,
      body: {
        heightMm: 10.29,
        lengthMm: 9.65,
        sourceStatus: "manufacturer-specified",
        widthMm: 7.37
      },
      copper: {
        contactCount: 4,
        pitchMm: 3,
        rowCount: 2,
        sourceStatus: "manufacturer-recommended"
      },
      courtyard: { sourceStatus: "not-published" },
      holes: molexHeaderHoles,
      orientation: {
        pinOne: "Circuit 1 identifier is on the connector surface; use the component-side PCB layout in SD-43045-001.",
        sourceStatus: "manufacturer-specified"
      },
      paste: {
        process: "Through-hole soldering; no SMT paste aperture is applicable to the four contacts.",
        sourceStatus: "not-published"
      },
      solderMask: { sourceStatus: "not-published" }
    },
    independentVerification: notVerified,
    manufacturer: "Molex",
    missingReleaseEvidence: [
      "Import the exact SD-43045-001 four-circuit land pattern into release CAD and independently verify annular ring, copper pad dimensions, solder-mask expansion, and finished-hole tolerance.",
      "Overlay the connector body, snap-in PCB retention pegs, board-edge 10.16 mm placement limit, mating housing, and enclosure/service keepout against the released mechanical assembly.",
      "Verify circuit 1 through circuit 4 contact assignment against the 43025-0400 housing and 43030-0007 loose 20-24 AWG terminals using a keyed harness sample.",
      "Qualify the selected through-hole solder process, connector insertion/removal load path, 30-cycle durability requirement, and 1.5 A per-contact project derating at 50 C blocked-vent ambient."
    ],
    mpn: "43045-0400",
    package:
      "Micro-Fit 3.0 dual-row, four-circuit, right-angle through-hole header with snap-in plastic PCB retention pegs",
    primarySources: molexDrawingSources,
    releaseState: "deny",
    role: "carrier-pcb-header"
  },
  {
    exactMates: ["43045-0400", "43030-0007"],
    independentVerification: notVerified,
    manufacturer: "Molex",
    missingReleaseEvidence: [
      "Confirm the exact 43025-0400 resin revision and circuit-1 identifier in the production harness BOM.",
      "Verify terminal insertion depth, locking-tab seating, wire gauge, crimp height, pull force, and keying with 43030-0007 before harness acceptance.",
      "Run the Molex-recommended continuity fixture and do not use a standard mating component to make or break under load."
    ],
    mpn: "43025-0400",
    package: "Micro-Fit 3.0 dual-row, four-circuit receptacle housing for 43030 female terminals",
    primarySources: [
      {
        access: "manufacturer-listed",
        kind: "product-drawing",
        revision: "Molex 430250000-SD, revision D, released 2018-06-01; 43025-0400 table row",
        url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43025/430250400_sd.pdf"
      },
      ...molexDrawingSources.slice(1)
    ],
    releaseState: "deny",
    role: "carrier-harness-mate"
  },
  {
    exactMates: ["43025-0400"],
    independentVerification: notVerified,
    manufacturer: "Molex",
    missingReleaseEvidence: [
      "Confirm 43030-0007 is the selected loose-form A terminal for 20-24 AWG wire and that the harness wire insulation diameter remains within the drawing limits.",
      "Lock the approved crimp applicator, strip length, crimp height, pull-force sampling, terminal retention, and plating/lot traceability in the assembly traveler."
    ],
    mpn: "43030-0007",
    package: "Micro-Fit 3.0 female crimp terminal, loose form A, 20-24 AWG",
    primarySources: [
      {
        access: "manufacturer-listed",
        kind: "product-drawing",
        revision: "Molex SD-43030-XXXX, revision N10, released 2026-04-24; 43030-0007 table row",
        url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43030/430300003_sd.pdf"
      },
      {
        access: "manufacturer-listed",
        kind: "product-specification",
        revision: "Molex PS-43045 P5, revised 2025-07-16",
        url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/productspecificationpdf/430/43045/PS-43045-001.pdf"
      }
    ],
    releaseState: "deny",
    role: "carrier-harness-terminal"
  },
  {
    exactMates: ["ECDP-08-07.87-L1-L2-1-3"],
    footprint: {
      boardThicknessMm: 1.57,
      boardThicknessToleranceMm: 0.15,
      body: {
        sourceStatus: "manufacturer-specified"
      },
      copper: {
        contactCount: 26,
        contactLandMm: { heightMm: 1.2, widthMm: 0.8 },
        pitchMm: 0.8,
        rowCount: 2,
        sourceStatus: "manufacturer-recommended"
      },
      courtyard: { sourceStatus: "not-published" },
      holes: hsec8Holes,
      orientation: {
        pinOne:
          "Use the Samtec position-1 indicator and A-option alignment features; do not mirror the two-row pattern.",
        sourceStatus: "series-print-controlled"
      },
      paste: {
        process:
          "0.15 mm stencil is specified by the Samtec recommended footprint; L2 latch PTHs are specified for paste-in-hole soldering.",
        stencilThicknessMm: 0.15,
        sourceStatus: "manufacturer-specified"
      },
      solderMask: { sourceStatus: "not-published" }
    },
    independentVerification: notVerified,
    manufacturer: "Samtec",
    missingReleaseEvidence: [
      "Import the exact HSEC8-113-01-L-DV-A-L2 footprint and 3D model under the controlled Series Print, then overlay all 26 SMT lands, two A-option alignment NPTHs, two L2 latch PTHs, pin-one marker, body outline, and rework keepout.",
      "Verify solder-mask openings, paste apertures, paste-in-hole latch process, courtyard, the exact 1.57 mm plus or minus 0.15 mm card requirement, card lead-in, and component-side orientation against the carrier's rounded 1.60 mm planning stackup.",
      "Obtain and lock the configured ECDP Series Print mapping for the 08-pair, 07.87 inch, L1-to-L2, pin-1-to-pin-1, 100 ohm EyeSpeed cable; no USB_DN, USB_DP, or CHASSIS contact assignment may be inferred from a generic edge-card pinout.",
      "Run physical mating/latching, cable strain, 100 ohm channel, USB eye, shield-current, and rework/assembly trials on production-representative boards before release."
    ],
    mpn: "HSEC8-113-01-L-DV-A-L2",
    package:
      "Samtec HSEC8-DV vertical 0.80 mm high-speed edge-card socket, 13 positions per row, A alignment option, ECDP L2 latch",
    primarySources: samtecHsec8Sources,
    releaseState: "deny",
    role: "carrier-pcb-header"
  },
  {
    exactMates: ["HSEC8-113-01-L-DV-A-L2"],
    harness: {
      cableLengthIn: 7.87,
      cableLengthMm: 199.898,
      cableOption: "100-ohm-eyespeed",
      firstEnd: "L1",
      overallLengthReferenceMm: 217.428,
      pairCount: 8,
      secondEnd: "L2",
      wiringOption: "pin-1-to-pin-1"
    },
    independentVerification: notVerified,
    manufacturer: "Samtec",
    missingReleaseEvidence: [
      "Confirm the ordered cable is exactly ECDP-08-07.87-L1-L2-1-3: eight pairs, 7.87 inch cable length, double-vertical L1/L2 latches, pin 1 to pin 1 wiring, and 100 ohm EyeSpeed cable.",
      "Record the cable length tolerance, keyed housing orientation, 100% shorts/opens test, 300 V hi-pot test, shield termination, and supplier lot traceability in the harness traveler.",
      "Verify both HSEC8 sockets are the A/L2 configured mating parts and that latch engagement is independent of SMT solder-joint service loading."
    ],
    mpn: "ECDP-08-07.87-L1-L2-1-3",
    package: "Samtec ECDP 0.80 mm edge-card twinax cable assembly, 8 pairs, 7.87 inch cable, L1/L2 latches",
    primarySources: ecdpSources,
    releaseState: "deny",
    role: "carrier-usb2-cable"
  }
] as const satisfies readonly CarrierConnectorEvidence[]

function isFinitePositive(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value > 0)
}

function isRequiredFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function sourceErrors(record: CarrierConnectorEvidence): string[] {
  const errors: string[] = []
  if (record.primarySources.length === 0) errors.push(`${record.mpn}: primary manufacturer sources are required`)
  const sourceKinds = new Set<string>()
  for (const source of record.primarySources) {
    if (sourceKinds.has(source.kind)) errors.push(`${record.mpn}: duplicate source kind ${source.kind}`)
    sourceKinds.add(source.kind)
    if (!source.url.startsWith("https://")) errors.push(`${record.mpn}: source URL must use HTTPS`)
    if (source.revision.trim().length === 0) errors.push(`${record.mpn}: source revision is required`)
    if (source.access === "manufacturer-acquired-hash-bound") {
      const artifact = source.acquiredArtifact
      if (
        artifact === undefined ||
        artifact.acquiredDate !== "2026-08-24" ||
        !artifact.evidenceFile.startsWith("apps/scoring/docs/evidence/m4-11/") ||
        !/^[0-9A-F]{64}$/u.test(artifact.sha256)
      ) {
        errors.push(`${record.mpn}: hash-bound manufacturer source requires the M4-11 artifact path and SHA-256`)
      }
    } else if (source.acquiredArtifact !== undefined) {
      errors.push(`${record.mpn}: manufacturer-listed source must not claim an acquired artifact`)
    }
  }
  return errors
}

function footprintErrors(record: CarrierConnectorEvidence): string[] {
  if (record.footprint === undefined) return []
  if (record.footprint === null || typeof record.footprint !== "object") {
    return [`${record.mpn}: footprint must be an object when provided`]
  }
  const errors: string[] = []
  const { copper } = record.footprint
  if (!Array.isArray(record.footprint.holes)) return [`${record.mpn}: footprint holes must be an array`]
  const holes = record.footprint.holes
  if (!isFinitePositive(record.footprint.boardEdgePlacementMaxMm))
    errors.push(`${record.mpn}: board-edge placement limit must be positive`)
  if (!isFinitePositive(record.footprint.boardThicknessMm))
    errors.push(`${record.mpn}: board thickness must be positive`)
  if (!isFinitePositive(record.footprint.boardThicknessToleranceMm))
    errors.push(`${record.mpn}: board thickness tolerance must be positive`)
  for (const [dimension, value] of [
    ["body height", record.footprint.body.heightMm],
    ["body length", record.footprint.body.lengthMm],
    ["body width", record.footprint.body.widthMm]
  ] as const) {
    if (!isFinitePositive(value)) errors.push(`${record.mpn}: ${dimension} must be positive`)
  }
  if (!isFinitePositive(copper.pitchMm)) errors.push(`${record.mpn}: contact pitch must be positive`)
  if (copper.contactCount !== undefined && (!Number.isInteger(copper.contactCount) || copper.contactCount <= 0)) {
    errors.push(`${record.mpn}: contact count must be a positive integer`)
  }
  if (copper.rowCount !== undefined && (!Number.isInteger(copper.rowCount) || copper.rowCount <= 0)) {
    errors.push(`${record.mpn}: row count must be a positive integer`)
  }
  if (copper.contactLandMm !== undefined) {
    if (!isFinitePositive(copper.contactLandMm.widthMm) || !isFinitePositive(copper.contactLandMm.heightMm)) {
      errors.push(`${record.mpn}: contact land dimensions must be positive`)
    }
  }
  if (!isFinitePositive(record.footprint.paste.stencilThicknessMm)) {
    errors.push(`${record.mpn}: stencil thickness must be positive`)
  }
  const holeIds = new Set<string>()
  for (const hole of holes) {
    if (holeIds.has(hole.id)) errors.push(`${record.mpn}: duplicate hole ${hole.id}`)
    holeIds.add(hole.id)
    if (!Number.isFinite(hole.diameterMm) || hole.diameterMm <= 0)
      errors.push(`${record.mpn}: hole ${hole.id} diameter must be positive`)
    if (
      (hole.xMm !== undefined && !Number.isFinite(hole.xMm)) ||
      (hole.yMm !== undefined && !Number.isFinite(hole.yMm))
    ) {
      errors.push(`${record.mpn}: hole ${hole.id} coordinates must be finite when transcribed`)
    }
    if ((hole.xMm === undefined) !== (hole.yMm === undefined)) {
      errors.push(`${record.mpn}: hole ${hole.id} must provide both coordinates or neither`)
    }
    if (hole.kind === "non-plated-hole" && hole.role === "contact") {
      errors.push(`${record.mpn}: contact hole ${hole.id} cannot be non-plated`)
    }
  }
  return errors
}

const canonicalMates = new Map<string, readonly CarrierConnectorMpn[]>([
  ["43045-0400", ["43025-0400"]],
  ["43025-0400", ["43045-0400", "43030-0007"]],
  ["43030-0007", ["43025-0400"]],
  ["HSEC8-113-01-L-DV-A-L2", ["ECDP-08-07.87-L1-L2-1-3"]],
  ["ECDP-08-07.87-L1-L2-1-3", ["HSEC8-113-01-L-DV-A-L2"]]
])

function canonicalMateErrors(record: CarrierConnectorEvidence): string[] {
  const expected = canonicalMates.get(record.mpn)
  if (expected === undefined) return [`${record.mpn}: unsupported connector MPN`]
  if (!Array.isArray(record.exactMates)) return [`${record.mpn}: exact mates must be an array`]
  const actual = new Set(record.exactMates)
  if (
    actual.size !== record.exactMates.length ||
    actual.size !== expected.length ||
    expected.some((mate) => !actual.has(mate))
  ) {
    return [`${record.mpn}: exact mate set must be ${expected.join(", ")}`]
  }
  return []
}

function harnessErrors(record: CarrierConnectorEvidence): string[] {
  if (record.mpn !== "ECDP-08-07.87-L1-L2-1-3") {
    return record.harness === undefined ? [] : [`${record.mpn}: only the ECDP cable may define harness data`]
  }
  if (record.harness === undefined) return [`${record.mpn}: exact harness data is required`]
  if (record.harness === null || typeof record.harness !== "object") {
    return [`${record.mpn}: harness data must be an object`]
  }

  const errors: string[] = []
  for (const [field, value] of [
    ["cable length inches", record.harness.cableLengthIn],
    ["cable length millimetres", record.harness.cableLengthMm],
    ["overall reference length", record.harness.overallLengthReferenceMm]
  ] as const) {
    if (!isRequiredFinitePositive(value)) errors.push(`${record.mpn}: ${field} must be finite and positive`)
  }
  if (!Number.isInteger(record.harness.pairCount) || record.harness.pairCount <= 0) {
    errors.push(`${record.mpn}: pair count must be a positive integer`)
  }
  if (
    record.harness.pairCount !== 8 ||
    record.harness.cableLengthIn !== 7.87 ||
    record.harness.cableLengthMm !== 199.898 ||
    record.harness.overallLengthReferenceMm !== 217.428 ||
    record.harness.firstEnd !== "L1" ||
    record.harness.secondEnd !== "L2" ||
    record.harness.wiringOption !== "pin-1-to-pin-1" ||
    record.harness.cableOption !== "100-ohm-eyespeed"
  ) {
    errors.push(`${record.mpn}: harness fields do not match the selected -08-07.87-L1-L2-1-3 configuration`)
  }
  return errors
}

function canonicalHoleErrors(record: CarrierConnectorEvidence): string[] {
  const errors: string[] = []
  if (record.mpn === "43045-0400") {
    const footprint = record.footprint
    const holes = Array.isArray(record.footprint?.holes) ? record.footprint.holes : []
    const expectedCoordinates: Readonly<Record<string, readonly [number, number]>> = {
      "1": [0, 0],
      "2": [0, 3],
      "3": [3, 0],
      "4": [3, 3]
    }
    if (holes.length !== 4) errors.push("43045-0400: four contact holes are required")
    if (footprint?.copper.contactCount !== 4 || footprint.copper.rowCount !== 2 || footprint.copper.pitchMm !== 3) {
      errors.push("43045-0400: canonical four-contact two-row 3.00 mm geometry changed")
    }
    for (const [id, [xMm, yMm]] of Object.entries(expectedCoordinates)) {
      const hole = holes.find((candidate) => candidate.id === id)
      if (
        hole === undefined ||
        hole.kind !== "plated-hole" ||
        hole.role !== "contact" ||
        hole.diameterMm !== 1.02 ||
        hole.xMm !== xMm ||
        hole.yMm !== yMm
      ) {
        errors.push(`43045-0400: hole ${id} must preserve the canonical 1.02 mm contact pattern`)
      }
    }
  }
  if (record.mpn === "HSEC8-113-01-L-DV-A-L2") {
    const footprint = record.footprint
    const holes = Array.isArray(footprint?.holes) ? footprint.holes : []
    const alignment = holes.filter(
      (hole) => hole.kind === "non-plated-hole" && hole.role === "alignment" && hole.diameterMm === 1.27
    )
    const latches = holes.filter(
      (hole) => hole.kind === "plated-hole" && hole.role === "latch" && hole.diameterMm === 0.84
    )
    if (alignment.length !== 2 || latches.length !== 2 || holes.length !== 4) {
      errors.push("HSEC8-113-01-L-DV-A-L2: two 1.27 mm alignment NPTHs and two 0.84 mm latch PTHs are required")
    }
    if (
      footprint?.boardThicknessMm !== 1.57 ||
      footprint.boardThicknessToleranceMm !== 0.15 ||
      footprint.copper.contactCount !== 26 ||
      footprint.copper.rowCount !== 2 ||
      footprint.copper.pitchMm !== 0.8 ||
      footprint.copper.contactLandMm?.widthMm !== 0.8 ||
      footprint.copper.contactLandMm.heightMm !== 1.2 ||
      footprint.paste.stencilThicknessMm !== 0.15
    ) {
      errors.push("HSEC8-113-01-L-DV-A-L2: canonical -113-01 contact, card, or stencil geometry changed")
    }
  }
  return errors
}

/** Validate the isolated source/evidence model without granting release. */
export function validateCarrierConnectorEvidence(records: readonly CarrierConnectorEvidence[]): readonly string[] {
  const errors: string[] = []
  const mpns = new Set<string>()
  for (const record of records) {
    if (mpns.has(record.mpn)) errors.push(`${record.mpn}: duplicate MPN`)
    mpns.add(record.mpn)
    if (record.releaseState !== "deny") errors.push(`${record.mpn}: release must fail closed`)
    if (record.package.trim().length === 0) errors.push(`${record.mpn}: package description is required`)
    if (Array.isArray(record.exactMates) && record.exactMates.length === 0) {
      errors.push(`${record.mpn}: exact mate assignment is required`)
    }
    if (record.missingReleaseEvidence.length === 0) errors.push(`${record.mpn}: release blockers are required`)
    for (const blocker of record.missingReleaseEvidence) {
      if (blocker.trim().length === 0) errors.push(`${record.mpn}: release blockers must be nonblank`)
    }
    errors.push(
      ...sourceErrors(record),
      ...footprintErrors(record),
      ...canonicalMateErrors(record),
      ...harnessErrors(record),
      ...canonicalHoleErrors(record)
    )
  }
  const recordsByMpn = new Map(records.map((record) => [record.mpn, record] as const))
  for (const record of records) {
    if (!Array.isArray(record.exactMates)) continue
    for (const mateMpn of record.exactMates) {
      const mate = recordsByMpn.get(mateMpn)
      if (mate === undefined) {
        errors.push(`${record.mpn}: exact mate ${mateMpn} is missing from the evidence set`)
      } else if (!mate.exactMates.includes(record.mpn)) {
        errors.push(`${record.mpn}: exact mate ${mateMpn} is not reciprocal`)
      }
    }
  }
  return errors
}

export function findCarrierConnectorEvidence(mpn: string): CarrierConnectorEvidence | undefined {
  return carrierConnectorFootprintEvidence.find((record) => record.mpn === mpn)
}

/** A record whose authoritative state is DENY can never authorize release. */
export function canReleaseCarrierConnector(_record: CarrierConnectorEvidence): false {
  return false
}
