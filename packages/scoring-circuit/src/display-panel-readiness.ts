import { calculateRailBudget, evaluateDisplayLoad, type PowerPair } from "./power-budget.js"

export type DisplayPanelReadiness = {
  blockers: readonly string[]
  declaredLoad: PowerPair
  dimensionsMm: {
    height: number
    width: number
  }
  evidenceUrls: readonly string[]
  headerPins: readonly string[]
  manufacturer: string
  model: string
  primarySources: readonly DisplayPanelPrimarySource[]
  pixelPitchMm: number
  productionApproved: boolean
  resolution: {
    height: number
    width: number
  }
  scanRatio: string
  selectionStatus: "candidate" | "selected"
  sku: string
  supplyCurrentA: number
  supplyVoltageV: number
}

export type DisplayPanelAcquiredArtifact = {
  readonly acquiredDate: "2026-08-24"
  readonly evidenceFile: `packages/scoring-circuit/docs/evidence/bp-143/${string}`
  readonly sha256: string
}

export type DisplayPanelPrimarySource = {
  readonly access: "manufacturer-acquired-hash-bound" | "vendor-listed"
  readonly acquiredArtifact?: DisplayPanelAcquiredArtifact
  readonly exactPart: string
  readonly kind: "product-page" | "series-print" | "series-specification" | "vendor-product-page"
  readonly manufacturer: string
  readonly revision: string
  readonly role: "panel" | "signal-cable" | "power-cable" | "board-header" | "power-mate"
  readonly url: string
}

export const canonicalHub75HeaderPins = [
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
] as const

/**
 * Hash-bound source bytes for the exact BP-143 panel, signal cable, power
 * cable, header, and SM-series power mates. These are source records only:
 * they do not assert purchase, receipt, continuity, fit, current, temperature,
 * CAD, fabrication, or release approval.
 */
export const displayPanelPrimarySources = [
  {
    access: "manufacturer-acquired-hash-bound",
    acquiredArtifact: {
      acquiredDate: "2026-08-24",
      evidenceFile: "packages/scoring-circuit/docs/evidence/bp-143/adafruit-2277.html",
      sha256: "0C777FFEBB7B17739CCFDF91E3EADAE5AE50769F22C92492D281F4C33AF4EAB7"
    },
    exactPart: "Adafruit Industries product 2277",
    kind: "product-page",
    manufacturer: "Adafruit Industries",
    revision: "Product page retrieved 2026-08-24",
    role: "panel",
    url: "https://www.adafruit.com/product/2277"
  },
  {
    access: "manufacturer-acquired-hash-bound",
    acquiredArtifact: {
      acquiredDate: "2026-08-24",
      evidenceFile: "packages/scoring-circuit/docs/evidence/bp-143/adafruit-4170.html",
      sha256: "9947C756279B91B4416141B4C2D21B53D3C3DA8276AFFA49A95823E170EA3C0F"
    },
    exactPart: "Adafruit Industries product 4170",
    kind: "product-page",
    manufacturer: "Adafruit Industries",
    revision: "Product page retrieved 2026-08-24",
    role: "signal-cable",
    url: "https://www.adafruit.com/product/4170"
  },
  {
    access: "manufacturer-acquired-hash-bound",
    acquiredArtifact: {
      acquiredDate: "2026-08-24",
      evidenceFile: "packages/scoring-circuit/docs/evidence/bp-143/adafruit-4767.html",
      sha256: "93BF82D57B0F6A3009C6BB993E60A422A3F5D091060FAE44B86A6436E1A100D6"
    },
    exactPart: "Adafruit Industries product 4767",
    kind: "product-page",
    manufacturer: "Adafruit Industries",
    revision: "Product page retrieved 2026-08-24",
    role: "power-cable",
    url: "https://www.adafruit.com/product/4767"
  },
  {
    access: "manufacturer-acquired-hash-bound",
    acquiredArtifact: {
      acquiredDate: "2026-08-24",
      evidenceFile: "packages/scoring-circuit/docs/evidence/bp-143/samtec-tst-108-04-g-d-ra.html",
      sha256: "6B3FAD6D5B2E2649DEDFD00EE87C68D692C0CFF9ACFBB81A5D584D5F85A85464"
    },
    exactPart: "Samtec TST-108-04-G-D-RA",
    kind: "product-page",
    manufacturer: "Samtec",
    revision: "Product page retrieved 2026-08-24",
    role: "board-header",
    url: "https://www.samtec.com/products/tst-108-04-g-d-ra"
  },
  {
    access: "manufacturer-acquired-hash-bound",
    acquiredArtifact: {
      acquiredDate: "2026-08-24",
      evidenceFile: "packages/scoring-circuit/docs/evidence/bp-143/samtec-tst-series-print.pdf",
      sha256: "56AE927287856E76D57FF3B0953D3D4F853183E397794A31EE6DC5D3E07B6059"
    },
    exactPart: "Samtec TST-108-04-G-D-RA",
    kind: "series-print",
    manufacturer: "Samtec",
    revision: "TST-1XX-XX-X-X-XX-XX-MKT revision AQ",
    role: "board-header",
    url: "https://suddendocs.samtec.com/prints/tst-1xx-xx-x-x-xx-xx-mkt.pdf"
  },
  {
    access: "manufacturer-acquired-hash-bound",
    acquiredArtifact: {
      acquiredDate: "2026-08-24",
      evidenceFile: "packages/scoring-circuit/docs/evidence/bp-143/samtec-tst-footprint.pdf",
      sha256: "ED9B9280C24AA99BB4714557997CA5452FE7E245961599A4C39537FEFCD366DC"
    },
    exactPart: "Samtec TST-108-04-G-D-RA",
    kind: "series-print",
    manufacturer: "Samtec",
    revision: "TSS-TSTD double-row footprint print",
    role: "board-header",
    url: "https://suddendocs.samtec.com/prints/tss-tstd.pdf"
  },
  {
    access: "manufacturer-acquired-hash-bound",
    acquiredArtifact: {
      acquiredDate: "2026-08-24",
      evidenceFile: "packages/scoring-circuit/docs/evidence/bp-143/jst-esm.pdf",
      sha256: "05BB0EDE946AB6255692E007706C9AC87EECE07E2ADE4F6DD687723B4A7A3301"
    },
    exactPart: "JST SMR-04V-N, SYM-001T-P0.6, SMP-04V-NC, SHF-001T-0.8BS",
    kind: "series-specification",
    manufacturer: "J.S.T. Mfg. Co., Ltd.",
    revision: "eSM SM connector series specification retrieved 2026-08-24",
    role: "power-mate",
    url: "https://www.jst.com/wp-content/uploads/2025/06/eSM.pdf"
  },
  {
    access: "vendor-listed",
    exactPart: "Samtec TST-108-04-G-D-RA",
    kind: "vendor-product-page",
    manufacturer: "DigiKey Electronics",
    revision: "Product listing checked 2026-08-24; current rating is vendor-listed only",
    role: "board-header",
    url: "https://www.digikey.com/en/products/detail/samtec-inc/TST-108-04-G-D-RA/2685833"
  }
] as const satisfies readonly DisplayPanelPrimarySource[]

function hasCanonicalPrimarySourceIdentity(
  actual: DisplayPanelPrimarySource,
  expected: DisplayPanelPrimarySource
): boolean {
  return (
    actual.access === expected.access &&
    actual.exactPart === expected.exactPart &&
    actual.kind === expected.kind &&
    actual.manufacturer === expected.manufacturer &&
    actual.revision === expected.revision &&
    actual.role === expected.role &&
    actual.url === expected.url &&
    actual.acquiredArtifact?.acquiredDate === expected.acquiredArtifact?.acquiredDate &&
    actual.acquiredArtifact?.evidenceFile === expected.acquiredArtifact?.evidenceFile &&
    actual.acquiredArtifact?.sha256 === expected.acquiredArtifact?.sha256
  )
}

/**
 * The selected EVT panel is a real, orderable Adafruit product, but this is
 * not a production approval. The panel's LED-driver revision, connector
 * assembly, logic thresholds, and brightness/refresh settings still need to
 * be frozen and measured before the carrier PCB is released.
 */
export const displayPanelReadiness = {
  blockers: [
    "Purchase multiple exact product ID 2277 panels and record each PCB revision, LED-driver ICs, and connector assembly",
    "Obtain a current manufacturer CAD drawing and overlay it on the enclosure opening, fasteners, cable bend radius, and panel support",
    "Measure panel-end 5 V under black, normal-content, and maximum allowed full-white patterns after warm-up",
    "Verify the panel's HUB75 input VIH/VIL, OE polarity, latch timing, maximum clock rate, and cable signal integrity with the 5 V AHCT buffers",
    "Measure startup/inrush, connector temperature, cable drop, and blocked-vent temperature at the declared brightness and refresh settings"
  ],
  declaredLoad: {
    // Adafruit publishes a regulated 5 V input at approximately 4 A with all
    // LEDs on for this exact product ID.
    // This is a panel allowance, not a measured inrush or thermal limit.
    continuousW: 20,
    peakW: 20
  },
  dimensionsMm: { height: 158, width: 318 },
  evidenceUrls: [
    "https://www.adafruit.com/product/2277",
    "https://learn.adafruit.com/32x16-32x32-rgb-led-matrix",
    "https://learn.adafruit.com/raspberry-pi-led-matrix-display"
  ],
  headerPins: canonicalHub75HeaderPins,
  manufacturer: "Adafruit Industries",
  model: "64x32 RGB LED Matrix - 5mm pitch",
  primarySources: displayPanelPrimarySources,
  pixelPitchMm: 5,
  productionApproved: false,
  resolution: { height: 32, width: 64 },
  scanRatio: "1/16",
  selectionStatus: "selected",
  sku: "2277",
  supplyCurrentA: 4,
  supplyVoltageV: 5
} as const satisfies DisplayPanelReadiness

export function validateDisplayPanelReadiness(panel: DisplayPanelReadiness): readonly string[] {
  const errors: string[] = []
  if (panel.manufacturer.trim().length === 0) errors.push("display panel manufacturer must be nonblank")
  if (panel.model.trim().length === 0) errors.push("display panel model must be nonblank")
  if (panel.sku.trim().length === 0 || /\bTBD\b/i.test(panel.sku)) errors.push("display panel SKU must be concrete")
  if (
    panel.headerPins.length !== canonicalHub75HeaderPins.length ||
    canonicalHub75HeaderPins.some((pin, index) => panel.headerPins[index] !== pin)
  ) {
    errors.push("display panel header must match the canonical 64x32 HUB75 pin order")
  }
  if (panel.resolution.width !== 64 || panel.resolution.height !== 32) {
    errors.push("display panel resolution must be 64 by 32")
  }
  if (panel.scanRatio !== "1/16") errors.push("display panel must be a 1/16-scan candidate")
  if (!Number.isFinite(panel.pixelPitchMm) || panel.pixelPitchMm <= 0) {
    errors.push("display panel pixel pitch must be finite and positive")
  }
  if (!Number.isFinite(panel.supplyVoltageV) || panel.supplyVoltageV !== 5) {
    errors.push("display panel supply voltage must be 5 V")
  }
  if (!Number.isFinite(panel.supplyCurrentA) || panel.supplyCurrentA <= 0) {
    errors.push("display panel supply current must be finite and positive")
  }
  const publishedLoadEnvelopeW = panel.supplyVoltageV * panel.supplyCurrentA
  if (!Number.isFinite(panel.declaredLoad.continuousW) || panel.declaredLoad.continuousW < 0) {
    errors.push("display panel continuous load must be finite and non-negative")
  } else if (Number.isFinite(publishedLoadEnvelopeW) && panel.declaredLoad.continuousW > publishedLoadEnvelopeW) {
    errors.push("display panel continuous load exceeds its published voltage/current envelope")
  }
  if (!Number.isFinite(panel.declaredLoad.peakW) || panel.declaredLoad.peakW < 0) {
    errors.push("display panel peak load must be finite and non-negative")
  } else if (Number.isFinite(publishedLoadEnvelopeW) && panel.declaredLoad.peakW > publishedLoadEnvelopeW) {
    errors.push("display panel peak load exceeds its published voltage/current envelope")
  }
  if (
    Number.isFinite(panel.declaredLoad.continuousW) &&
    Number.isFinite(panel.declaredLoad.peakW) &&
    panel.declaredLoad.continuousW > panel.declaredLoad.peakW
  ) {
    errors.push("display panel peak load must be greater than or equal to continuous load")
  }
  for (const url of panel.evidenceUrls) {
    if (!url.startsWith("https://")) errors.push("display panel evidence URL must use HTTPS")
  }
  if (panel.primarySources.length === 0) {
    errors.push("display panel primary manufacturer/vendor sources are required")
  }
  if (
    panel.primarySources.length !== displayPanelPrimarySources.length ||
    displayPanelPrimarySources.some(
      (expected, index) =>
        panel.primarySources[index] === undefined ||
        !hasCanonicalPrimarySourceIdentity(panel.primarySources[index], expected)
    )
  ) {
    errors.push("display panel primary sources must match the reviewed ordered source set")
  }
  const artifactPaths = new Set<string>()
  for (const source of panel.primarySources) {
    if (source.exactPart.trim().length === 0) errors.push("display panel primary source exact part is required")
    if (source.manufacturer.trim().length === 0) errors.push("display panel primary source manufacturer is required")
    if (source.revision.trim().length === 0) errors.push("display panel primary source revision is required")
    if (!source.url.startsWith("https://")) errors.push("display panel primary source URL must use HTTPS")
    if (source.access === "manufacturer-acquired-hash-bound") {
      const artifact = source.acquiredArtifact
      if (
        artifact === undefined ||
        artifact.acquiredDate !== "2026-08-24" ||
        !artifact.evidenceFile.startsWith("packages/scoring-circuit/docs/evidence/bp-143/") ||
        !/^[0-9A-F]{64}$/u.test(artifact.sha256)
      ) {
        errors.push("hash-bound display panel source requires the BP-143 artifact path and SHA-256")
      } else if (artifactPaths.has(artifact.evidenceFile)) {
        errors.push("display panel primary source artifact paths must be unique")
      } else {
        artifactPaths.add(artifact.evidenceFile)
      }
    } else if (source.acquiredArtifact !== undefined) {
      errors.push("vendor-listed display panel source must not claim an acquired artifact")
    }
  }
  if (panel.productionApproved && panel.blockers.length > 0) {
    errors.push("display panel production approval requires every blocker to be closed")
  }
  return errors
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function assertRecord(name: string, value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new RangeError(`${name} must be an object`)
}

function assertString(name: string, value: unknown): asserts value is string {
  if (typeof value !== "string") throw new RangeError(`${name} must be a string`)
}

function assertFiniteNumber(name: string, value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number`)
  }
}

function assertStringArray(name: string, value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new RangeError(`${name} must be an array of strings`)
  }
}

function assertPrimarySourcesShape(value: unknown): asserts value is DisplayPanelPrimarySource[] {
  if (!Array.isArray(value)) throw new RangeError("display panel primarySources must be an array")
  for (const [index, source] of value.entries()) {
    assertRecord(`display panel primarySources[${index}]`, source)
    if (source.access !== "manufacturer-acquired-hash-bound" && source.access !== "vendor-listed") {
      throw new RangeError(`display panel primarySources[${index}].access is invalid`)
    }
    assertString(`display panel primarySources[${index}].exactPart`, source.exactPart)
    assertString(`display panel primarySources[${index}].kind`, source.kind)
    assertString(`display panel primarySources[${index}].manufacturer`, source.manufacturer)
    assertString(`display panel primarySources[${index}].revision`, source.revision)
    assertString(`display panel primarySources[${index}].role`, source.role)
    assertString(`display panel primarySources[${index}].url`, source.url)
    if (source.acquiredArtifact !== undefined) {
      assertRecord(`display panel primarySources[${index}].acquiredArtifact`, source.acquiredArtifact)
      assertString(
        `display panel primarySources[${index}].acquiredArtifact.acquiredDate`,
        source.acquiredArtifact.acquiredDate
      )
      assertString(
        `display panel primarySources[${index}].acquiredArtifact.evidenceFile`,
        source.acquiredArtifact.evidenceFile
      )
      assertString(`display panel primarySources[${index}].acquiredArtifact.sha256`, source.acquiredArtifact.sha256)
    }
  }
}

function assertDisplayPanelReadinessShape(value: unknown): asserts value is DisplayPanelReadiness {
  assertRecord("display panel", value)
  assertStringArray("display panel blockers", value.blockers)
  assertRecord("display panel declaredLoad", value.declaredLoad)
  assertFiniteNumber("display panel declaredLoad.continuousW", value.declaredLoad.continuousW)
  assertFiniteNumber("display panel declaredLoad.peakW", value.declaredLoad.peakW)
  assertRecord("display panel dimensionsMm", value.dimensionsMm)
  assertFiniteNumber("display panel dimensionsMm.height", value.dimensionsMm.height)
  assertFiniteNumber("display panel dimensionsMm.width", value.dimensionsMm.width)
  assertStringArray("display panel evidenceUrls", value.evidenceUrls)
  assertStringArray("display panel headerPins", value.headerPins)
  assertString("display panel manufacturer", value.manufacturer)
  assertString("display panel model", value.model)
  assertPrimarySourcesShape(value.primarySources)
  assertFiniteNumber("display panel pixelPitchMm", value.pixelPitchMm)
  if (typeof value.productionApproved !== "boolean") {
    throw new RangeError("display panel productionApproved must be a boolean")
  }
  assertRecord("display panel resolution", value.resolution)
  assertFiniteNumber("display panel resolution.height", value.resolution.height)
  assertFiniteNumber("display panel resolution.width", value.resolution.width)
  assertString("display panel scanRatio", value.scanRatio)
  if (value.selectionStatus !== "candidate" && value.selectionStatus !== "selected") {
    throw new RangeError("display panel selectionStatus must be candidate or selected")
  }
  assertString("display panel sku", value.sku)
  assertFiniteNumber("display panel supplyCurrentA", value.supplyCurrentA)
  assertFiniteNumber("display panel supplyVoltageV", value.supplyVoltageV)
}

export function assertDisplayPanelReadiness(value: unknown): asserts value is DisplayPanelReadiness {
  assertDisplayPanelReadinessShape(value)
  const validationErrors = validateDisplayPanelReadiness(value)
  if (validationErrors.length > 0) throw new RangeError(validationErrors.join("; "))
}

export function evaluateSelectedDisplayPanel(panel: unknown) {
  assertDisplayPanelReadiness(panel)

  const budget = calculateRailBudget()
  return {
    panel,
    budget,
    loadCheck: evaluateDisplayLoad(budget, panel.declaredLoad)
  } as const
}
