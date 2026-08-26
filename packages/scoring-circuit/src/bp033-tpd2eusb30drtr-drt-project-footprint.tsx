import type { ReactElement } from "react"

const projectPadWidthMm = 0.2
const projectPadExtensionMm = 0.15
const projectPinOneTwoOffsetXMm = 0.35
const projectPadCenterYMm = 0.5
const suppressedSolderPasteMarginMm = -1

type ManufacturerLand = {
  readonly pad: "1" | "2" | "3"
  readonly signal: "D+" | "D-" | "GND"
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly extensionMm: number
  readonly sourceView: "top"
}

/**
 * BP-033 source-controlled review artwork for U_USB_DATA_PROTECT.
 *
 * The TI MPDS340 drawing supplies package lead geometry and orientation, not
 * a project land-pattern approval. The three pads below preserve the drawing's
 * maximum lead width and extension as an explicit review input. This isolated
 * component is not imported by a board circuit.
 */
const mutableGeometryDefinition = {
  artifactKind: "bp033-tpd2eusb30drtr-drt-project-footprint",
  workUnit: "BP-033",
  reference: "U_USB_DATA_PROTECT",
  manufacturer: "Texas Instruments",
  manufacturerPartNumber: "TPD2EUSB30DRTR",
  devicePartNumber: "TPD2EUSB30",
  package: {
    designation: "SOT-9X3 (DRT), 3-pin SOT",
    packageDrawing: "DRT (R-PDSO-N3), DRT0003A",
    bodyLengthMm: { minimum: 0.95, maximum: 1.05 },
    bodyWidthMm: { minimum: 0.75, maximum: 0.85 },
    heightMm: { minimum: 0.44, maximum: 0.5 },
    electricalPinCount: 3
  },
  sources: [
    {
      id: "ti-tpd2eusb30-datasheet",
      authority: "manufacturer-primary",
      documentNumber: "SLVSAC2G",
      revision: "G",
      reviewedPages: "1, 3, 12, 15-17",
      drawingApplicability:
        "TPD2EUSB30DRTR orderable identity, DRT package name and pin count, DRT top-view pin functions, and TI packaging information.",
      url: "https://www.ti.com/lit/ds/symlink/tpd2eusb30a.pdf",
      artifactPath: "docs/evidence/bp-033/ti-tpd2eusb30a-datasheet.pdf",
      sha256: "A2C0DD845043A5BBFE610F673879C29E38649544385DEA51DBE0A4C49DF39136"
    },
    {
      id: "ti-drt0003a-package-outline",
      authority: "manufacturer-primary",
      documentNumber: "MPDS340",
      revision: "4206292-2/D",
      reviewedPages: "1-2",
      drawingApplicability:
        "DRT (R-PDSO-N3) package outline, top-view pin-one index, pin locations, and 3X lead width and extension limits.",
      url: "https://www.ti.com/lit/pdf/MPDS340",
      artifactPath: "docs/evidence/bp-033/ti-drt0003a-mpds340-package-outline.pdf",
      sha256: "77A557465D7DB37AEB603EB07930BB3CB5B118ADFA576F5EB1C6F0C0C97CFE73",
      semanticEvidence: {
        retainedPageCount: 2,
        drawingPage: 1,
        noticePage: 2,
        pageSizePoints: [0, 0, 612, 792],
        minimumConstructPathOperators: 7000,
        minimumSetLineWidthOperators: 40,
        noticeMarker: "IMPORTANT NOTICE"
      }
    }
  ],
  manufacturerCad: {
    state: "not-retained",
    authority: "deny",
    reason:
      "TI's product page routes SOT-9X3 CAD to its sponsored Ultra Librarian link. No native TI ECAD or 3D artifact is retained, imported, or fit-checked by this slice."
  },
  manufacturerLandData: {
    state: "source-outline-lead-data-review-only",
    sourceDocument: "MPDS340",
    sourceView: "top",
    sourceNotes:
      "MPDS340 is a mechanical package outline, not a TI example board land-pattern drawing. The values below are the three package-lead width and outward-extension limits shown on page 1.",
    leadWidthMm: { minimum: 0.1, maximum: 0.2 },
    leadExtensionMm: { minimum: 0.05, maximum: 0.15 },
    pinOneTwoCenterOffsetXMm: 0.35,
    lands: [
      {
        pad: "1",
        signal: "D+",
        xMm: -projectPinOneTwoOffsetXMm,
        yMm: -projectPadCenterYMm,
        widthMm: projectPadWidthMm,
        extensionMm: projectPadExtensionMm,
        sourceView: "top"
      },
      {
        pad: "2",
        signal: "D-",
        xMm: projectPinOneTwoOffsetXMm,
        yMm: -projectPadCenterYMm,
        widthMm: projectPadWidthMm,
        extensionMm: projectPadExtensionMm,
        sourceView: "top"
      },
      {
        pad: "3",
        signal: "GND",
        xMm: 0,
        yMm: projectPadCenterYMm,
        widthMm: projectPadWidthMm,
        extensionMm: projectPadExtensionMm,
        sourceView: "top"
      }
    ] satisfies readonly ManufacturerLand[]
  },
  projectSelection: {
    state: "source-controlled-review-only",
    copperPad: {
      widthMm: projectPadWidthMm,
      heightMm: projectPadExtensionMm,
      basis: "maximum MPDS340 lead width and extension; not a released land pattern"
    },
    solderMask: {
      marginMm: 0.05,
      state: "project-review-input"
    },
    solderPaste: {
      state: "not-published-by-TI",
      geometry: null,
      disposition: "suppressed-until-independent-stencil-review",
      suppressionMarginMm: suppressedSolderPasteMarginMm
    },
    courtyard: {
      widthMm: 1.35,
      heightMm: 1.15,
      minimumClearanceMm: 0.15,
      state: "project-review-input",
      basis: "explicit review envelope around the 1.05 mm by 0.85 mm maximum body; TI does not publish a courtyard"
    }
  },
  pinMap: [
    { pad: "1", signal: "D+", function: "D1+" },
    { pad: "2", signal: "D-", function: "D1-" },
    { pad: "3", signal: "GND", function: "GND" }
  ],
  orientation: {
    state: "source-controlled-review-only",
    view: "top",
    boardRotationDegrees: 0,
    datum: "TI MPDS340 top-view package center",
    pinOne: {
      pad: "1",
      position: "lower-left",
      xMm: -projectPinOneTwoOffsetXMm,
      yMm: -projectPadCenterYMm,
      index: "lower-left pin-one index area"
    },
    sequence: "pin 1 lower-left, pin 2 lower-right, pin 3 upper-center",
    sourceViewTransform: {
      source: "TI datasheet Figure 5-1 DRT top view",
      target: "TI MPDS340 top view",
      sourceToTargetRotationDegrees: 90,
      sourceToTargetDirection: "counter-clockwise",
      note: "The artifact uses MPDS340 top-view coordinates; the datasheet view maps to MPDS340 by a counter-clockwise 90-degree rotation."
    },
    independentlyReviewed: false
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: "f206c789162f96e38c781ca937d052b48b44bc66a91df41cebd7ad4cc6eff86e",
    authority: "deny"
  },
  acceptance: {
    projectArtworkRendered: true,
    projectGeometryAccepted: false,
    orientationAccepted: false,
    manufacturerCadImported: false,
    boardImported: false,
    boardFitAccepted: false,
    courtyardAccepted: false,
    drcAccepted: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

function deepFreezeStrict<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-033 TPD2EUSB30 geometry cannot contain aliases or cycles")
  seen.add(value)
  const prototype = Object.getPrototypeOf(value)
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) throw new RangeError("BP-033 TPD2EUSB30 arrays must use Array.prototype")
  } else if (prototype !== Object.prototype) {
    throw new RangeError("BP-033 TPD2EUSB30 records must use Object.prototype")
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-033 TPD2EUSB30 geometry accepts data properties only")
    }
    deepFreezeStrict(descriptor.value, seen)
  }
  return Object.freeze(value)
}

export const bp033Tpd2eusb30drtrDrtProjectFootprintGeometry = deepFreezeStrict(mutableGeometryDefinition)

function sameStrictDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (seen.has(actual)) return seen.get(actual) === expected
  const actualIsArray = Array.isArray(actual)
  const expectedIsArray = Array.isArray(expected)
  if (actualIsArray !== expectedIsArray) return false
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false
  if (Object.isExtensible(actual) !== Object.isExtensible(expected)) return false
  seen.set(actual, expected)
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  )
    return false
  return expectedKeys.every((key) => {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      actualDescriptor === undefined ||
      expectedDescriptor === undefined ||
      !("value" in actualDescriptor) ||
      !("value" in expectedDescriptor) ||
      actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
      actualDescriptor.configurable !== expectedDescriptor.configurable ||
      actualDescriptor.writable !== expectedDescriptor.writable
    )
      return false
    return sameStrictDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
  })
}

type Bp033Tpd2eusb30drtrDrtProjectFootprintGeometry = typeof bp033Tpd2eusb30drtrDrtProjectFootprintGeometry

/** Accept only the exact frozen review artifact; a clean result grants no release authority. */
export function validateBp033Tpd2eusb30drtrDrtProjectFootprint(
  value: unknown = bp033Tpd2eusb30drtrDrtProjectFootprintGeometry
): true {
  if (!sameStrictDataGraph(value, bp033Tpd2eusb30drtrDrtProjectFootprintGeometry)) {
    throw new RangeError("BP-033 TPD2EUSB30DRTR geometry must exactly match the frozen review artifact")
  }
  const evidence: Bp033Tpd2eusb30drtrDrtProjectFootprintGeometry = bp033Tpd2eusb30drtrDrtProjectFootprintGeometry
  if (
    evidence.reference !== "U_USB_DATA_PROTECT" ||
    evidence.manufacturerPartNumber !== "TPD2EUSB30DRTR" ||
    evidence.pinMap.length !== 3 ||
    evidence.pinMap.some((entry, index) => {
      const expected = [
        { pad: "1", signal: "D+", function: "D1+" },
        { pad: "2", signal: "D-", function: "D1-" },
        { pad: "3", signal: "GND", function: "GND" }
      ][index]
      return (
        expected === undefined ||
        entry.pad !== expected.pad ||
        entry.signal !== expected.signal ||
        entry.function !== expected.function
      )
    }) ||
    evidence.artwork.sha256 !== "f206c789162f96e38c781ca937d052b48b44bc66a91df41cebd7ad4cc6eff86e" ||
    evidence.acceptance.projectGeometryAccepted ||
    evidence.acceptance.orientationAccepted ||
    evidence.acceptance.manufacturerCadImported ||
    evidence.acceptance.boardImported ||
    evidence.acceptance.boardFitAccepted ||
    evidence.acceptance.courtyardAccepted ||
    evidence.acceptance.drcAccepted ||
    evidence.acceptance.fabricationAuthorized ||
    evidence.acceptance.releaseState !== "deny" ||
    evidence.artwork.authority !== "deny"
  ) {
    throw new RangeError("BP-033 TPD2EUSB30DRTR geometry or deny authority drifted")
  }
  return true
}

const projectFootprint = (
  <footprint name="BP033_TPD2EUSB30DRTR_DRT_PROJECT_FOOTPRINT" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectPinOneTwoOffsetXMm}
      pcbY={-projectPadCenterYMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      // TI does not publish a stencil aperture; suppress tscircuit's default paste artifact until independent stencil review.
      solderPasteMargin={`${suppressedSolderPasteMarginMm}mm`}
      width={`${projectPadWidthMm}mm`}
      height={`${projectPadExtensionMm}mm`}
      portHints={["1", "D+", "D1+", "pin1"]}
    />
    <smtpad
      name="2"
      pcbX={projectPinOneTwoOffsetXMm}
      pcbY={-projectPadCenterYMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin={`${suppressedSolderPasteMarginMm}mm`}
      width={`${projectPadWidthMm}mm`}
      height={`${projectPadExtensionMm}mm`}
      portHints={["2", "D-", "D1-", "pin2"]}
    />
    <smtpad
      name="3"
      pcbX={0}
      pcbY={projectPadCenterYMm}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin={`${suppressedSolderPasteMarginMm}mm`}
      width={`${projectPadWidthMm}mm`}
      height={`${projectPadExtensionMm}mm`}
      portHints={["3", "GND", "pin3"]}
    />
    {/* Review envelope only; not TI CAD, board geometry, or fabrication artwork. */}
    <courtyardrect pcbX={0} pcbY={0} width="1.35mm" height="1.15mm" strokeWidth="0.05mm" />
  </footprint>
)

export interface Bp033Tpd2eusb30drtrDrtProjectFootprintProps {
  readonly name?: string
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated BP-033 review-only footprint candidate for U_USB_DATA_PROTECT. */
export function Bp033Tpd2eusb30drtrDrtProjectFootprint({
  name,
  pcbRotation,
  pcbX,
  pcbY
}: Bp033Tpd2eusb30drtrDrtProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name={name ?? "U_BP033_TPD2EUSB30DRTR"}
      manufacturerPartNumber="TPD2EUSB30DRTR"
      pinLabels={{ pin1: "D+", pin2: "D-", pin3: "GND" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

validateBp033Tpd2eusb30drtrDrtProjectFootprint()

export default Bp033Tpd2eusb30drtrDrtProjectFootprint
