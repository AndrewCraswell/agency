import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeServiceHeaders,
  validateBenchPrototypeServiceHeaders
} from "./bench-prototype-service-headers.js"
import {
  Bp032Esp32ServiceHeaderTsw10607gsFootprint,
  bp032Esp32ServiceHeaderTsw10607gsFootprintEvidence,
  validateBp032Esp32ServiceHeaderTsw10607gsFootprintEvidence
} from "./bp032-esp32-service-header-tsw-106-07-g-s-footprint-evidence.js"
import { renderTestCircuit } from "./test-helper.js"

const evidence = bp032Esp32ServiceHeaderTsw10607gsFootprintEvidence

function packageRelativeUrl(repositoryPath: string): URL {
  const packageRelativePath = repositoryPath.replace("packages/scoring-circuit/", "")
  return new URL(`../${packageRelativePath}`, import.meta.url)
}

function verifySha256(repositoryPath: string, expectedSha256: string): void {
  const bytes = readFileSync(packageRelativeUrl(repositoryPath))
  expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(expectedSha256)
}

describe("BP-032 exact ESP32 service-header footprint evidence", () => {
  it("binds J_ESP_SERVICE, BP-124 pin order, exact mating identity, and source hashes", () => {
    expect(validateBp032Esp32ServiceHeaderTsw10607gsFootprintEvidence(evidence)).toBe(true)
    expect(validateBenchPrototypeServiceHeaders(benchPrototypeServiceHeaders)).toBe(true)
    expect(evidence.canonicalSelection).toMatchObject({
      exactReferences: ["J_ESP_SERVICE"],
      exactMpn: "TSW-106-07-G-S",
      exactMatingMpn: "SSW-106-01-G-S"
    })
    expect(evidence.component).toMatchObject({
      reference: "J_ESP_SERVICE",
      manufacturer: "Samtec",
      manufacturerPartNumber: "TSW-106-07-G-S",
      positions: 6,
      rows: 1,
      pitchMm: 2.54,
      leadStyle: "-07 straight",
      termination: "through-hole"
    })
    expect(evidence.component.mating).toMatchObject({
      manufacturer: "Samtec",
      manufacturerPartNumber: "SSW-106-01-G-S",
      positions: 6,
      rows: 1,
      pitchMm: 2.54
    })
    expect(evidence.pinout.map((pin) => [pin.pin, pin.net])).toEqual([
      [1, "APP_GND"],
      [2, "APP_3V3_SENSE"],
      [3, "UART0_TX"],
      [4, "UART0_RX"],
      [5, "BOOT_N"],
      [6, "MANUAL_RESET_ASSERT"]
    ])
    expect(evidence.canonicalSelection.sources).toHaveLength(3)
    for (const source of evidence.canonicalSelection.sources) {
      expect(source.artifactPath).not.toBeNull()
      expect(source.sha256).not.toBeNull()
      if (source.artifactPath !== null && source.sha256 !== null) verifySha256(source.artifactPath, source.sha256)
    }
    for (const source of evidence.manufacturerSources) {
      expect(source.authority).toBe("manufacturer-primary")
      expect(source.artifactPath).not.toBeNull()
      expect(source.sha256).not.toBeNull()
      if (source.artifactPath !== null && source.sha256 !== null) verifySha256(source.artifactPath, source.sha256)
    }
  })

  it("records the justified hole geometry and denies inferred land and release geometry", () => {
    expect(evidence.orientation).toMatchObject({
      pinOne: { pin: 1, xMm: -6.35, yMm: 0 },
      pinSix: { pin: 6, xMm: 6.35, yMm: 0 },
      rowSpanMm: 12.7,
      keying: "none",
      reversible: true,
      fixtureEnforced: false
    })
    expect(evidence.landPattern.holes).toMatchObject({
      count: 6,
      finishedDiameterMm: 1.02,
      pitchMm: 2.54,
      rowSpanMm: 12.7,
      definition: "manufacturer typical finished-hole callout"
    })
    expect(evidence.landPattern.holes.coordinates).toEqual([
      { pin: 1, xMm: -6.35, yMm: 0 },
      { pin: 2, xMm: -3.81, yMm: 0 },
      { pin: 3, xMm: -1.27, yMm: 0 },
      { pin: 4, xMm: 1.27, yMm: 0 },
      { pin: 5, xMm: 3.81, yMm: 0 },
      { pin: 6, xMm: 6.35, yMm: 0 }
    ])
    expect(evidence.landPattern.copperAnnulus).toEqual({
      diameterMm: null,
      status: "not-published-by-Samtec-series-footprint",
      disposition: "do-not-infer-pad-diameter-or-annulus"
    })
    expect(evidence.landPattern.solderMask).toEqual({
      expansionMm: null,
      status: "not-published-by-Samtec-series-footprint",
      disposition: "fabricator-rule-review-required"
    })
    expect(evidence.landPattern.courtyard).toEqual({
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-courtyard"
    })
    expect(evidence.gates).toMatchObject({
      cadRelease: "deny",
      placementAcceptance: "deny",
      matingAcceptance: "deny",
      continuityAcceptance: "deny",
      fabricationRelease: "deny",
      assemblyRelease: "deny",
      electricalIntegrationAuthority: "deny",
      accepted: false,
      dnp: true
    })
    expect(evidence.prototypeHandoff.miswireGates).toHaveLength(4)
    expect(evidence.prototypeHandoff.strainRelief).toHaveLength(3)
  })

  it("renders only the six reviewed through-hole centers without a courtyard", () => {
    const json = renderTestCircuit(<Bp032Esp32ServiceHeaderTsw10607gsFootprint />)
    const source = json.find(
      (element) => element.type === "source_component" && element.manufacturer_part_number === "TSW-106-07-G-S"
    )
    expect(source).toBeDefined()
    const pcb = json.find(
      (element) =>
        element.type === "pcb_component" &&
        source !== undefined &&
        "source_component_id" in source &&
        element.source_component_id === source.source_component_id
    )
    expect(pcb).toBeDefined()
    if (pcb === undefined || !("pcb_component_id" in pcb)) return
    const artifacts = json.filter(
      (element) => "pcb_component_id" in element && element.pcb_component_id === pcb.pcb_component_id
    )
    expect(artifacts.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(6)
    expect(artifacts.filter((element) => element.type === "pcb_courtyard_outline")).toHaveLength(0)
    expect(artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "pcb_plated_hole", x: -6.35, y: 0, hole_diameter: 1.02 }),
        expect.objectContaining({ type: "pcb_plated_hole", x: 6.35, y: 0, hole_diameter: 1.02 })
      ])
    )
  })

  it("keeps public and private graphs independent and rejects adversarial drift", () => {
    expect(Object.isFrozen(evidence)).toBe(true)
    expect(Object.isFrozen(evidence.pinout)).toBe(true)
    expect(Object.isFrozen(evidence.pinout[0])).toBe(true)
    expect(Reflect.set(evidence.pinout[0], "net", "UART0_RX")).toBe(false)
    expect(evidence.pinout[0].net).toBe("APP_GND")

    const drift = structuredClone(evidence)
    expect(Object.isFrozen(drift)).toBe(false)
    Reflect.set(drift.pinout[2], "net", "UART0_RX")
    expect(() => validateBp032Esp32ServiceHeaderTsw10607gsFootprintEvidence(drift)).toThrow(RangeError)
    expect(validateBp032Esp32ServiceHeaderTsw10607gsFootprintEvidence(evidence)).toBe(true)

    const accessor = structuredClone(evidence)
    Object.defineProperty(accessor, "reviewState", { get: () => "prototype-first-review-only", enumerable: true })
    expect(() => validateBp032Esp32ServiceHeaderTsw10607gsFootprintEvidence(accessor)).toThrow(RangeError)

    const cycle = structuredClone(evidence) as { self?: unknown }
    cycle.self = cycle
    expect(() => validateBp032Esp32ServiceHeaderTsw10607gsFootprintEvidence(cycle)).toThrow(RangeError)

    const alias = structuredClone(evidence)
    Reflect.set(alias, "pinout", alias.canonicalSelection.sources)
    expect(() => validateBp032Esp32ServiceHeaderTsw10607gsFootprintEvidence(alias)).toThrow(RangeError)
    expect(validateBp032Esp32ServiceHeaderTsw10607gsFootprintEvidence(evidence)).toBe(true)
  })
})
