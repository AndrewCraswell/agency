import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp033Tpd2eusb30drtrDrtProjectFootprintGeometry,
  Bp033Tpd2eusb30drtrDrtProjectFootprint,
  validateBp033Tpd2eusb30drtrDrtProjectFootprint
} from "./bp033-tpd2eusb30drtr-drt-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

function renderProjectFootprint() {
  return renderTestCircuit(<Bp033Tpd2eusb30drtrDrtProjectFootprint />)
}

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isCourtyardRect(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly type: "pcb_courtyard_rect" }> {
  return element.type === "pcb_courtyard_rect"
}

function retainedEvidenceHash(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("docs/", "../docs/")
  return createHash("sha256")
    .update(readFileSync(new URL(packageRelativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

async function retainedDrawingPageGeometry(artifactPath: string, drawingPage: number, noticePage: number) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const packageRelativePath = artifactPath.replace("docs/", "../docs/")
  const document = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync(new URL(packageRelativePath, import.meta.url)))
  }).promise
  const page = await document.getPage(drawingPage)
  const operatorList = await page.getOperatorList()
  const constructPath = operatorList.fnArray.filter((operator) => operator === pdfjs.OPS.constructPath).length
  const setLineWidth = operatorList.fnArray.filter((operator) => operator === pdfjs.OPS.setLineWidth).length
  const notice = await document.getPage(noticePage)
  const noticeText = (await notice.getTextContent()).items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
  const result = {
    pageCount: document.numPages,
    pageSizePoints: page.view,
    constructPath,
    setLineWidth,
    noticeText
  }
  return result
}

function renderedGeometryHash() {
  const rendered = renderProjectFootprint()
  const geometry: Array<Record<string, unknown>> = []
  for (const element of rendered) {
    if (isRectSmtPad(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        soldermask_margin: element.soldermask_margin,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (isCourtyardRect(element)) {
      geometry.push({ center: element.center, height: element.height, type: element.type, width: element.width })
    }
  }
  geometry.push({
    type: "pcb_solder_paste",
    count: rendered.filter((element) => element.type === "pcb_solder_paste").length
  })
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex")
}

describe("BP-033 TPD2EUSB30DRTR DRT project footprint", () => {
  it("binds the exact orderable, package, sources, pin map, and denied authority", () => {
    expect(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry).toMatchObject({
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
        electricalPinCount: 3
      },
      projectSelection: {
        solderPaste: {
          state: "not-published-by-TI",
          geometry: null,
          disposition: "suppressed-until-independent-stencil-review",
          suppressionMarginMm: -1
        }
      },
      manufacturerCad: { state: "not-retained", authority: "deny" },
      orientation: {
        state: "source-controlled-review-only",
        view: "top",
        boardRotationDegrees: 0,
        pinOne: { pad: "1", position: "lower-left", xMm: -0.35, yMm: -0.5 },
        sourceViewTransform: {
          sourceToTargetRotationDegrees: 90,
          sourceToTargetDirection: "counter-clockwise",
          source: "TI datasheet Figure 5-1 DRT top view",
          target: "TI MPDS340 top view"
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
        boardImported: false,
        boardFitAccepted: false,
        drcAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    expect(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry.pinMap).toEqual([
      { pad: "1", signal: "D+", function: "D1+" },
      { pad: "2", signal: "D-", function: "D1-" },
      { pad: "3", signal: "GND", function: "GND" }
    ])
    expect(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry.sources).toEqual([
      expect.objectContaining({
        documentNumber: "SLVSAC2G",
        artifactPath: "docs/evidence/bp-033/ti-tpd2eusb30a-datasheet.pdf",
        url: "https://www.ti.com/lit/ds/symlink/tpd2eusb30a.pdf",
        sha256: "A2C0DD845043A5BBFE610F673879C29E38649544385DEA51DBE0A4C49DF39136"
      }),
      expect.objectContaining({
        documentNumber: "MPDS340",
        reviewedPages: "1-2",
        artifactPath: "docs/evidence/bp-033/ti-drt0003a-mpds340-package-outline.pdf",
        url: "https://www.ti.com/lit/pdf/MPDS340",
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
      })
    ])
    for (const source of bp033Tpd2eusb30drtrDrtProjectFootprintGeometry.sources) {
      expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sha256)
    }
  })

  it("binds the TI source lead limits and top-view manufacturer land disposition", () => {
    const { manufacturerLandData } = bp033Tpd2eusb30drtrDrtProjectFootprintGeometry
    expect(manufacturerLandData).toMatchObject({
      state: "source-outline-lead-data-review-only",
      sourceDocument: "MPDS340",
      sourceView: "top",
      leadWidthMm: { minimum: 0.1, maximum: 0.2 },
      leadExtensionMm: { minimum: 0.05, maximum: 0.15 },
      pinOneTwoCenterOffsetXMm: 0.35
    })
    expect(manufacturerLandData.lands).toEqual([
      { pad: "1", signal: "D+", xMm: -0.35, yMm: -0.5, widthMm: 0.2, extensionMm: 0.15, sourceView: "top" },
      { pad: "2", signal: "D-", xMm: 0.35, yMm: -0.5, widthMm: 0.2, extensionMm: 0.15, sourceView: "top" },
      { pad: "3", signal: "GND", xMm: 0, yMm: 0.5, widthMm: 0.2, extensionMm: 0.15, sourceView: "top" }
    ])
    expect(manufacturerLandData.sourceNotes).toContain("not a TI example board land-pattern drawing")
  })

  it("renders three source-mapped pads and only a review courtyard", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    expect(pads).toHaveLength(3)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -0.35, y: -0.5, width: 0.2, height: 0.15, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 0.35, y: -0.5, width: 0.2, height: 0.15, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 0, y: 0.5, width: 0.2, height: 0.15, soldermask_margin: 0.05 })
      ])
    )
    expect(json.filter(isCourtyardRect)).toEqual([
      expect.objectContaining({ center: { x: 0, y: 0 }, width: 1.35, height: 1.15 })
    ])
    expect(json.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(0)
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("records the 90-degree source-view transform used by the review coordinates", () => {
    const { orientation } = bp033Tpd2eusb30drtrDrtProjectFootprintGeometry
    expect(orientation.sourceViewTransform).toEqual({
      source: "TI datasheet Figure 5-1 DRT top view",
      target: "TI MPDS340 top view",
      sourceToTargetRotationDegrees: 90,
      sourceToTargetDirection: "counter-clockwise",
      note: "The artifact uses MPDS340 top-view coordinates; the datasheet view maps to MPDS340 by a counter-clockwise 90-degree rotation."
    })
    const datasheetPinOne = { x: -0.5, y: 0.35 }
    const datasheetPinTwo = { x: -0.5, y: -0.35 }
    const datasheetGround = { x: 0.5, y: 0 }
    const rotateCounterClockwise = ({ x, y }: { x: number; y: number }) => ({ x: -y, y: x })
    expect(rotateCounterClockwise(datasheetPinOne)).toEqual({ x: -0.35, y: -0.5 })
    expect(rotateCounterClockwise(datasheetPinTwo)).toEqual({ x: 0.35, y: -0.5 })
    const rotatedGround = rotateCounterClockwise(datasheetGround)
    expect(Math.abs(rotatedGround.x)).toBe(0)
    expect(rotatedGround.y).toBe(0.5)
  })

  it("proves the retained artifact contains the package drawing, not an Important Notice", async () => {
    const source = bp033Tpd2eusb30drtrDrtProjectFootprintGeometry.sources[1]
    const evidence = await retainedDrawingPageGeometry(
      source.artifactPath,
      source.semanticEvidence.drawingPage,
      source.semanticEvidence.noticePage
    )
    expect(evidence.pageCount).toBe(source.semanticEvidence.retainedPageCount)
    expect(evidence.pageSizePoints).toEqual(source.semanticEvidence.pageSizePoints)
    expect(evidence.constructPath).toBeGreaterThanOrEqual(source.semanticEvidence.minimumConstructPathOperators)
    expect(evidence.setLineWidth).toBeGreaterThanOrEqual(source.semanticEvidence.minimumSetLineWidthOperators)
    expect(evidence.noticeText).toContain(source.semanticEvidence.noticeMarker)
  })

  it("hashes the rendered review geometry and retains all fabrication gates denied", () => {
    expect(renderedGeometryHash()).toBe(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry.artwork.sha256)
    expect(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry.acceptance).toEqual({
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
    })
  })

  it("freezes the exported graph and rejects structural or accessor drift without invoking getters", () => {
    expect(validateBp033Tpd2eusb30drtrDrtProjectFootprint()).toBe(true)
    expect(Object.isFrozen(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry)).toBe(true)
    expect(Object.isFrozen(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry.sources)).toBe(true)
    expect(Object.isFrozen(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry.acceptance)).toBe(true)

    const hiddenKey = structuredClone(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry) as Record<string, unknown>
    Object.defineProperty(hiddenKey, "hidden", { configurable: true, enumerable: false, value: true })
    expect(() => validateBp033Tpd2eusb30drtrDrtProjectFootprint(hiddenKey)).toThrow(RangeError)

    const symbolKey = structuredClone(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry) as Record<string, unknown>
    Object.defineProperty(symbolKey, Symbol("hidden"), { configurable: true, enumerable: true, value: true })
    expect(() => validateBp033Tpd2eusb30drtrDrtProjectFootprint(symbolKey)).toThrow(RangeError)

    const getterKey = structuredClone(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry) as Record<string, unknown>
    Object.defineProperty(getterKey, "artifactKind", {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error("getter invoked")
      }
    })
    expect(() => validateBp033Tpd2eusb30drtrDrtProjectFootprint(getterKey)).toThrow(RangeError)

    const wrongPrototype = structuredClone(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry) as Record<string, unknown>
    Object.setPrototypeOf(wrongPrototype, null)
    expect(() => validateBp033Tpd2eusb30drtrDrtProjectFootprint(wrongPrototype)).toThrow(RangeError)

    const cycle = structuredClone(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry) as Record<string, unknown>
    const cycleSources = cycle.sources as unknown[]
    cycleSources[0] = cycle
    expect(() => validateBp033Tpd2eusb30drtrDrtProjectFootprint(cycle)).toThrow(RangeError)

    const alias = structuredClone(bp033Tpd2eusb30drtrDrtProjectFootprintGeometry) as Record<string, unknown>
    const aliasSources = alias.sources as unknown[]
    aliasSources[1] = aliasSources[0]
    expect(() => validateBp033Tpd2eusb30drtrDrtProjectFootprint(alias)).toThrow(RangeError)
  })
})
