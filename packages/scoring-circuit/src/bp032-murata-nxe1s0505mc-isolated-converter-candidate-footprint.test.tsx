import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import {
  bp032MurataNxe1s0505mcCandidate,
  Bp032MurataNxe1s0505mcCandidate,
  validateBp032MurataNxe1s0505mcCandidate
} from "./bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

const repoRoot = new URL("../../../", import.meta.url)

function hashArtifact(artifactPath: string) {
  return createHash("sha256")
    .update(readFileSync(new URL(artifactPath, repoRoot)))
    .digest("hex")
    .toUpperCase()
}

function freezeClone<T>(value: T): T {
  const seen = new WeakSet<object>()
  const visit = (current: unknown): void => {
    if (current === null || typeof current !== "object" || seen.has(current)) return
    seen.add(current)
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key)
      if (descriptor !== undefined && "value" in descriptor) visit(descriptor.value)
    }
    Object.freeze(current)
  }
  visit(value)
  return value
}

function inflatePdfStreams(bytes: Buffer) {
  let decoded = ""
  let cursor = 0
  while ((cursor = bytes.indexOf(Buffer.from("stream"), cursor)) >= 0) {
    const streamStart =
      bytes[cursor + 6] === 13 && bytes[cursor + 7] === 10
        ? cursor + 8
        : bytes[cursor + 6] === 10
          ? cursor + 7
          : cursor + 6
    const streamEnd = bytes.indexOf(Buffer.from("endstream"), streamStart)
    if (streamEnd < 0) break
    try {
      decoded += inflateSync(bytes.subarray(streamStart, streamEnd)).toString("latin1")
    } catch {
      // Uncompressed or non-content streams do not contribute to marker checks.
    }
    cursor = streamEnd + "endstream".length
  }
  return decoded
}

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isRectSolderPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_solder_paste" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function renderedGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderTestCircuit(<Bp032MurataNxe1s0505mcCandidate />)) {
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
    if (isRectSolderPaste(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (element.type === "pcb_courtyard_rect") {
      geometry.push({ center: element.center, height: element.height, type: element.type, width: element.width })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").toUpperCase()
}

describe("BP-032 Murata NXE1S0505MC isolated-converter candidate", () => {
  it("binds the single canonical reference, exact orderable, source contracts, and denied authority", () => {
    expect(validateBp032MurataNxe1s0505mcCandidate()).toEqual([])
    expect(bp032MurataNxe1s0505mcCandidate).toMatchObject({
      artifactKind: "bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint",
      workUnit: "BP-032",
      sourceContract: "BP-122",
      sourceContracts: ["BP-122", "BP-125"],
      upstreamContracts: { isolation: "BP-122", processorSupport: "BP-125" },
      canonicalReference: "U_ISO_POWER",
      manufacturer: "Murata Power Solutions",
      manufacturerPartNumber: "NXE1S0505MC",
      primaryProductPageUrl: "https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf",
      sourceBinding: {
        manufacturer: "Murata Power Solutions",
        manufacturerPartNumber: "NXE1S0505MC",
        sourceSha256: "53A6DCE053DA52AF149055634FC380E5B9AD1473D575D0B59F0EFF6123913D40",
        canonicalReferenceHandoff: {
          reference: "U_ISO_POWER",
          manufacturerPartNumber: "NXE1S0505MC",
          integrationStatus: "root-integration-handoff"
        },
        isolationContract: { workUnit: "BP-122", identityValue: "NXE1S0505MC" },
        processorSupportContract: { workUnit: "BP-125" }
      },
      exactOrderable: {
        manufacturerPartNumber: "NXE1S0505MC",
        sourcePage: 1,
        status: "manufacturer-specified"
      },
      manufacturerCad: {
        state: "not-acquired",
        authority: "deny",
        retainedArtifactPath: null,
        sha256: null
      },
      artwork: { state: "generated-project-review-only", authority: "deny" },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
  })

  it("hash-binds retained Murata pages and every frozen upstream source", () => {
    const source = bp032MurataNxe1s0505mcCandidate.sources[0]
    const bytes = readFileSync(new URL(source.artifactPath, repoRoot))
    expect(hashArtifact(source.artifactPath)).toBe(source.sha256)
    const pdfContent = `${bytes.toString("latin1")}\n${inflatePdfStreams(bytes)}`
    for (const marker of ["NXE1S0505MC", "KDC_NXE1.A01", "Mechanical Dimensions", "7.62", "12.70", "3000"]) {
      expect(pdfContent).toContain(marker)
    }
    expect(source.reviewedPages).toEqual([1, 2, 6, 7])
    expect(source.pagePurposes).toEqual({
      exactOrderableAndElectrical: 1,
      isolationLimitAndSafetyBoundary: 2,
      mechanicalPackagePinMapAndRecommendedLands: 6,
      tapeOrientationOnly: 7
    })
    for (const binding of bp032MurataNxe1s0505mcCandidate.sourceControl.upstreamSources) {
      expect(hashArtifact(binding.path)).toBe(binding.sha256)
    }
  })

  it("keeps manufacturer facts, applicable land guidance, and project geometry separate", () => {
    expect(bp032MurataNxe1s0505mcCandidate.package).toMatchObject({
      designation: "NXE1 SMD 14-position package",
      bodyNominalMm: { length: 12.7, width: 10.41 },
      bodyMaximumMm: { length: 12.95, width: 10.66 },
      heightMaximumMm: 4.8,
      pinCount: 14,
      pinPitchMm: 2.54,
      sourcePage: 6,
      sourceStatus: "manufacturer-specified"
    })
    expect(bp032MurataNxe1s0505mcCandidate.isolationBoundary.manufacturerFacts).toMatchObject({
      isolationTestVoltageVdc: 3000,
      isolationTestDurationSeconds: 1,
      isolationResistanceMinimumGOhm: 10,
      sourcePages: [1, 2]
    })
    expect(bp032MurataNxe1s0505mcCandidate.manufacturerLandPattern).toMatchObject({
      sourcePage: 6,
      padLengthMm: 2.3,
      padWidthMm: 1,
      outerColumnCenterSpanMm: 7.62,
      rowCenterSpanMm: 9.4,
      sourceScope: "manufacturer-recommended-guidance-not-CAD"
    })
    expect(bp032MurataNxe1s0505mcCandidate.projectSelection).toMatchObject({
      authority: "project-review-input-not-manufacturer-CAD",
      copper: { padLengthMm: 2.3, padWidthMm: 1 },
      solderMask: { openingLengthMm: 2.4, openingWidthMm: 1.1 },
      paste: { openingLengthMm: 2.2, openingWidthMm: 0.9 },
      courtyard: { lengthMm: 13.45, widthMm: 12.2 }
    })
    expect(bp032MurataNxe1s0505mcCandidate.terminals).toEqual([
      { pad: "1", function: "-Vin", role: "input-negative", xMm: -3.81, yMm: -4.7 },
      { pad: "3", function: "+Vin", role: "input-positive", xMm: -1.27, yMm: -4.7 },
      { pad: "7", function: "-Vout", role: "output-negative", xMm: 3.81, yMm: -4.7 },
      { pad: "8", function: "+Vout", role: "output-positive", xMm: 3.81, yMm: 4.7 },
      { pad: "14", function: "NA", role: "no-connect", xMm: -3.81, yMm: 4.7 }
    ])
    expect(bp032MurataNxe1s0505mcCandidate.orientation).toMatchObject({
      manufacturerPinOne: "pin 1 is the lower-left land in the page-6 drawing with +Y-up",
      manufacturerPinFourteen: "pin 14 is the upper-left land in the page-6 drawing with +Y-up",
      projectConvention: "top-view +Y-up pin-one lower-left",
      reviewTransform: "no transform; page-6 top view is retained in the chosen +Y-up coordinate system",
      state: "pending-independent-layout-review",
      accepted: false
    })
  })

  it("asserts the chosen +Y-up orientation: pin 1 is lower-left and pin 14 is upper-left", () => {
    expect(bp032MurataNxe1s0505mcCandidate.terminals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pad: "1", xMm: -3.81, yMm: -4.7 }),
        expect.objectContaining({ pad: "14", xMm: -3.81, yMm: 4.7 })
      ])
    )
    expect(bp032MurataNxe1s0505mcCandidate.projectArtwork.orientation).toBe(
      "project top-view +Y-up pin-one lower-left and pin-14 upper-left; assembly rotation pending"
    )
  })

  it("renders exactly five project pads, paste apertures, ports, and courtyard", () => {
    const json = renderTestCircuit(<Bp032MurataNxe1s0505mcCandidate />)
    const pads = json.filter(isRectSmtPad)
    const paste = json.filter(isRectSolderPaste)
    const courtyard = json.filter((element) => element.type === "pcb_courtyard_rect")
    expect(json.filter((element) => element.type === "source_port")).toHaveLength(5)
    expect(pads).toHaveLength(5)
    expect(paste).toHaveLength(5)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -3.81, y: -4.7, width: 1, height: 2.3, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: -1.27, y: -4.7, width: 1, height: 2.3, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 3.81, y: -4.7, width: 1, height: 2.3, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: -3.81, y: 4.7, width: 1, height: 2.3, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 3.81, y: 4.7, width: 1, height: 2.3, soldermask_margin: 0.05 })
      ])
    )
    expect(paste).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -3.81, y: -4.7, width: 0.9 }),
        expect.objectContaining({ x: -1.27, y: -4.7, width: 0.9 }),
        expect.objectContaining({ x: 3.81, y: -4.7, width: 0.9 }),
        expect.objectContaining({ x: -3.81, y: 4.7, width: 0.9 }),
        expect.objectContaining({ x: 3.81, y: 4.7, width: 0.9 })
      ])
    )
    for (const pasteArtifact of paste) {
      if (!("height" in pasteArtifact)) throw new Error("Expected rectangular solder-paste artifacts")
      expect(pasteArtifact.height).toBeCloseTo(2.2, 10)
    }
    expect(courtyard).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 13.45, height: 12.2 })])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("binds the rendered project-artwork hash and keeps every requested gate denied", () => {
    expect(renderedGeometryHash()).toBe(bp032MurataNxe1s0505mcCandidate.artwork.sha256)
    expect(bp032MurataNxe1s0505mcCandidate.gates).toEqual({
      cad: "deny",
      placement: "deny",
      physicalIsolation: "deny",
      thermal: "deny",
      schematic: "deny",
      fabrication: "deny",
      release: "deny"
    })
    expect(bp032MurataNxe1s0505mcCandidate.acceptance).toMatchObject({
      exactOrderableReviewed: true,
      packageAndPinMapReviewed: true,
      projectArtworkAccepted: false,
      orientationAccepted: false,
      placementAccepted: false,
      physicalIsolationAccepted: false,
      thermalAccepted: false,
      schematicAccepted: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
  })

  it("fails closed on identity, canonical binding, geometry, and gate drift", () => {
    const identityDrift = structuredClone(bp032MurataNxe1s0505mcCandidate)
    Reflect.set(identityDrift, "manufacturerPartNumber", "NXE1S0505MC-ALIAS")
    freezeClone(identityDrift)
    expect(validateBp032MurataNxe1s0505mcCandidate(identityDrift)).toContain(
      "BP-032 exact U_ISO_POWER NXE1S0505MC identity drifted"
    )

    const sourceDrift = structuredClone(bp032MurataNxe1s0505mcCandidate)
    Reflect.set(sourceDrift.sourceBinding, "canonicalReference", "U_ISO_POWER_2")
    freezeClone(sourceDrift)
    expect(validateBp032MurataNxe1s0505mcCandidate(sourceDrift)).toContain(
      "BP-032 canonical U_ISO_POWER source-contract binding drifted"
    )

    const geometryDrift = structuredClone(bp032MurataNxe1s0505mcCandidate)
    Reflect.set(geometryDrift.projectSelection.courtyard, "lengthMm", 13.44)
    freezeClone(geometryDrift)
    expect(validateBp032MurataNxe1s0505mcCandidate(geometryDrift)).toContain(
      "Murata guidance and project geometry must remain separately bounded"
    )

    const gateDrift = structuredClone(bp032MurataNxe1s0505mcCandidate)
    Reflect.set(gateDrift.gates, "release", "allow")
    freezeClone(gateDrift)
    expect(validateBp032MurataNxe1s0505mcCandidate(gateDrift)).toContain(
      "BP-032 CAD, placement, isolation, thermal, schematic, fabrication, and release gates must remain denied"
    )
  })

  it("keeps an independent frozen baseline and rejects hidden, accessor, cycle, symbol, and alias attacks", () => {
    expect(Object.isFrozen(bp032MurataNxe1s0505mcCandidate)).toBe(true)
    expect(Object.isFrozen(bp032MurataNxe1s0505mcCandidate.sources)).toBe(true)
    expect(Reflect.set(bp032MurataNxe1s0505mcCandidate, "accepted", true)).toBe(false)
    expect(validateBp032MurataNxe1s0505mcCandidate()).toEqual([])

    const hiddenProperty = structuredClone(bp032MurataNxe1s0505mcCandidate)
    Object.defineProperty(hiddenProperty, "hiddenApproval", { value: true, enumerable: false })
    expect(validateBp032MurataNxe1s0505mcCandidate(hiddenProperty)).toEqual([
      "Murata NXE1 exact graph, descriptor, or deny-state drifted"
    ])

    const symbolProperty = structuredClone(bp032MurataNxe1s0505mcCandidate)
    Reflect.set(symbolProperty, Symbol("approval"), true)
    expect(validateBp032MurataNxe1s0505mcCandidate(symbolProperty)).toEqual([
      "Murata NXE1 exact graph, descriptor, or deny-state drifted"
    ])

    const getterProperty = structuredClone(bp032MurataNxe1s0505mcCandidate)
    Object.defineProperty(getterProperty, "releaseState", { enumerable: true, get: () => "allow" })
    expect(validateBp032MurataNxe1s0505mcCandidate(getterProperty)).toEqual([
      "Murata NXE1 exact graph, descriptor, or deny-state drifted"
    ])

    const aliasProperty = structuredClone(bp032MurataNxe1s0505mcCandidate)
    Reflect.set(aliasProperty.projectArtwork, "pads", aliasProperty.terminals)
    freezeClone(aliasProperty)
    expect(validateBp032MurataNxe1s0505mcCandidate(aliasProperty)).toEqual([
      "Murata NXE1 exact graph, descriptor, or deny-state drifted"
    ])

    const sparseProperty = structuredClone(bp032MurataNxe1s0505mcCandidate)
    Reflect.deleteProperty(sparseProperty.terminals, 4)
    freezeClone(sparseProperty)
    expect(validateBp032MurataNxe1s0505mcCandidate(sparseProperty)).toEqual([
      "Murata NXE1 exact graph, descriptor, or deny-state drifted"
    ])

    const nullPrototypeProperty = structuredClone(bp032MurataNxe1s0505mcCandidate)
    Object.setPrototypeOf(nullPrototypeProperty.sourceBinding, null)
    freezeClone(nullPrototypeProperty)
    expect(validateBp032MurataNxe1s0505mcCandidate(nullPrototypeProperty)).toEqual([
      "Murata NXE1 exact graph, descriptor, or deny-state drifted"
    ])

    const descriptorFlagsProperty = structuredClone(bp032MurataNxe1s0505mcCandidate)
    Object.defineProperty(descriptorFlagsProperty.sourceBinding, "canonicalReference", {
      configurable: false,
      enumerable: true,
      value: "U_ISO_POWER",
      writable: true
    })
    expect(validateBp032MurataNxe1s0505mcCandidate(descriptorFlagsProperty)).toEqual([
      "Murata NXE1 exact graph, descriptor, or deny-state drifted"
    ])

    const throwingProxy = new Proxy(structuredClone(bp032MurataNxe1s0505mcCandidate), {
      getPrototypeOf: () => {
        throw new Error("proxy trap")
      }
    })
    expect(validateBp032MurataNxe1s0505mcCandidate(throwingProxy)).toEqual([
      "Murata NXE1 exact graph, descriptor, or deny-state drifted"
    ])

    const cyclicCandidate: { self?: unknown } = {}
    cyclicCandidate.self = cyclicCandidate
    expect(validateBp032MurataNxe1s0505mcCandidate(cyclicCandidate)).toEqual([
      "Murata NXE1 exact graph, descriptor, or deny-state drifted"
    ])
    expect(validateBp032MurataNxe1s0505mcCandidate({})).toEqual([
      "Murata NXE1 exact graph, descriptor, or deny-state drifted"
    ])
  })
})
