import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp033Tps25947ProjectFootprint,
  bp033Tps25947ProjectFootprintGeometry,
  validateBp033Tps25947ProjectFootprintGeometry
} from "./bp033-tps25947-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function renderProjectFootprint() {
  return renderTestCircuit(<Bp033Tps25947ProjectFootprint />)
}

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isRectPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_solder_paste" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function retainedEvidenceHash(artifactPath: string) {
  return createHash("sha256")
    .update(readFileSync(new URL(`../${artifactPath}`, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function renderedGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderProjectFootprint()) {
    if (isRectSmtPad(element)) {
      geometry.push({
        height: element.height,
        port_hints: element.port_hints ?? [],
        shape: element.shape,
        soldermask_margin: element.soldermask_margin,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (isRectPaste(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex")
}

describe("BP-033 exact TPS259474ARPWR RPW0010A project footprint", () => {
  it("binds both canonical references, exact orderable/device/package, source PDF, and hash", () => {
    expect(validateBp033Tps25947ProjectFootprintGeometry()).toEqual([])
    expect(bp033Tps25947ProjectFootprintGeometry).toMatchObject({
      artifactKind: "bp033-tps25947-project-footprint",
      workUnit: "BP-033",
      manufacturer: "Texas Instruments",
      orderablePartNumber: "TPS259474ARPWR",
      devicePartNumber: "TPS259474A",
      sourceBinding: {
        canonicalReferences: ["U_VBUS_EFUSE", "U_DISPLAY_LIMITER"],
        exactPackage: "VQFN-HR (RPW), 10-pin",
        canonicalActiveReferenceReconciliation: [
          {
            canonicalLedgerReference: "U_VBUS_EFUSE",
            activeCircuitReference: "U_EFUSE",
            activeBomReference: "U_EFUSE",
            activeRole: "normal USB-C PD post-contract reverse-blocking eFuse",
            reconciliation: "explicit-ledger-alias-to-one-active-U_EFUSE-instance"
          },
          {
            canonicalLedgerReference: "U_DISPLAY_LIMITER",
            activeCircuitReference: "U_EFUSE",
            activeBomReference: "U_EFUSE",
            activeRole: "display branch limiter role in the active power contract",
            reconciliation: "explicit-logical-role-alias-to-one-active-U_EFUSE-instance; no-second-circuit-instance"
          }
        ]
      },
      package: {
        packageDrawing: "RPW0010A",
        nominalSizeMm: { width: 2, height: 2 },
        packagePitchMm: 0.45,
        pins: 10,
        exposedPad: { state: "none" }
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, authority: "deny" },
      authority: {
        layoutAccepted: false,
        currentCapacityAccepted: false,
        thermalPerformanceAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    const source = bp033Tps25947ProjectFootprintGeometry.sources[0]
    if (source === undefined) {
      throw new Error("retained TPS25947 source fixture is missing")
    }
    expect(source).toMatchObject({
      authority: "manufacturer-primary",
      documentNumber: "SLVSFC9C",
      revision: "C",
      reviewedPages: "1-6, 62-65, 67-71",
      artifactPath: "docs/evidence/bp-033/ti-tps25947-datasheet.pdf",
      sha256: "051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC"
    })
    expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sha256)
    expect(source.authority).toBe("manufacturer-primary")
    expect(source.url).toBe("https://www.ti.com/lit/ds/symlink/tps25947.pdf")
    expect(readFileSync(new URL(`../${source.artifactPath}`, import.meta.url)).byteLength).toBe(source.retainedBytes)
    const packageDrawing = bp033Tps25947ProjectFootprintGeometry.sources[1]
    expect(packageDrawing).toMatchObject({
      id: "ti-rpw0010a-4225183a-package-drawing",
      documentNumber: "RPW0010A",
      revision: "4225183/A",
      publicationDate: "August 2019",
      reviewedPages: "72-74",
      artifactPath: source.artifactPath,
      sha256: source.sha256
    })
    if (packageDrawing === undefined) {
      throw new Error("RPW0010A package drawing source fixture is missing")
    }
    expect(retainedEvidenceHash(packageDrawing.artifactPath)).toBe(packageDrawing.sha256)
    expect(packageDrawing.authority).toBe("manufacturer-primary")
    expect(packageDrawing.url).toBe("https://www.ti.com/lit/ds/symlink/tps25947.pdf")
    expect(readFileSync(new URL(`../${packageDrawing.artifactPath}`, import.meta.url)).byteLength).toBe(
      packageDrawing.retainedBytes
    )
  })

  it("retains all ten TI pins, the two numbered HotRod power lands, and top-view orientation", () => {
    expect(bp033Tps25947ProjectFootprintGeometry.package.packagePitchMm).toBe(0.45)
    expect(bp033Tps25947ProjectFootprintGeometry.package).not.toHaveProperty("pitchMm")
    expect(bp033Tps25947ProjectFootprintGeometry.projectFootprint.landRowCoordinateSpacingMm).toBe(0.5)
    expect(bp033Tps25947ProjectFootprintGeometry.pinMap).toEqual([
      { pin: 1, role: "EN/UVLO" },
      { pin: 2, role: "OVLO" },
      { pin: 3, role: "PG" },
      { pin: 4, role: "PGTH" },
      { pin: 5, role: "IN" },
      { pin: 6, role: "OUT" },
      { pin: 7, role: "DVDT" },
      { pin: 8, role: "GND" },
      { pin: 9, role: "ILM" },
      { pin: 10, role: "ITIMER" }
    ])
    expect(bp033Tps25947ProjectFootprintGeometry.package.exposedPad).toMatchObject({ state: "none" })
    expect(bp033Tps25947ProjectFootprintGeometry.orientation).toMatchObject({
      sourceIds: ["ti-tps25947-slvsfc9c-datasheet", "ti-rpw0010a-4225183a-package-drawing"],
      view: "top",
      boardRotationDegrees: 0,
      pinOneDatum: "upper-left package pin-1 identification in TI top view",
      sourceCaptured: true,
      independentBoardOrientationAccepted: false
    })
    expect(bp033Tps25947ProjectFootprintGeometry.manufacturerLandPattern.copper.pads).toHaveLength(10)
    expect(bp033Tps25947ProjectFootprintGeometry.manufacturerLandPattern.copper.pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin: 1, role: "EN/UVLO", xMm: -0.9, yMm: 0.75, widthMm: 0.6, heightMm: 0.25 }),
        expect.objectContaining({ pin: 5, role: "IN", xMm: -0.275, yMm: -0.325, widthMm: 0.3, heightMm: 1.75 }),
        expect.objectContaining({ pin: 6, role: "OUT", xMm: 0.275, yMm: -0.325, widthMm: 0.3, heightMm: 1.75 }),
        expect.objectContaining({ pin: 10, role: "ITIMER", xMm: 0.9, yMm: 0.75, widthMm: 0.6, heightMm: 0.25 })
      ])
    )
  })

  it("captures TI page-73 mask guidance and page-74 explicit stencil coverage without releasing it", () => {
    const { manufacturerLandPattern, projectFootprint } = bp033Tps25947ProjectFootprintGeometry
    expect(manufacturerLandPattern.solderMask).toMatchObject({
      definition: "non-solder-mask-defined-preferred",
      nsmdMarginMaximumMm: 0.05,
      smdMarginMinimumMm: 0.05,
      sourcePages: [73]
    })
    expect(manufacturerLandPattern.copper.representation).toBe("rectangular-review-approximation")
    expect(manufacturerLandPattern.paste).toMatchObject({
      stencilThicknessMm: 0.1,
      representation: "symmetric-rectangular-review-approximation",
      sourcePages: [74],
      explicitCoverage: [
        { padIds: [1, 4, 7, 10], printedAreaPercent: 93 },
        { padIds: [5, 6], printedAreaPercent: 82 }
      ],
      unquantifiedPadIds: [2, 3, 8, 9]
    })
    expect(projectFootprint).toMatchObject({
      padShape: "rectangular-smt-review-approximation",
      solderMask: { marginPerEdgeMm: 0.05, status: "review-input-only" },
      paste: {
        stencilThicknessMm: 0.1,
        representation: "symmetric-rectangular-review-approximation",
        status: "review-input-only"
      },
      courtyard: { state: "not-published", status: "denied" },
      layoutAuthority: "deny",
      currentCapacityAuthority: "deny",
      thermalAuthority: "deny",
      boardFitAuthority: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
  })

  it("renders ten source-port pads, ten paste apertures, no courtyard, and no tscircuit errors", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    const paste = json.filter(isRectPaste)
    expect(pads).toHaveLength(10)
    expect(paste).toHaveLength(10)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -0.9, y: 0.75, width: 0.6, height: 0.25, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: -0.275, y: -0.325, width: 0.3, height: 1.75, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 0.275, y: -0.325, width: 0.3, height: 1.75, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 0.9, y: 0.75, width: 0.6, height: 0.25, soldermask_margin: 0.05 })
      ])
    )
    expect(pads.flatMap((pad) => pad.port_hints ?? [])).toEqual(
      expect.arrayContaining(["1", "IN", "pin5", "OUT", "pin6"])
    )
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual([])
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("binds rendered geometry hash and fails closed on identity, pin, source, or authority drift", () => {
    expect(renderedGeometryHash()).toBe(bp033Tps25947ProjectFootprintGeometry.artwork.renderedGeometrySha256)
    expect(bp033Tps25947ProjectFootprintGeometry.artwork.authority).toBe("deny")

    const identityDrift = structuredClone(bp033Tps25947ProjectFootprintGeometry) as {
      orderablePartNumber: string
    }
    identityDrift.orderablePartNumber = "TPS259474LRPWR"
    expect(validateBp033Tps25947ProjectFootprintGeometry(identityDrift as never)).toEqual(
      expect.arrayContaining([expect.stringContaining("identity")])
    )

    const pinDrift = structuredClone(bp033Tps25947ProjectFootprintGeometry) as {
      pinMap: Array<{ pin: number; role: string }>
    }
    pinDrift.pinMap[4]!.role = "OUT"
    expect(validateBp033Tps25947ProjectFootprintGeometry(pinDrift as never)).toEqual(
      expect.arrayContaining([expect.stringContaining("pin map")])
    )

    const sourceDrift = structuredClone(bp033Tps25947ProjectFootprintGeometry) as unknown as {
      sources: Array<{ sha256: string }>
    }
    sourceDrift.sources[0]!.sha256 = "0".repeat(64)
    expect(validateBp033Tps25947ProjectFootprintGeometry(sourceDrift as never)).toEqual(
      expect.arrayContaining([expect.stringContaining("source")])
    )

    const authorityDrift = structuredClone(bp033Tps25947ProjectFootprintGeometry) as {
      authority: { releaseState: string }
    }
    authorityDrift.authority.releaseState = "allow"
    expect(validateBp033Tps25947ProjectFootprintGeometry(authorityDrift as never)).toEqual(
      expect.arrayContaining([expect.stringContaining("gates")])
    )

    const rejectDrift = (mutate: (copy: typeof bp033Tps25947ProjectFootprintGeometry) => void, message: string) => {
      const copy = structuredClone(bp033Tps25947ProjectFootprintGeometry)
      mutate(copy)
      expect(validateBp033Tps25947ProjectFootprintGeometry(copy as never)).toEqual(
        expect.arrayContaining([expect.stringContaining(message)])
      )
    }

    rejectDrift((copy) => Reflect.set(copy, "artifactKind", "forged-artifact"), "artifact kind")
    rejectDrift(
      (copy) => Reflect.set(copy.sourceBinding.referenceRoles, "U_VBUS_EFUSE", "forged role"),
      "reference roles"
    )
    rejectDrift(
      (copy) => Reflect.set(copy.manufacturerCad, "note", "forged CAD note"),
      "manufacturer CAD evidence note"
    )
    rejectDrift(
      (copy) =>
        Reflect.set(copy.sourceBinding.canonicalActiveReferenceBasis, "activeBomReference", "U_DISPLAY_LIMITER"),
      "canonical ledger basis"
    )
    rejectDrift(
      (copy) => Reflect.set(copy.sources[0], "url", "https://example.invalid/tps25947.pdf"),
      "official TI source URL"
    )
    rejectDrift((copy) => Reflect.set(copy.package.bodyMaximumMm, "width", 2.2), "complete RPW package")
    rejectDrift((copy) => Reflect.set(copy.manufacturerLandPattern.copper.pads[4], "widthMm", 0.31), "published copper")
    rejectDrift((copy) => Reflect.set(copy.manufacturerLandPattern.paste.unquantifiedPadIds, 0, 1), "published copper")
    rejectDrift((copy) => Reflect.set(copy.manufacturerLandPattern.courtyard, "authority", "allow"), "published copper")
    rejectDrift((copy) => Reflect.set(copy.orientation, "numbering", "pins reversed"), "complete RPW orientation")
    rejectDrift((copy) => Reflect.set(copy.projectFootprint.pads[0], "xMm", -0.8), "complete RPW project")
    rejectDrift((copy) => Reflect.set(copy.projectFootprint.solderMask, "status", "accepted"), "complete RPW project")
    rejectDrift((copy) => Reflect.set(copy.authority, "publishedPasteCaptured", false), "captured-source authority")
    rejectDrift(
      (copy) => Reflect.set(copy.artwork, "renderedGeometrySha256", "0".repeat(64)),
      "exact persisted artwork"
    )
  })

  it("deep-freezes source, package, geometry, artwork, and authority evidence", () => {
    const source = bp033Tps25947ProjectFootprintGeometry.sources[0]
    const packageDimensions = bp033Tps25947ProjectFootprintGeometry.package.nominalSizeMm
    const pad = bp033Tps25947ProjectFootprintGeometry.projectFootprint.pads[0]
    if (source === undefined || pad === undefined) throw new Error("TPS25947 nested evidence fixture is missing")

    expect(Object.isFrozen(bp033Tps25947ProjectFootprintGeometry)).toBe(true)
    expect(Object.isFrozen(source)).toBe(true)
    expect(Object.isFrozen(packageDimensions)).toBe(true)
    expect(Object.isFrozen(pad)).toBe(true)
    expect(Object.isFrozen(bp033Tps25947ProjectFootprintGeometry.artwork)).toBe(true)
    expect(Object.isFrozen(bp033Tps25947ProjectFootprintGeometry.authority)).toBe(true)

    expect(() => Object.defineProperty(source, "sha256", { value: "0".repeat(64) })).toThrow(TypeError)
    expect(() => Object.defineProperty(packageDimensions, "width", { value: 3 })).toThrow(TypeError)
    expect(() => Object.defineProperty(pad, "widthMm", { value: 0.31 })).toThrow(TypeError)
    expect(() =>
      Object.defineProperty(bp033Tps25947ProjectFootprintGeometry.artwork, "authority", { value: "allow" })
    ).toThrow(TypeError)
    expect(() =>
      Object.defineProperty(bp033Tps25947ProjectFootprintGeometry.authority, "releaseState", { value: "allow" })
    ).toThrow(TypeError)
  })

  it("rejects non-canonical graphs without invoking accessors", () => {
    const reject = (candidate: unknown) => {
      expect(validateBp033Tps25947ProjectFootprintGeometry(candidate)).not.toEqual([])
    }

    reject(null)
    reject({})
    expect(
      validateBp033Tps25947ProjectFootprintGeometry({
        ...bp033Tps25947ProjectFootprintGeometry,
        sources: undefined
      })
    ).toEqual(expect.arrayContaining([expect.stringContaining("structurally incomplete")]))
    expect(
      validateBp033Tps25947ProjectFootprintGeometry({
        ...bp033Tps25947ProjectFootprintGeometry,
        sourceBinding: undefined
      })
    ).toEqual(expect.arrayContaining([expect.stringContaining("structurally incomplete")]))

    const hidden = structuredClone(bp033Tps25947ProjectFootprintGeometry) as Record<string, unknown>
    Object.defineProperty(hidden, "hidden", { value: true, enumerable: false })
    reject(hidden)

    const symbolKey = Symbol("forged")
    const symbol = structuredClone(bp033Tps25947ProjectFootprintGeometry) as Record<PropertyKey, unknown>
    Object.defineProperty(symbol, symbolKey, { value: true, enumerable: true })
    reject(symbol)

    let getterInvoked = false
    const accessor = structuredClone(bp033Tps25947ProjectFootprintGeometry) as unknown as {
      sources: Array<Record<string, unknown>>
    }
    const accessorSource = accessor.sources[0]
    if (accessorSource === undefined) throw new Error("TPS25947 source fixture is missing")
    Object.defineProperty(accessorSource, "sha256", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterInvoked = true
        return "0".repeat(64)
      }
    })
    reject(accessor)
    expect(getterInvoked).toBe(false)

    const prototype = Object.create({ forged: true }) as Record<string, unknown>
    Object.assign(prototype, structuredClone(bp033Tps25947ProjectFootprintGeometry))
    reject(prototype)

    const cycle = structuredClone(bp033Tps25947ProjectFootprintGeometry) as Record<string, unknown>
    cycle.cycle = cycle
    reject(cycle)

    const alias = structuredClone(bp033Tps25947ProjectFootprintGeometry) as {
      sourceBinding: { canonicalActiveReferenceBasis: unknown; canonicalActiveReferenceReconciliation: unknown }
    }
    alias.sourceBinding.canonicalActiveReferenceBasis = alias.sourceBinding.canonicalActiveReferenceReconciliation
    reject(alias)

    const descriptor = structuredClone(bp033Tps25947ProjectFootprintGeometry) as {
      artwork: Record<string, unknown>
    }
    Object.defineProperty(descriptor.artwork, "authority", {
      configurable: true,
      enumerable: true,
      value: "deny",
      writable: false
    })
    reject(descriptor)
  })
})
