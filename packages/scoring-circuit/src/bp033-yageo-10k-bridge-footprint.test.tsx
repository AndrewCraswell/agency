import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeApplicationFootprints,
  validateBenchPrototypeApplicationFootprints
} from "./bench-prototype-application-footprints.js"
import {
  bp032YageoRc0603ResistorFootprintEvidence,
  validateBp032YageoRc0603ResistorFootprintEvidence
} from "./bp032-yageo-rc0603-resistor-footprint-evidence.js"
import {
  Bp033Yageo10kBridgeFootprint,
  bp033Yageo10kBridgeFootprint,
  validateBp033Yageo10kBridgeFootprint
} from "./bp033-yageo-10k-bridge-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

const sourceSha256Literal = "EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497"
const artworkSha256Literal = "C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8"
const expectedReferences = [
  "R_APP_REG_PGOOD",
  "R_W5500_RESET_PULLUP",
  "R_HUB75_R1_PD",
  "R_HUB75_G1_PD",
  "R_HUB75_B1_PD",
  "R_HUB75_R2_PD",
  "R_HUB75_G2_PD",
  "R_HUB75_B2_PD",
  "R_HUB75_A_PD",
  "R_HUB75_B_PD",
  "R_HUB75_C_PD",
  "R_HUB75_D_PD",
  "R_HUB75_CLK_PD",
  "R_HUB75_LAT_PD",
  "R_HUB75_OE_PULLUP",
  "R_HUB75_UNUSED_B_A6_PD",
  "R_HUB75_UNUSED_B_A7_PD",
  "R_HUB75_UNUSED_B_A8_PD",
  "R_HUB75_PANEL_OE_PULLUP",
  "R_BUFFER_A_ENABLE_PULLUP",
  "R_BUFFER_A_GATE",
  "R_BUFFER_B_ENABLE_PULLUP",
  "R_BUFFER_B_GATE",
  "R_IR_PULLUP",
  "R_FRAM_WP_PULLUP",
  "R_FRAM_HOLD_PULLUP"
] as const

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

function retainedBytes(path: string) {
  return readFileSync(new URL(`../${path.replace("packages/scoring-circuit/", "")}`, import.meta.url))
}

function renderedGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderTestCircuit(<Bp033Yageo10kBridgeFootprint />)) {
    if (element.type === "pcb_smtpad" && element.shape === "rect") {
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
    if (element.type === "pcb_solder_paste" && element.shape === "rect") {
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

function mutableClone(): Mutable<typeof bp033Yageo10kBridgeFootprint> {
  return structuredClone(bp033Yageo10kBridgeFootprint) as unknown as Mutable<typeof bp033Yageo10kBridgeFootprint>
}

describe("BP-033 Yageo RC0603FR-0710KL 26-reference bridge", () => {
  it("enumerates the exact 26 references and cross-checks each canonical BP-033 contract", () => {
    expect(validateBenchPrototypeApplicationFootprints(benchPrototypeApplicationFootprints)).toBe(true)
    expect(validateBp032YageoRc0603ResistorFootprintEvidence()).toEqual([])
    expect(validateBp033Yageo10kBridgeFootprint()).toBe(true)
    expect(bp033Yageo10kBridgeFootprint.references).toEqual(expectedReferences)
    expect(bp033Yageo10kBridgeFootprint.references).toHaveLength(26)
    for (const binding of bp033Yageo10kBridgeFootprint.bindings) {
      const rows = benchPrototypeApplicationFootprints.records.filter(
        (record) => record.reference === binding.reference && record.mpn === "RC0603FR-0710KL"
      )
      expect(rows).toHaveLength(1)
      const row = rows[0]!
      expect(binding).toEqual({
        reference: row.reference,
        section: row.section,
        sourceContract: row.sourceContract,
        manufacturer: row.manufacturer,
        mpn: row.mpn,
        package: row.package,
        upstreamLedger: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts"
      })
    }
  })

  it("reuses the exact retained source and BP-032 geometry/artwork without duplicate evidence", () => {
    const source = bp033Yageo10kBridgeFootprint.retainedSource
    expect(source).toMatchObject({
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf",
      sha256: sourceSha256Literal,
      reusedFrom: "bp032-yageo-rc0603-resistor-footprint-evidence.sources[0]",
      duplicateEvidenceAdded: false
    })
    expect(createHash("sha256").update(retainedBytes(source.artifactPath)).digest("hex").toUpperCase()).toBe(
      sourceSha256Literal
    )
    expect(source.sha256).toBe(bp032YageoRc0603ResistorFootprintEvidence.sources[0]?.sha256)
    expect(bp033Yageo10kBridgeFootprint.geometry.sourceCandidate).toBe(
      "bp032-yageo-rc0603-resistor-footprint-evidence.projectFootprint"
    )
    expect(bp033Yageo10kBridgeFootprint.geometry.projectFootprint).toEqual(
      bp032YageoRc0603ResistorFootprintEvidence.projectFootprint
    )
    expect(renderedGeometryHash()).toBe(artworkSha256Literal)
    expect(renderedGeometryHash()).toBe(bp032YageoRc0603ResistorFootprintEvidence.artwork.sha256)
    expect(bp033Yageo10kBridgeFootprint.artwork).toMatchObject({
      sha256: artworkSha256Literal,
      sourceCandidate: "bp032-yageo-rc0603-resistor-footprint-evidence.artwork",
      duplicateEvidenceAdded: false,
      authority: "deny"
    })
  })

  it("keeps CAD, placement, fit, assembly, release, fabrication, and acceptance denied", () => {
    expect(bp033Yageo10kBridgeFootprint.denyGates).toEqual({
      manufacturerLandPattern: { state: "not-published", authority: "deny" },
      manufacturerCad: { state: "not-acquired", authority: "deny", artifactPath: null },
      boardPlacement: { state: "not-integrated", authority: "deny" },
      fitClearance: { state: "not-reviewed", authority: "deny" },
      mechanicalLoad: { state: "not-reviewed", authority: "deny" },
      assemblyProcess: { state: "not-reviewed", authority: "deny" },
      release: { state: "deny", authority: "deny" },
      fabrication: { state: "deny", authority: "deny" },
      accepted: false
    })
  })

  it("rejects hidden, symbol, accessor, prototype, cycle, alias, and ordinary field drift", () => {
    const rejectMutation = (mutate: (copy: Mutable<typeof bp033Yageo10kBridgeFootprint>) => void) => {
      const copy = mutableClone()
      mutate(copy)
      expect(() => validateBp033Yageo10kBridgeFootprint(copy)).toThrow(RangeError)
    }
    rejectMutation((copy) => {
      Object.defineProperty(copy.bindings[0], "hidden", { configurable: true, enumerable: false, value: "drift" })
    })
    rejectMutation((copy) => {
      Object.defineProperty(copy.bindings[0], Symbol("drift"), {
        configurable: true,
        enumerable: false,
        value: "drift"
      })
    })
    let getterInvoked = false
    const getterCopy = mutableClone()
    Object.defineProperty(getterCopy.retainedSource, "sha256", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterInvoked = true
        return sourceSha256Literal
      }
    })
    expect(() => validateBp033Yageo10kBridgeFootprint(getterCopy)).toThrow(RangeError)
    expect(getterInvoked).toBe(false)
    rejectMutation((copy) => Object.setPrototypeOf(copy.bindings[0], null))
    rejectMutation((copy) => {
      Object.defineProperty(copy, "geometry", { configurable: true, enumerable: true, writable: true, value: copy })
    })
    rejectMutation((copy) => {
      copy.bindings[1] = copy.bindings[0]
    })
    rejectMutation((copy) => {
      copy.bindings[0].sourceContract = "BP-999"
    })
    rejectMutation((copy) => {
      Object.defineProperty(copy.denyGates.fabrication, "authority", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: "allow"
      })
    })
  })

  it("freezes the public graph and rejects package, deny, and reused-geometry runtime mutations", () => {
    expect(Object.isFrozen(bp033Yageo10kBridgeFootprint)).toBe(true)
    expect(Object.isFrozen(bp033Yageo10kBridgeFootprint.geometry)).toBe(true)
    expect(Object.isFrozen(bp033Yageo10kBridgeFootprint.geometry.projectFootprint)).toBe(true)
    expect(Object.isFrozen(bp033Yageo10kBridgeFootprint.denyGates)).toBe(true)

    const packageMutation = mutableClone()
    Object.defineProperty(packageMutation.exactOrderable, "package", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: "0805"
    })
    expect(() => validateBp033Yageo10kBridgeFootprint(packageMutation)).toThrow(RangeError)

    const denyMutation = mutableClone()
    Object.defineProperty(denyMutation.denyGates, "accepted", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: true
    })
    expect(() => validateBp033Yageo10kBridgeFootprint(denyMutation)).toThrow(RangeError)

    const geometryMutation = mutableClone()
    Object.defineProperty(geometryMutation.geometry.projectFootprint.pads[0]!, "widthMm", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: 1.1
    })
    expect(() => validateBp033Yageo10kBridgeFootprint(geometryMutation)).toThrow(RangeError)
  })
})
