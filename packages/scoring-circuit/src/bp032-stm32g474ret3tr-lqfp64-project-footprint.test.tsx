import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence,
  Bp032Stm32G474Ret3TrLqfp64ProjectFootprint,
  validateBp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence
} from "./bp032-stm32g474ret3tr-lqfp64-project-footprint.js"
import { stm32PinAllocation } from "./stm32-pin-allocation.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
type RectSmtPad = Extract<CircuitElement, { readonly type: "pcb_smtpad" }> & {
  readonly shape: "rect"
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly soldermask_margin: number
  readonly port_hints: readonly string[]
}
type RectPaste = Extract<CircuitElement, { readonly type: "pcb_solder_paste" }> & {
  readonly shape: "rect"
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

function isRectSmtPad(element: CircuitElement): element is RectSmtPad {
  return (
    element.type === "pcb_smtpad" &&
    element.shape === "rect" &&
    typeof element.x === "number" &&
    typeof element.y === "number" &&
    typeof element.width === "number" &&
    typeof element.height === "number" &&
    typeof element.soldermask_margin === "number" &&
    Array.isArray(element.port_hints) &&
    typeof element.port_hints[0] === "string"
  )
}

function isRectPaste(element: CircuitElement): element is RectPaste {
  return (
    element.type === "pcb_solder_paste" &&
    element.shape === "rect" &&
    typeof element.x === "number" &&
    typeof element.y === "number" &&
    typeof element.width === "number" &&
    typeof element.height === "number"
  )
}

function rendered() {
  return renderTestCircuit(<Bp032Stm32G474Ret3TrLqfp64ProjectFootprint />)
}

function fileHash(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(new URL(relativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function retainedSourceHash() {
  return fileHash("../docs/evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf")
}

function cloneCandidate(): Record<string, unknown> {
  return structuredClone(bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence) as unknown as Record<string, unknown>
}

function freezeCandidateGraph(candidate: Record<string, unknown>): Record<string, unknown> {
  const seen = new WeakSet<object>()
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== "object" || seen.has(value)) return
    seen.add(value)
    let keys: readonly PropertyKey[]
    try {
      keys = Reflect.ownKeys(value)
    } catch {
      return
    }
    for (const key of keys) {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)
        if (descriptor !== undefined && "value" in descriptor) visit(descriptor.value)
      } catch {
        continue
      }
    }
    try {
      Object.freeze(value)
    } catch {
      return
    }
  }
  visit(candidate)
  return candidate
}

function validateMutation(candidate: Record<string, unknown>): readonly string[] {
  return validateBp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence(freezeCandidateGraph(candidate))
}

describe("BP-032 exact STM32G474RET3TR LQFP64 project footprint", () => {
  it("binds U_SCORING, the exact orderable, retained primary bytes, package, and denied CAD provenance", () => {
    expect(validateBp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence()).toEqual([])
    expect(retainedSourceHash()).toBe(bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence.source.sha256)
    expect(bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence).toMatchObject({
      artifactKind: "bp032-stm32g474ret3tr-lqfp64-project-footprint-evidence",
      workUnit: "BP-032",
      canonicalReference: "U_SCORING",
      source: {
        manufacturer: "STMicroelectronics",
        manufacturerPartNumber: "STM32G474RET3TR",
        documentNumber: "DS12288",
        revision: "6",
        retainedPdfPageCount: 236,
        packageIdentityEvidence: {
          printedPages: [1, 2, 3, 232],
          table: "Table 124 ordering information scheme"
        },
        packageDrawingEvidence: {
          printedPages: [210, 211, 212],
          recommendedFootprintFigure: "Figure 63 LQFP64 - Recommended footprint",
          pinOneFigure: "Figure 64 LQFP64 top view example"
        },
        cad: {
          state: "not-acquired",
          authority: "deny",
          retainedArtifactPath: null,
          retainedArtifactSha256: null
        }
      },
      package: {
        package: "LQFP64",
        pinCount: 64,
        exposedPad: { present: false, padNumber: null }
      },
      manufacturerCad: { authority: "deny" },
      fabricationAuthority: "deny",
      accepted: false,
      authority: {
        manufacturerCadImported: false,
        orientationAccepted: false,
        placementAccepted: false,
        schematicIntegrationAuthorized: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
  })

  it("retains exact BP-120 allocation data and its canonical source hash without importing it into the candidate", () => {
    expect(bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence.bp120Allocation).toEqual(stm32PinAllocation)
    expect(bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence.sourceControl).toEqual({
      canonicalReference: "U_SCORING",
      upstreamWorkUnits: ["BP-120", "BP-125"],
      bindings: [
        {
          workUnit: "BP-120",
          path: "packages/scoring-circuit/src/stm32-pin-allocation.ts",
          sha256: fileHash("./stm32-pin-allocation.ts")
        },
        {
          workUnit: "BP-125",
          path: "packages/scoring-circuit/src/bench-prototype-bp125-processor-footprint-reconciliation.ts",
          sha256: fileHash("./bench-prototype-bp125-processor-footprint-reconciliation.ts")
        }
      ],
      retainedEvidenceIsReused: true,
      noDuplicateEvidenceUnderBp032: true
    })
    expect(stm32PinAllocation.authority.releaseState).toBe("deny")
    expect(stm32PinAllocation.packageMap).toHaveLength(64)
  })

  it("keeps manufacturer geometry separate from project-derived geometry and records nonpolar orientation", () => {
    const evidence = bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence
    expect(evidence.package).toMatchObject({
      body: {
        nominalLengthMm: 10,
        nominalWidthMm: 10,
        heightMm: { minimum: 1.35, nominal: 1.4, maximum: 1.45 }
      },
      leadPitchMm: 0.5,
      recommendedCopper: {
        tangentialWidthMm: 0.3,
        radialLengthMm: 1.2,
        innerPadEdgeSpanMm: 10.3,
        outerPadEdgeSpanMm: 12.7,
        tangentialOuterEdgeSpanMm: 7.8
      }
    })
    expect(evidence.projectGeometry).toMatchObject({
      copper: { padWidthMm: 0.3, padLengthMm: 1.2, radialPadCenterMm: 5.75 },
      solderMask: { marginPerEdgeMm: 0.05, openingTangentialMm: 0.4, openingRadialMm: 1.3 },
      paste: { reductionPerEdgeMm: 0.05, openingTangentialMm: 0.2, openingRadialMm: 1.1 },
      courtyard: { clearanceMm: 0.25, widthMm: 13.2, heightMm: 13.2 }
    })
    expect(evidence.orientation).toMatchObject({
      sourceFigure: "Figure 64 LQFP64 top view example",
      pinOne: { pin: 1, xMm: -3.75, yMm: -5.75 },
      boardRotationDegrees: 0,
      status: "pending-independent-review",
      independentAcceptance: false
    })
    expect(evidence.pads).toHaveLength(64)
    expect(evidence.pads.map((pad) => pad.pin)).toEqual(Array.from({ length: 64 }, (_, index) => index + 1))
    expect(evidence.pads.filter((pad) => pad.side === "bottom")).toHaveLength(16)
    expect(evidence.pads.filter((pad) => pad.side === "right")).toHaveLength(16)
    expect(evidence.pads.filter((pad) => pad.side === "top")).toHaveLength(16)
    expect(evidence.pads.filter((pad) => pad.side === "left")).toHaveLength(16)
  })

  it("renders 64 copper pads, 64 paste apertures, courtyard, and pin-one marker", () => {
    const json = rendered()
    const pads = json
      .filter(isRectSmtPad)
      .toSorted((left, right) => Number(left.port_hints[0]) - Number(right.port_hints[0]))
    const paste = json.filter(isRectPaste)
    const courtyard = json.find((element) => element.type === "pcb_courtyard_rect")
    const marker = json.find((element) => element.type === "pcb_silkscreen_circle")
    expect(pads).toHaveLength(64)
    expect(paste).toHaveLength(64)
    expect(courtyard).toMatchObject({ center: { x: 0, y: 0 }, width: 13.2, height: 13.2 })
    expect(marker).toMatchObject({ center: { x: -5.35, y: -5.35 }, radius: 0.25 })

    for (const pad of pads) {
      const radial = pad.width < pad.height
      expect(pad.width).toBeCloseTo(radial ? 0.3 : 1.2, 10)
      expect(pad.height).toBeCloseTo(radial ? 1.2 : 0.3, 10)
      expect(pad.soldermask_margin).toBeCloseTo(0.05, 10)
      expect(pad.width + 2 * pad.soldermask_margin).toBeCloseTo(radial ? 0.4 : 1.3, 10)
      expect(pad.height + 2 * pad.soldermask_margin).toBeCloseTo(radial ? 1.3 : 0.4, 10)
    }
    const pasteByLocation = new Map(paste.map((aperture) => [`${aperture.x},${aperture.y}`, aperture]))
    for (const pad of pads) {
      const aperture = pasteByLocation.get(`${pad.x},${pad.y}`)
      expect(aperture).toBeDefined()
      if (aperture === undefined) continue
      expect(aperture.width).toBeCloseTo(pad.width - 0.1, 10)
      expect(aperture.height).toBeCloseTo(pad.height - 0.1, 10)
    }
  })

  it("freezes the candidate and rejects adversarial mutation graphs fail-closed", () => {
    const evidence = bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence
    expect(Object.isFrozen(evidence)).toBe(true)
    expect(Object.isFrozen(evidence.source)).toBe(true)
    expect(Object.isFrozen(evidence.bp120Allocation)).toBe(true)
    expect(Object.isFrozen(evidence.bp120Allocation.pads)).toBe(true)

    const mpnDrift = cloneCandidate()
    ;(mpnDrift.source as Record<string, unknown>).manufacturerPartNumber = "STM32G474RET3TR_ALIAS"
    expect(validateMutation(mpnDrift)).not.toEqual([])

    const sourceHashDrift = cloneCandidate()
    ;(sourceHashDrift.source as Record<string, unknown>).sha256 = "0".repeat(64)
    expect(validateMutation(sourceHashDrift)).not.toEqual([])

    const padMapDrift = cloneCandidate()
    const allocation = padMapDrift.bp120Allocation as Record<string, unknown>
    const packageMap = allocation.packageMap as Array<Array<number | string>>
    packageMap[0]![1] = "PC13"
    expect(validateMutation(padMapDrift)).not.toEqual([])

    const descriptorDrift = cloneCandidate()
    Object.defineProperty(descriptorDrift.source as object, "sha256", { enumerable: false })
    expect(validateMutation(descriptorDrift)).not.toEqual([])

    const sparseArrayDrift = cloneCandidate()
    delete (sparseArrayDrift.pads as Array<unknown>)[0]
    expect(validateMutation(sparseArrayDrift)).not.toEqual([])

    const exposedPadDrift = cloneCandidate()
    const manufacturer = exposedPadDrift.package as Record<string, unknown>
    ;(manufacturer.exposedPad as Record<string, unknown>).present = true
    expect(validateMutation(exposedPadDrift)).not.toEqual([])

    const authorityDrift = cloneCandidate()
    ;(authorityDrift.authority as Record<string, unknown>).releaseState = "allow"
    expect(validateMutation(authorityDrift)).not.toEqual([])
  })

  it("rejects accessors, hidden and symbol keys, null prototypes, cycles, aliases, and throwing proxies without invoking getters", () => {
    let getterInvoked = false
    const accessor = cloneCandidate()
    const accessorSource = accessor.source as Record<string, unknown>
    Object.defineProperty(accessorSource, "sha256", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterInvoked = true
        return bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence.source.sha256
      }
    })
    expect(validateMutation(accessor)).not.toEqual([])
    expect(getterInvoked).toBe(false)

    const hidden = cloneCandidate()
    Object.defineProperty(hidden, "hiddenMutation", { configurable: true, enumerable: false, value: true })
    expect(validateMutation(hidden)).not.toEqual([])

    const symbolKey = cloneCandidate() as Record<PropertyKey, unknown>
    symbolKey[Symbol("mutation")] = true
    expect(validateMutation(symbolKey)).not.toEqual([])

    const nullPrototypeDrift = cloneCandidate()
    Object.setPrototypeOf(nullPrototypeDrift.package as object, null)
    expect(validateMutation(nullPrototypeDrift)).not.toEqual([])

    const cycle = cloneCandidate()
    const cycleSource = cycle.source as Record<string, unknown>
    cycleSource.cad = cycleSource
    expect(validateMutation(cycle)).not.toEqual([])

    const throwingProxy = cloneCandidate()
    throwingProxy.source = new Proxy(throwingProxy.source as object, {
      getPrototypeOf: () => {
        throw new Error("prototype trap")
      },
      ownKeys: () => {
        throw new Error("own-keys trap")
      }
    })
    let proxyResult: readonly string[] = []
    expect(() => {
      proxyResult = validateMutation(throwingProxy)
    }).not.toThrow()
    expect(proxyResult).not.toEqual([])

    const alias = cloneCandidate()
    alias.source = alias.package
    expect(validateMutation(alias)).not.toEqual([])
  })
})
