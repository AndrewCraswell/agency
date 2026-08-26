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
  if (panel.productionApproved && panel.blockers.length > 0) {
    errors.push("display panel production approval requires every blocker to be closed")
  }
  return errors
}

export function evaluateSelectedDisplayPanel(panel: DisplayPanelReadiness) {
  const validationErrors = validateDisplayPanelReadiness(panel)
  if (validationErrors.length > 0) throw new RangeError(validationErrors.join("; "))

  const budget = calculateRailBudget()
  return {
    panel,
    budget,
    loadCheck: evaluateDisplayLoad(budget, panel.declaredLoad)
  } as const
}
