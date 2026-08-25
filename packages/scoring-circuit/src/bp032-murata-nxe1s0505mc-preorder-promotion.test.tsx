import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { Bp032MurataNxe1s0505mcCandidate } from "./bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint.js"
import {
  Bp032MurataNxe1s0505mcPreorderPromotion,
  bp032MurataNxe1s0505mcPreorderPromotion,
  validateBp032MurataNxe1s0505mcPreorderPromotion
} from "./bp032-murata-nxe1s0505mc-preorder-promotion.js"
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

function isSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isSolderPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_solder_paste" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function renderedGeometryHash(component: React.ReactElement) {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderTestCircuit(component)) {
    if (isSmtPad(element)) {
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
    if (isSolderPaste(element)) {
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

describe("BP-032 Murata NXE1S0505MC pre-order promotion candidate", () => {
  it("binds the exact U_ISO_POWER identity and leaves root approval outstanding", () => {
    expect(validateBp032MurataNxe1s0505mcPreorderPromotion()).toEqual([])
    expect(bp032MurataNxe1s0505mcPreorderPromotion).toMatchObject({
      artifactKind: "bp032-murata-nxe1s0505mc-preorder-promotion-candidate",
      workUnit: "BP-032",
      canonicalReference: "U_ISO_POWER",
      manufacturer: "Murata Power Solutions",
      manufacturerPartNumber: "NXE1S0505MC",
      package: {
        designation: "NXE1 SMD 14-position package",
        pinCount: 14,
        pinPitchMm: 2.54
      },
      preOrderPromotion: {
        state: "candidate-unapproved",
        integrationBasisCommit: "79d40c1",
        exactIdentityReviewed: true,
        packageAndPinMapReviewed: true,
        projectGeometrySource: "existing-root-corrected-project-review-artwork",
        rootApproval: { required: true, granted: false, authority: "root-only", decisionRecord: null }
      },
      accepted: false
    })
  })

  it("hash-binds the retained Murata source and inherited BP-122/BP-125/BOM contracts", () => {
    const source = bp032MurataNxe1s0505mcPreorderPromotion.sources[0]
    expect(source).toBeDefined()
    if (source === undefined) throw new Error("Expected retained Murata source")
    expect(hashArtifact(source.artifactPath)).toBe(source.sha256)
    expect(source.sha256).toBe("53A6DCE053DA52AF149055634FC380E5B9AD1473D575D0B59F0EFF6123913D40")
    for (const binding of bp032MurataNxe1s0505mcPreorderPromotion.sourceControl.upstreamSources) {
      expect(hashArtifact(binding.path)).toBe(binding.sha256)
    }
    expect(bp032MurataNxe1s0505mcPreorderPromotion.preOrderPromotion.sourceContracts).toEqual(["BP-122", "BP-125"])
  })

  it("binds the root-corrected lower-left pin-one map and the existing project-review artwork", () => {
    expect(bp032MurataNxe1s0505mcPreorderPromotion.orientation).toMatchObject({
      manufacturerPinOne: "pin 1 is the lower-left land in the page-6 drawing with +Y-up",
      manufacturerPinFourteen: "pin 14 is the upper-left land in the page-6 drawing with +Y-up",
      projectConvention: "top-view +Y-up pin-one lower-left",
      reviewTransform: "no transform; page-6 top view is retained in the chosen +Y-up coordinate system"
    })
    expect(bp032MurataNxe1s0505mcPreorderPromotion.preOrderPromotion.correctedOrientation).toEqual({
      state: "root-corrected-source-view",
      sourcePage: 6,
      convention: "top-view +Y-up",
      pinOne: { pad: "1", function: "-Vin", xMm: -3.81, yMm: -4.7 },
      pinFourteen: { pad: "14", function: "NA", xMm: -3.81, yMm: 4.7 },
      reviewTransform: "no transform; page-6 top view retained"
    })
    expect(bp032MurataNxe1s0505mcPreorderPromotion.preOrderPromotion.projectArtwork).toMatchObject({
      artifactPath: "packages/scoring-circuit/src/bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint.tsx",
      generator: "tscircuit",
      generatorVersion: "0.0.2271",
      sha256: "02C8560D829B499945E420E24D225182D52B0A4AF5C4AF5461E52B284E777FFA",
      hashBound: true
    })
    expect(renderedGeometryHash(<Bp032MurataNxe1s0505mcPreorderPromotion />)).toBe(
      bp032MurataNxe1s0505mcPreorderPromotion.preOrderPromotion.projectArtwork.sha256
    )
    expect(renderedGeometryHash(<Bp032MurataNxe1s0505mcPreorderPromotion />)).toBe(
      renderedGeometryHash(<Bp032MurataNxe1s0505mcCandidate />)
    )
    expect(renderTestCircuit(<Bp032MurataNxe1s0505mcPreorderPromotion />).filter(isSmtPad)).toHaveLength(5)
  })

  it("keeps every downstream physical and release gate denied", () => {
    expect(bp032MurataNxe1s0505mcPreorderPromotion.gates).toEqual({
      cad: "deny",
      placement: "deny",
      physicalIsolation: "deny",
      thermal: "deny",
      schematic: "deny",
      fabrication: "deny",
      release: "deny",
      physicalTest: "deny"
    })
    expect(bp032MurataNxe1s0505mcPreorderPromotion.manufacturerCad).toMatchObject({
      state: "not-acquired",
      authority: "deny",
      retainedArtifactPath: null,
      sha256: null
    })
    expect(bp032MurataNxe1s0505mcPreorderPromotion.physicalTest).toEqual({
      state: "not-run",
      authority: "deny",
      accepted: false,
      note: expect.any(String)
    })
    expect(bp032MurataNxe1s0505mcPreorderPromotion.acceptance).toMatchObject({
      projectArtworkAccepted: false,
      orientationAccepted: false,
      cadImportAccepted: false,
      placementAccepted: false,
      physicalIsolationAccepted: false,
      thermalAccepted: false,
      schematicAccepted: false,
      fabricationAuthorized: false,
      releaseState: "deny",
      preOrderFootprintApproved: false,
      physicalTestAccepted: false
    })
  })

  it("is frozen and fails closed on identity, orientation, artwork, approval, gate, and graph drift", () => {
    expect(Object.isFrozen(bp032MurataNxe1s0505mcPreorderPromotion)).toBe(true)
    expect(Object.isFrozen(bp032MurataNxe1s0505mcPreorderPromotion.preOrderPromotion)).toBe(true)
    const mutations = [
      (candidate: typeof bp032MurataNxe1s0505mcPreorderPromotion) =>
        Reflect.set(candidate, "manufacturerPartNumber", "NXE1S0505MC-ALIAS"),
      (candidate: typeof bp032MurataNxe1s0505mcPreorderPromotion) =>
        Reflect.set(candidate.preOrderPromotion.correctedOrientation.pinOne, "xMm", -3.8),
      (candidate: typeof bp032MurataNxe1s0505mcPreorderPromotion) =>
        Reflect.set(candidate.preOrderPromotion.projectArtwork, "sha256", "0".repeat(64)),
      (candidate: typeof bp032MurataNxe1s0505mcPreorderPromotion) =>
        Reflect.set(candidate.preOrderPromotion.rootApproval, "granted", true),
      (candidate: typeof bp032MurataNxe1s0505mcPreorderPromotion) => Reflect.set(candidate.gates, "thermal", "allow"),
      (candidate: typeof bp032MurataNxe1s0505mcPreorderPromotion) => {
        Object.defineProperty(candidate, "forged", { configurable: true, enumerable: false, value: true })
        return true
      },
      (candidate: typeof bp032MurataNxe1s0505mcPreorderPromotion) => {
        Object.defineProperty(candidate, "accessor", {
          configurable: true,
          enumerable: true,
          get: () => true
        })
        return true
      },
      (candidate: typeof bp032MurataNxe1s0505mcPreorderPromotion) => {
        Reflect.set(candidate, Symbol("forged"), true)
        return true
      },
      (candidate: typeof bp032MurataNxe1s0505mcPreorderPromotion) => {
        Object.setPrototypeOf(candidate, { forged: true })
        return true
      },
      (candidate: typeof bp032MurataNxe1s0505mcPreorderPromotion) => {
        Reflect.set(candidate.preOrderPromotion, "alias", candidate.preOrderPromotion.correctedOrientation.pinOne)
        return true
      },
      (candidate: typeof bp032MurataNxe1s0505mcPreorderPromotion) => {
        const cycle = candidate.preOrderPromotion as unknown as Record<string, unknown>
        cycle.cycle = cycle
        return true
      }
    ]
    for (const mutate of mutations) {
      const copy = structuredClone(bp032MurataNxe1s0505mcPreorderPromotion)
      mutate(copy)
      freezeClone(copy)
      expect(validateBp032MurataNxe1s0505mcPreorderPromotion(copy)).not.toEqual([])
    }
  })
})
