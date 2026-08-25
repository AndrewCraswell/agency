import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp033DisplayBufferBss138akaReferenceBinding,
  validateBp033DisplayBufferBss138akaReferenceBinding
} from "./bp033-display-buffer-bss138aka-reference-binding.js"

const expectedReferences = ["Q_DISPLAY_BUFFER_A_ENABLE", "Q_DISPLAY_BUFFER_B_ENABLE"] as const
const expectedSourceSha256 = "39D145F3B39A916F88B21CF8E19C865437D200752A7CD37872EF976C2BFD69F9"

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

function retainedBytes(artifactPath: string) {
  return readFileSync(new URL(`../${artifactPath.replace("packages/scoring-circuit/", "")}`, import.meta.url))
}

function mutableClone(): Mutable<typeof bp033DisplayBufferBss138akaReferenceBinding> {
  return structuredClone(bp033DisplayBufferBss138akaReferenceBinding) as unknown as Mutable<
    typeof bp033DisplayBufferBss138akaReferenceBinding
  >
}

function freezeGraph<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) freezeGraph(descriptor.value, seen)
  }
  return Object.freeze(value)
}

describe("BP-033 BSS138AKA display-buffer reference binding", () => {
  it("binds exactly the two canonical display-enable references", () => {
    expect(validateBp033DisplayBufferBss138akaReferenceBinding()).toBe(true)
    expect(bp033DisplayBufferBss138akaReferenceBinding.exactReferenceSet).toEqual(expectedReferences)
    expect(bp033DisplayBufferBss138akaReferenceBinding.referenceBindings).toEqual([
      expect.objectContaining({
        reference: "Q_DISPLAY_BUFFER_A_ENABLE",
        manufacturer: "Nexperia",
        manufacturerPartNumber: "BSS138AKA",
        package: "SOT-23",
        packageCode: "SOT23",
        footprint: "sot23",
        pinLabels: { pin1: "G", pin2: "S", pin3: "D" }
      }),
      expect.objectContaining({
        reference: "Q_DISPLAY_BUFFER_B_ENABLE",
        manufacturer: "Nexperia",
        manufacturerPartNumber: "BSS138AKA",
        package: "SOT-23",
        packageCode: "SOT23",
        footprint: "sot23",
        pinLabels: { pin1: "G", pin2: "S", pin3: "D" }
      })
    ])
    expect(bp033DisplayBufferBss138akaReferenceBinding.referenceBindings).toHaveLength(2)
  })

  it("reuses the retained BP-032 manufacturer source and exact SOT23 facts", () => {
    const evidence = bp033DisplayBufferBss138akaReferenceBinding
    const source = evidence.sources[3]
    expect(source).toMatchObject({
      authority: "manufacturer-primary",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/nexperia-bss138aka-datasheet.pdf",
      sha256: expectedSourceSha256,
      reviewedPdfPages: [2, 11, 12]
    })
    expect(createHash("sha256").update(retainedBytes(source.artifactPath)).digest("hex").toUpperCase()).toBe(
      expectedSourceSha256
    )
    for (const candidateSource of evidence.sources) {
      expect(createHash("sha256").update(retainedBytes(candidateSource.artifactPath)).digest("hex").toUpperCase()).toBe(
        candidateSource.sha256
      )
    }
    expect(evidence.retainedManufacturerFacts).toMatchObject({
      sourceOwner: "BP-032",
      sourceRecord: "bp032ResetSupportFootprintEvidence.parts[1]",
      sourceArtifact: source.artifactPath,
      sourceSha256: source.sha256,
      duplicateEvidenceAdded: false,
      package: {
        designation: "SOT23",
        packageCode: "SOT23",
        pinCount: 3,
        bodyLengthMm: 2.9,
        bodyWidthMm: 1.3,
        bodyHeightMm: 1,
        leadPitchMm: 1.9,
        padCenterSpanMm: 1.4
      },
      pinMap: [
        { pin: 1, name: "G", function: "gate" },
        { pin: 2, name: "S", function: "source" },
        { pin: 3, name: "D", function: "drain" }
      ],
      manufacturerLandPattern: {
        sourcePage: 12,
        solderLands: { padLengthMm: 0.7, padWidthMm: 0.6, upperRowPitchMm: 1.9, centerSpanMm: 1.4 }
      }
    })
    expect(evidence.geometry.projectFootprint).toMatchObject({
      geometryAuthority: "project-review-input-derived-from-nexperia-fig19",
      orientation: {
        state: "pending-independent-review",
        boardRotationDegrees: 0,
        pinOnePad: 1
      }
    })
  })

  it("keeps CAD, placement, fabrication, release, and acceptance denied", () => {
    expect(bp033DisplayBufferBss138akaReferenceBinding.authority).toEqual({
      manufacturerCadImported: false,
      boardPlacementIntegrated: false,
      boardFitAccepted: false,
      orientationAccepted: false,
      courtyardAccepted: false,
      drcAccepted: false,
      fabricationAuthorized: false,
      acceptance: false,
      fabrication: "deny",
      release: "deny"
    })
    expect(bp033DisplayBufferBss138akaReferenceBinding.artwork).toEqual({
      state: "not-generated",
      artifactPath: null,
      sha256: null,
      authority: "deny"
    })
  })

  it("keeps the public graph independently frozen and rejects cloned adversarial graphs", () => {
    const publicGraph = bp033DisplayBufferBss138akaReferenceBinding
    expect(Object.isFrozen(publicGraph)).toBe(true)
    expect(Object.isFrozen(publicGraph.referenceBindings)).toBe(true)
    expect(Object.isFrozen(publicGraph.retainedManufacturerFacts.projectFootprint)).toBe(true)

    const ordinaryDrift = mutableClone()
    Reflect.set(ordinaryDrift.exactOrderable, "packageCode", "SOT89")
    expect(() => validateBp033DisplayBufferBss138akaReferenceBinding(ordinaryDrift)).toThrow(RangeError)
    expect(validateBp033DisplayBufferBss138akaReferenceBinding()).toBe(true)

    const hidden = mutableClone()
    Object.defineProperty(hidden, "hidden", { configurable: true, enumerable: false, value: true })
    freezeGraph(hidden)
    expect(() => validateBp033DisplayBufferBss138akaReferenceBinding(hidden)).toThrow(RangeError)

    const symbol = mutableClone()
    Object.defineProperty(symbol, Symbol("drift"), { configurable: true, enumerable: true, value: true })
    freezeGraph(symbol)
    expect(() => validateBp033DisplayBufferBss138akaReferenceBinding(symbol)).toThrow(RangeError)

    let accessorInvoked = false
    const accessor = mutableClone()
    Object.defineProperty(accessor, "artifactKind", {
      configurable: true,
      enumerable: true,
      get: () => {
        accessorInvoked = true
        return "unexpected"
      }
    })
    freezeGraph(accessor)
    expect(() => validateBp033DisplayBufferBss138akaReferenceBinding(accessor)).toThrow(RangeError)
    expect(accessorInvoked).toBe(false)

    const wrongPrototype = mutableClone()
    Object.setPrototypeOf(wrongPrototype, null)
    freezeGraph(wrongPrototype)
    expect(() => validateBp033DisplayBufferBss138akaReferenceBinding(wrongPrototype)).toThrow(RangeError)

    const cycle = mutableClone()
    cycle.geometry.projectFootprint = cycle as never
    freezeGraph(cycle)
    expect(() => validateBp033DisplayBufferBss138akaReferenceBinding(cycle)).toThrow(RangeError)

    const alias = mutableClone()
    alias.referenceBindings[1] = alias.referenceBindings[0]!
    freezeGraph(alias)
    expect(() => validateBp033DisplayBufferBss138akaReferenceBinding(alias)).toThrow(RangeError)

    const throwingProxy = new Proxy(mutableClone(), {
      ownKeys: () => {
        throw new Error("proxy ownKeys invoked")
      }
    })
    expect(() => validateBp033DisplayBufferBss138akaReferenceBinding(throwingProxy)).toThrow(RangeError)
  })
})
