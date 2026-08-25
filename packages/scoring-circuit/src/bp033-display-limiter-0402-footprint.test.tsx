import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp033DisplayLimiter0402KemetReviewFootprint,
  Bp033DisplayLimiter0402YageoReviewFootprint,
  bp033DisplayLimiter0402Footprint,
  validateBp033DisplayLimiter0402Footprint
} from "./bp033-display-limiter-0402-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

function mutableClone(): Mutable<typeof bp033DisplayLimiter0402Footprint> {
  return structuredClone(bp033DisplayLimiter0402Footprint) as unknown as Mutable<
    typeof bp033DisplayLimiter0402Footprint
  >
}

function retainedSha256(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(new URL(`../${relativePath}`, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function renderFamily(family: "yageo" | "kemet") {
  return renderTestCircuit(
    family === "yageo" ? (
      <Bp033DisplayLimiter0402YageoReviewFootprint />
    ) : (
      <Bp033DisplayLimiter0402KemetReviewFootprint />
    )
  )
}

describe("BP-033 display-limiter exact 0402 footprint evidence", () => {
  it("binds exactly the seven canonical references and the two evidence groups", () => {
    expect(validateBp033DisplayLimiter0402Footprint()).toEqual([])
    expect(bp033DisplayLimiter0402Footprint.canonicalBinding).toMatchObject({
      ledgerPath: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts",
      sourceContract: "BP-050",
      exactReferenceSet: [
        "R_DISPLAY_ILM",
        "C_DISPLAY_BYPASS",
        "C_DISPLAY_DVDT",
        "C_DISPLAY_ITIMER",
        "R_DISPLAY_PG_PULLUP",
        "R_DISPLAY_PG_LOWER",
        "R_DISPLAY_PG_UPPER"
      ],
      genericFamilySubstitution: "deny"
    })
    expect(bp033DisplayLimiter0402Footprint.geometryGroups).toHaveLength(2)
    expect(bp033DisplayLimiter0402Footprint.referenceBindings).toHaveLength(7)
    expect(bp033DisplayLimiter0402Footprint.referenceBindings).toEqual([
      expect.objectContaining({
        reference: "R_DISPLAY_ILM",
        manufacturer: "Yageo",
        manufacturerPartNumber: "RC0402FR-07698RL",
        package: "0402",
        groupId: "yageo-rc0402-resistors"
      }),
      expect.objectContaining({
        reference: "C_DISPLAY_BYPASS",
        manufacturer: "KEMET",
        manufacturerPartNumber: "C0402C104K3RACTU",
        package: "0402",
        groupId: "kemet-c0402-mlccs"
      }),
      expect.objectContaining({
        reference: "C_DISPLAY_DVDT",
        manufacturer: "KEMET",
        manufacturerPartNumber: "C0402C222K3RACTU",
        package: "0402",
        groupId: "kemet-c0402-mlccs"
      }),
      expect.objectContaining({
        reference: "C_DISPLAY_ITIMER",
        manufacturer: "KEMET",
        manufacturerPartNumber: "C0402C222K3RACTU",
        package: "0402",
        groupId: "kemet-c0402-mlccs"
      }),
      expect.objectContaining({
        reference: "R_DISPLAY_PG_PULLUP",
        manufacturer: "Yageo",
        manufacturerPartNumber: "RC0402FR-0710KL",
        package: "0402",
        groupId: "yageo-rc0402-resistors"
      }),
      expect.objectContaining({
        reference: "R_DISPLAY_PG_LOWER",
        manufacturer: "Yageo",
        manufacturerPartNumber: "RC0402FR-0749K9L",
        package: "0402",
        groupId: "yageo-rc0402-resistors"
      }),
      expect.objectContaining({
        reference: "R_DISPLAY_PG_UPPER",
        manufacturer: "Yageo",
        manufacturerPartNumber: "RC0402FR-07137KL",
        package: "0402",
        groupId: "yageo-rc0402-resistors"
      })
    ])
  })

  it("binds each exact source hash and page-one orderable facts", () => {
    const expected = [
      [
        "RC0402FR-07698RL",
        "docs/evidence/bp-033/yageo-rc0402fr-07698rl-specsheet.pdf",
        "B22937845B9DD9352E2959C69AE306C0D74BD998FB072481640602BC469D1DC6"
      ],
      [
        "RC0402FR-0710KL",
        "docs/evidence/bp-033/yageo-rc0402fr-0710kl-specsheet.pdf",
        "85ACEB87C42E4093DDDCD9563251F2E47E9EF8D0432D1F03B3A03FAEADD86BA3"
      ],
      [
        "RC0402FR-0749K9L",
        "docs/evidence/bp-033/yageo-rc0402fr-0749k9l-specsheet.pdf",
        "B531815E39E63385D45860F0C737FF8627681D448DC3497AAE5D46157474EA2B"
      ],
      [
        "RC0402FR-07137KL",
        "docs/evidence/bp-033/yageo-rc0402fr-07137kl-specsheet.pdf",
        "7C76432DCDCB6DCC6D35F07B9281CC0EF5189AF5C9A26A7115FA8818F1B72D7B"
      ],
      [
        "C0402C104K3RACTU",
        "docs/evidence/bp-033/kemet-c0402c104k3ractu-specsheet.pdf",
        "889DE4201A2C26835545FC3BE215BE03637E2D3422FCC86B5FA5D96DBE0B30F1"
      ],
      [
        "C0402C222K3RACTU",
        "docs/evidence/bp-033/kemet-c0402c222k3ractu-specsheet.pdf",
        "54F836BE838A054C9E696CD8FDB0C9529A190E11B1372C2ADCD615CD97A22133"
      ]
    ] as const
    expect(bp033DisplayLimiter0402Footprint.sourceDefinitions).toHaveLength(expected.length)
    for (const [index, [mpn, artifactPath, sha256]] of expected.entries()) {
      const source = bp033DisplayLimiter0402Footprint.sourceDefinitions[index]
      expect(source).toMatchObject({
        manufacturerPartNumber: mpn,
        package: "0402",
        artifactPath,
        sha256,
        reviewedPages: [1]
      })
      expect(retainedSha256(artifactPath)).toBe(sha256)
    }
    expect(bp033DisplayLimiter0402Footprint.sourceDefinitions[4]?.pageBinding).toMatchObject({
      retainedPdfPageCount: 4,
      exactOrderablePdfPage: 1,
      simulationPagesExcluded: [2, 3, 4]
    })
    expect(bp033DisplayLimiter0402Footprint.sourceDefinitions[5]?.orderableCharacteristics).toMatchObject({
      capacitanceNf: 2.2,
      ratedVoltageVdc: 25,
      dielectric: "X7R"
    })
  })

  it("keeps resistor and MLCC geometry groups separate while retaining non-polar review orientation", () => {
    const [resistors, capacitors] = bp033DisplayLimiter0402Footprint.geometryGroups
    expect(resistors?.projectFootprint).toMatchObject({
      bodyPackage: "0402 / 1005, two-terminal thick-film resistor",
      innerGapMm: 0.4,
      pads: [
        { pad: "1", xMm: -0.5, yMm: 0, widthMm: 0.6, heightMm: 0.6 },
        { pad: "2", xMm: 0.5, yMm: 0, widthMm: 0.6, heightMm: 0.6 }
      ],
      geometryAuthority: "project-review-input-not-manufacturer-land-pattern"
    })
    expect(capacitors?.projectFootprint).toMatchObject({
      bodyPackage: "0402 / 1005, two-terminal ceramic MLCC",
      innerGapMm: 0.4,
      pads: [
        { pad: "1", xMm: -0.5, yMm: 0, widthMm: 0.6, heightMm: 0.6 },
        { pad: "2", xMm: 0.5, yMm: 0, widthMm: 0.6, heightMm: 0.6 }
      ],
      geometryAuthority: "project-review-input-not-manufacturer-land-pattern"
    })
    expect(bp033DisplayLimiter0402Footprint.orientation).toEqual({
      state: "non-polar-project-review-input-only",
      pinOne: "not-applicable",
      assemblyRotationDeg: null,
      placementAuthority: "deny",
      note: "Both groups are electrically non-polar; rotation is review-equivalent only and does not authorize placement."
    })
    expect(bp033DisplayLimiter0402Footprint.manufacturerLandPattern).toEqual({
      state: "not-published-by-retained-exact-orderable-sources",
      copper: "not-published",
      solderMask: "not-published",
      paste: "not-published",
      courtyard: "not-published",
      manufacturerCad: "not-acquired"
    })
  })

  it("renders two isolated two-pad non-polar review footprints without board authority", () => {
    for (const family of ["yageo", "kemet"] as const) {
      const rendered = renderFamily(family)
      const pads = rendered.filter((element) => element.type === "pcb_smtpad")
      const paste = rendered.filter((element) => element.type === "pcb_solder_paste")
      const courtyard = rendered.filter((element) => element.type === "pcb_courtyard_rect")
      expect(pads).toHaveLength(2)
      expect(paste).toHaveLength(2)
      expect(courtyard).toEqual([expect.objectContaining({ center: { x: 0, y: 0 }, width: 1.6, height: 1.1 })])
      expect(pads).toEqual([
        expect.objectContaining({ x: -0.5, y: 0, width: 0.6, height: 0.6, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 0.5, y: 0, width: 0.6, height: 0.6, soldermask_margin: 0.05 })
      ])
      expect(rendered.filter((element) => element.type.endsWith("_error"))).toEqual([])
    }
    expect(bp033DisplayLimiter0402Footprint.gates).toEqual({
      manufacturerCad: "deny-not-acquired",
      projectCadImport: "deny",
      boardPlacement: "deny",
      projectGeometryAcceptance: "deny",
      orientationAcceptance: "deny",
      drc: "deny",
      fabrication: "deny",
      release: "deny"
    })
    expect(bp033DisplayLimiter0402Footprint.artwork).toEqual({
      state: "isolated-generated-project-review-only",
      authority: "deny",
      placement: "not-assigned",
      boardIntegration: "deny"
    })
    expect(bp033DisplayLimiter0402Footprint.accepted).toBe(false)
  })

  it("rejects identity, hidden, symbol, accessor, prototype, descriptor, sparse, cycle, alias, and proxy drift", () => {
    const identity = mutableClone()
    identity.referenceBindings[0]!.manufacturerPartNumber = "RC0402FR-0710KL"
    expect(validateBp033DisplayLimiter0402Footprint(identity)).not.toEqual([])

    const hidden = mutableClone()
    Object.defineProperty(hidden, "hidden", { configurable: true, enumerable: false, value: true, writable: true })
    expect(validateBp033DisplayLimiter0402Footprint(hidden)).not.toEqual([])

    const symbol = mutableClone()
    Object.defineProperty(symbol, Symbol("drift"), {
      configurable: true,
      enumerable: true,
      value: true,
      writable: true
    })
    expect(validateBp033DisplayLimiter0402Footprint(symbol)).not.toEqual([])

    const accessor = mutableClone()
    let getterInvoked = false
    Object.defineProperty(accessor.sourceDefinitions[0]!, "sha256", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterInvoked = true
        return "forged"
      }
    })
    expect(validateBp033DisplayLimiter0402Footprint(accessor)).not.toEqual([])
    expect(getterInvoked).toBe(false)

    const prototype = mutableClone()
    Object.setPrototypeOf(prototype.sourceDefinitions[0]!, null)
    expect(validateBp033DisplayLimiter0402Footprint(prototype)).not.toEqual([])

    const descriptor = mutableClone()
    Object.defineProperty(descriptor.gates, "release", {
      configurable: true,
      enumerable: true,
      value: "deny",
      writable: false
    })
    expect(validateBp033DisplayLimiter0402Footprint(descriptor)).not.toEqual([])

    const sparse = mutableClone()
    delete sparse.geometryGroups[0]!.references[0]
    expect(validateBp033DisplayLimiter0402Footprint(sparse)).not.toEqual([])

    const cycle = mutableClone()
    ;(cycle.artwork as Record<string, unknown>).cycle = cycle
    expect(validateBp033DisplayLimiter0402Footprint(cycle)).not.toEqual([])

    const alias = mutableClone()
    alias.geometryGroups[1]!.projectFootprint = alias.geometryGroups[0]!.projectFootprint
    expect(validateBp033DisplayLimiter0402Footprint(alias)).not.toEqual([])

    const throwingProxy = new Proxy(mutableClone(), {
      ownKeys: () => {
        throw new Error("hostile ownKeys trap")
      }
    })
    expect(() => validateBp033DisplayLimiter0402Footprint(throwingProxy)).not.toThrow()
    expect(validateBp033DisplayLimiter0402Footprint(throwingProxy)).not.toEqual([])
  })
})
