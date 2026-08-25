import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeApplicationFootprints,
  validateBenchPrototypeApplicationFootprints
} from "./bench-prototype-application-footprints.js"
import {
  bp033ApplicationRegulatorSupportFootprintEvidence,
  validateBp033ApplicationRegulatorSupportFootprintEvidence
} from "./bp033-application-regulator-support-footprint-evidence.js"

type AttackCandidate = {
  readonly sources: { sha256: string }[]
  readonly exactBindings: { reference: string }[]
  readonly families: { projectReviewGeometry: { pads?: { xMm: number }[] } }[]
  readonly denyGates: { fabrication: { state: string } }
}

function retainedBytes(path: string): Buffer {
  return readFileSync(new URL(`../${path.replace("packages/scoring-circuit/", "")}`, import.meta.url))
}

function cloneDataGraph(value: unknown, path = "root", writableDriftAt?: string, nullRoot = false): unknown {
  if (value === null || typeof value !== "object") return value
  const source = value as Record<string, unknown>
  const copy: Record<string, unknown> | unknown[] = Array.isArray(value)
    ? []
    : path === "root" && nullRoot
      ? Object.create(null)
      : {}
  for (const name of Object.getOwnPropertyNames(value)) {
    if (Array.isArray(value) && name === "length") continue
    const descriptor = Object.getOwnPropertyDescriptor(value, name)
    if (descriptor === undefined || !("value" in descriptor)) throw new Error("fixture must be data-only")
    Object.defineProperty(copy, name, {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      value: cloneDataGraph(source[name], `${path}.${name}`, writableDriftAt),
      writable: path === "root" && `${path}.${name}` === writableDriftAt ? true : descriptor.writable
    })
  }
  if (Array.isArray(value)) {
    const length = Object.getOwnPropertyDescriptor(value, "length")
    if (length === undefined || !("value" in length)) throw new Error("array fixture must have data length")
    Object.defineProperty(copy, "length", length)
  }
  return Object.preventExtensions(copy)
}

function freezeMutableGraph<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const name of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name)
    if (descriptor !== undefined && "value" in descriptor) freezeMutableGraph(descriptor.value, seen)
  }
  return Object.freeze(value)
}

describe("BP-033 application-regulator support footprint evidence", () => {
  it("reconciles exactly the five canonical references and orderables", () => {
    expect(validateBp033ApplicationRegulatorSupportFootprintEvidence()).toBe(true)
    expect(validateBenchPrototypeApplicationFootprints(benchPrototypeApplicationFootprints)).toBe(true)
    expect(bp033ApplicationRegulatorSupportFootprintEvidence.exactBindings).toEqual([
      {
        reference: "U_APP_REGULATOR",
        manufacturer: "Texas Instruments",
        manufacturerPartNumber: "LMR43620MSC3RPERQ1",
        package: "VQFN-HR RPE, 2 mm x 2 mm"
      },
      {
        reference: "L_APP_REGULATOR",
        manufacturer: "Coilcraft",
        manufacturerPartNumber: "XGL4030-222MEC",
        package: "XGL4030, 4 mm x 4 mm x 3 mm molded power inductor"
      },
      {
        reference: "C_APP_REG_IN",
        manufacturer: "TDK",
        manufacturerPartNumber: "C2012X7R1E475K125AB",
        package: "0805"
      },
      {
        reference: "C_APP_REG_VCC",
        manufacturer: "Wurth Elektronik",
        manufacturerPartNumber: "885012206052",
        package: "0603"
      },
      {
        reference: "R_APP_REG_DISCHARGE",
        manufacturer: "Yageo",
        manufacturerPartNumber: "RC0603FR-071KL",
        package: "0603"
      }
    ])
    for (const binding of bp033ApplicationRegulatorSupportFootprintEvidence.exactBindings) {
      expect(
        benchPrototypeApplicationFootprints.records.filter(
          (record) =>
            record.reference === binding.reference &&
            record.manufacturer === binding.manufacturer &&
            record.mpn === binding.manufacturerPartNumber &&
            record.package === binding.package
        )
      ).toHaveLength(1)
    }
  })

  it("hash-binds retained official evidence and preserves the TDK capture boundary", () => {
    for (const source of bp033ApplicationRegulatorSupportFootprintEvidence.sources) {
      expect(createHash("sha256").update(retainedBytes(source.artifactPath)).digest("hex").toUpperCase()).toBe(
        source.sha256
      )
      expect(source.exactOrderableEvidence).toContain(source.manufacturerPartNumber)
    }
    const tdk = bp033ApplicationRegulatorSupportFootprintEvidence.sources.find(
      (source) => source.manufacturer === "TDK"
    )
    expect(tdk).toMatchObject({
      authority: "manufacturer-primary-page-capture",
      reviewedPdfPages: [],
      manufacturerPartNumber: "C2012X7R1E475K125AB"
    })
  })

  it("keeps each family package fact separate from review-only geometry", () => {
    const [regulator, inductor, inputCapacitor, vccCapacitor, dischargeResistor] =
      bp033ApplicationRegulatorSupportFootprintEvidence.families
    expect(regulator).toMatchObject({
      reference: "U_APP_REGULATOR",
      package: { designation: "VQFN-HR RPE0009A", terminals: 9 },
      manufacturerGeometry: { state: "published-exact-orderable" },
      projectReviewGeometry: { state: "drawing-trace-only-not-emitted", accepted: false, fabricationAuthority: "deny" }
    })
    expect(inductor?.projectReviewGeometry).toMatchObject({
      pads: [
        { pad: "1", xMm: -1.675, yMm: 0, widthMm: 0.98, heightMm: 3.4 },
        { pad: "2", xMm: 1.675, yMm: 0, widthMm: 0.98, heightMm: 3.4 }
      ]
    })
    expect(inputCapacitor).toMatchObject({
      reference: "C_APP_REG_IN",
      package: { designation: "C2012 EIA 0805 MLCC", bodyMm: { lengthNominal: 2, widthNominal: 1.25 } },
      projectReviewGeometry: { state: "range-retained-not-transformed-to-pads", accepted: false }
    })
    expect(vccCapacitor?.projectReviewGeometry).toMatchObject({
      pads: [
        { pad: "1", xMm: -0.75, yMm: 0, widthMm: 0.8, heightMm: 0.8 },
        { pad: "2", xMm: 0.75, yMm: 0, widthMm: 0.8, heightMm: 0.8 }
      ]
    })
    expect(dischargeResistor?.projectReviewGeometry).toMatchObject({
      state: "review-only-project-input",
      pads: [
        { pad: "1", xMm: -0.7, yMm: 0, widthMm: 0.9, heightMm: 0.9 },
        { pad: "2", xMm: 0.7, yMm: 0, widthMm: 0.9, heightMm: 0.9 }
      ]
    })
  })

  it("denies CAD, placement, physical review, fabrication, and release", () => {
    expect(bp033ApplicationRegulatorSupportFootprintEvidence.denyGates).toEqual({
      manufacturerCad: { state: "not-acquired", authority: "deny" },
      boardPlacement: { state: "not-integrated", authority: "deny" },
      physicalFitAndClearance: { state: "not-reviewed", authority: "deny" },
      switchingLoopAndThermal: { state: "not-reviewed", authority: "deny" },
      assemblyProcess: { state: "not-reviewed", authority: "deny" },
      fabrication: { state: "deny", authority: "deny" },
      release: { state: "deny", authority: "deny" },
      accepted: false
    })
  })

  it.each([
    ["exact source hash", (copy: AttackCandidate) => (copy.sources[0]!.sha256 = "0".repeat(64))],
    ["canonical reference", (copy: AttackCandidate) => (copy.exactBindings[0]!.reference = "FORGED")],
    ["review geometry", (copy: AttackCandidate) => (copy.families[1]!.projectReviewGeometry.pads![0]!.xMm = 0)],
    ["fabrication gate", (copy: AttackCandidate) => (copy.denyGates.fabrication.state = "allow")]
  ])("fails closed for %s drift", (_name, mutate) => {
    const copy = structuredClone(bp033ApplicationRegulatorSupportFootprintEvidence) as unknown as AttackCandidate
    mutate(copy)
    expect(() => validateBp033ApplicationRegulatorSupportFootprintEvidence(copy)).toThrow(/drifted/u)
  })

  it("fails closed for null prototypes, descriptor drift, aliases, cycles, accessors, and trapping proxies", () => {
    const nullPrototype = cloneDataGraph(
      bp033ApplicationRegulatorSupportFootprintEvidence,
      "root",
      undefined,
      true
    ) as Record<string, unknown>
    expect(() => validateBp033ApplicationRegulatorSupportFootprintEvidence(nullPrototype)).toThrow(/drifted/u)

    const descriptorDrift = cloneDataGraph(
      bp033ApplicationRegulatorSupportFootprintEvidence,
      "root",
      "root.candidateStatus"
    ) as Record<string, unknown>
    expect(() => validateBp033ApplicationRegulatorSupportFootprintEvidence(descriptorDrift)).toThrow(/drifted/u)

    const alias = structuredClone(bp033ApplicationRegulatorSupportFootprintEvidence) as unknown as AttackCandidate
    alias.families[1]!.projectReviewGeometry.pads![1] = alias.families[1]!.projectReviewGeometry.pads![0]!
    freezeMutableGraph(alias)
    expect(() => validateBp033ApplicationRegulatorSupportFootprintEvidence(alias)).toThrow(/drifted/u)

    const cycle = structuredClone(bp033ApplicationRegulatorSupportFootprintEvidence) as unknown as AttackCandidate
    cycle.families[1]!.projectReviewGeometry.pads![0] = cycle as unknown as { xMm: number }
    freezeMutableGraph(cycle)
    expect(() => validateBp033ApplicationRegulatorSupportFootprintEvidence(cycle)).toThrow(/drifted/u)

    const accessor = structuredClone(bp033ApplicationRegulatorSupportFootprintEvidence) as Record<string, unknown>
    Object.defineProperty(accessor, "artifactKind", { configurable: true, enumerable: true, get: () => "forged" })
    expect(() => validateBp033ApplicationRegulatorSupportFootprintEvidence(accessor)).toThrow(/drifted/u)

    const trappingProxy = new Proxy(bp033ApplicationRegulatorSupportFootprintEvidence, {
      getPrototypeOf() {
        throw new Error("proxy trap")
      }
    })
    expect(() => validateBp033ApplicationRegulatorSupportFootprintEvidence(trappingProxy)).toThrow(/drifted/u)
  })
})
