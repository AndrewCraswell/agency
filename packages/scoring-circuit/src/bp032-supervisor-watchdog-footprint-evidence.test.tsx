import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { benchPrototypeResetWatchdog, validateBenchPrototypeResetWatchdog } from "./bench-prototype-reset-watchdog.js"
import {
  Bp032SupervisorWatchdogTps3431sdrbrFootprint,
  Bp032SupervisorWatchdogTps389033dserFootprint,
  bp032SupervisorWatchdogFootprintEvidence,
  validateBp032SupervisorWatchdogFootprintEvidence
} from "./bp032-supervisor-watchdog-footprint-evidence.js"
import { renderTestCircuit } from "./test-helper.js"

const evidence = bp032SupervisorWatchdogFootprintEvidence

function packageRelativeUrl(repositoryPath: string): URL {
  const packageRelativePath = repositoryPath.replace("packages/scoring-circuit/", "")
  return new URL(`../${packageRelativePath}`, import.meta.url)
}

function verifySha256(repositoryPath: string, expectedSha256: string): void {
  const bytes = readFileSync(packageRelativeUrl(repositoryPath))
  expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(expectedSha256)
}

function artifactsForPart(json: ReturnType<typeof renderTestCircuit>, partNumber: string) {
  const source = json.find(
    (element) => element.type === "source_component" && element.manufacturer_part_number === partNumber
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
  if (pcb === undefined || !("pcb_component_id" in pcb)) return []
  return json.filter((element) => "pcb_component_id" in element && element.pcb_component_id === pcb.pcb_component_id)
}

describe("BP-032 supervisor/watchdog footprint evidence", () => {
  it("binds exactly the four BP-123 references to the frozen exact MPNs", () => {
    expect(validateBp032SupervisorWatchdogFootprintEvidence(evidence)).toBe(true)
    expect(validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)).toBe(true)
    expect(evidence.upstreamSelection.parts).toEqual([
      { reference: "U_STM_SUPERVISOR", manufacturerPartNumber: "TPS389033DSER", packageDrawing: "DSE0006A" },
      { reference: "U_ESP_SUPERVISOR", manufacturerPartNumber: "TPS389033DSER", packageDrawing: "DSE0006A" },
      { reference: "U_STM_WATCHDOG", manufacturerPartNumber: "TPS3431SDRBR", packageDrawing: "DRB0008A" },
      { reference: "U_ESP_WATCHDOG", manufacturerPartNumber: "TPS3431SDRBR", packageDrawing: "DRB0008A" }
    ])
    expect(evidence.assignments.map((assignment) => assignment.reference)).toEqual([
      "U_STM_SUPERVISOR",
      "U_ESP_SUPERVISOR",
      "U_STM_WATCHDOG",
      "U_ESP_WATCHDOG"
    ])
    expect(evidence.assignments.map((assignment) => assignment.manufacturerPartNumber)).toEqual([
      "TPS389033DSER",
      "TPS389033DSER",
      "TPS3431SDRBR",
      "TPS3431SDRBR"
    ])

    expect(evidence.candidates.TPS389033DSER.officialSources[0]).toMatchObject({
      documentScope: "series-datasheet",
      exactOrderableEvidence: {
        exactMpn: "TPS389033DSER",
        page: 19,
        packageRow: "TPS389033DSER; WSON (DSE) | 6"
      },
      packageGeometryEvidence: {
        packageDrawing: "DSE0006A",
        pages: [24, 25, 26],
        status: "package-level-example-not-exact-cad"
      }
    })
    expect(evidence.candidates.TPS3431SDRBR.officialSources[0]).toMatchObject({
      documentScope: "series-datasheet",
      exactOrderableEvidence: {
        exactMpn: "TPS3431SDRBR",
        page: 23,
        packageRow: "TPS3431SDRBR; SON (DRB) | 8"
      },
      packageGeometryEvidence: {
        packageDrawing: "DRB0008A",
        pages: [28, 29, 30],
        status: "package-level-example-not-exact-cad"
      }
    })

    for (const candidate of [evidence.candidates.TPS389033DSER, evidence.candidates.TPS3431SDRBR]) {
      for (const source of candidate.officialSources) verifySha256(source.artifactPath, source.sha256)
    }
    verifySha256(evidence.upstreamSelection.sourcePath, evidence.upstreamSelection.sourceSha256)
    verifySha256(evidence.upstreamSelection.fragmentPath, evidence.upstreamSelection.fragmentSha256)
  })

  it("records package geometry and denies unproven release gates", () => {
    const supervisor = evidence.candidates.TPS389033DSER
    expect(supervisor.package).toMatchObject({
      family: "WSON-6",
      packageDrawing: "DSE0006A",
      pinCount: 6,
      exposedThermalPad: false
    })
    expect(supervisor.pinMap.map((pin) => [pin.number, pin.name])).toEqual([
      [1, "SENSE"],
      [2, "GND"],
      [3, "MR"],
      [4, "VDD"],
      [5, "CT"],
      [6, "RESET"]
    ])
    expect(supervisor.landPattern.perimeterCopper).toMatchObject({
      padCount: 6,
      padDimensionsMm: { lengthMm: 0.7, widthMm: 0.25 },
      sideRowPitchMm: 0.5,
      sideRowSpanMm: 1
    })
    expect(supervisor.landPattern.solderMask).toMatchObject({
      pads1to3: { definition: "SMD", openingOverlapMinMm: 0.05 },
      pads4to6: { definition: "NSMD preferred", openingExpansionMaxMm: 0.05 }
    })

    const watchdog = evidence.candidates.TPS3431SDRBR
    expect(watchdog.package).toMatchObject({
      family: "VSON-8",
      packageDrawing: "DRB0008A",
      pinCount: 8,
      exposedThermalPad: true,
      thermalPadNet: "GND"
    })
    expect(watchdog.pinMap.map((pin) => [pin.number, pin.name])).toEqual([
      [1, "VDD"],
      [2, "CWD"],
      [3, "EN"],
      [4, "GND"],
      [5, "SET1"],
      [6, "WDI"],
      [7, "WDO"],
      [8, "ENOUT"]
    ])
    expect(watchdog.landPattern.exposedThermalPad).toMatchObject({
      copperEnvelopeMm: { widthMm: 1.5, lengthMm: 1.75 },
      viaCount: 4,
      viaLocations: [
        { xMm: 0, yMm: 0.625, drillDiameterMm: 0.2 },
        { xMm: -0.625, yMm: 0, drillDiameterMm: 0.2 },
        { xMm: 0.625, yMm: 0, drillDiameterMm: 0.2 },
        { xMm: 0, yMm: -0.625, drillDiameterMm: 0.2 }
      ]
    })
    expect(watchdog.landPattern.solderMask).toMatchObject({
      preferredDefinition: "NSMD",
      nsmdOpeningExpansionMaxMm: 0.07,
      smdOpeningOverlapMinMm: 0.07
    })

    for (const candidate of [supervisor, watchdog]) {
      expect(candidate.manufacturerCad).toMatchObject({
        state: "not-retained-official-cad",
        officialCadArtifact: null,
        courtyard: "not-published-by-TI"
      })
      expect(candidate.landPattern.courtyard).toEqual({
        status: "not-published",
        geometry: null,
        disposition: "do-not-infer-courtyard-from-package-outline"
      })
      expect(candidate.fabricationAuthority).toBe("deny")
      expect(candidate.accepted).toBe(false)
    }
    expect(evidence.gates).toMatchObject({
      mechanicalAcceptance: "deny",
      placementAcceptance: "deny",
      cadRelease: "deny",
      fabricationRelease: "deny",
      assemblyRelease: "deny",
      electricalIntegrationAuthority: "deny",
      physicalEvidence: "not-provided"
    })
  })

  it("renders isolated copper candidates without a courtyard", () => {
    const watchdogArtifacts = artifactsForPart(
      renderTestCircuit(<Bp032SupervisorWatchdogTps3431sdrbrFootprint />),
      "TPS3431SDRBR"
    )
    expect(watchdogArtifacts.filter((element) => element.type === "pcb_smtpad")).toHaveLength(9)
    expect(watchdogArtifacts.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(4)
    expect(watchdogArtifacts.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(8)
    expect(watchdogArtifacts.filter((element) => element.type === "pcb_courtyard_outline")).toHaveLength(0)
    expect(watchdogArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "pcb_smtpad", x: -1.1, y: 0.975, width: 0.6, height: 0.31 }),
        expect.objectContaining({ type: "pcb_smtpad", x: 0, y: 0, width: 1.5, height: 1.75 }),
        expect.objectContaining({ type: "pcb_plated_hole", x: 0, y: 0.625, hole_diameter: 0.2 })
      ])
    )

    const supervisorArtifacts = artifactsForPart(
      renderTestCircuit(<Bp032SupervisorWatchdogTps389033dserFootprint />),
      "TPS389033DSER"
    )
    expect(supervisorArtifacts.filter((element) => element.type === "pcb_smtpad")).toHaveLength(6)
    expect(supervisorArtifacts.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(0)
    expect(supervisorArtifacts.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(6)
    expect(supervisorArtifacts.filter((element) => element.type === "pcb_courtyard_outline")).toHaveLength(0)
    expect(supervisorArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "pcb_smtpad", x: -0.6, y: 0.5, width: 0.7, height: 0.25 }),
        expect.objectContaining({ type: "pcb_smtpad", x: 0.6, y: -0.5, width: 0.7, height: 0.25 })
      ])
    )
  })

  it("keeps the public clone frozen and rejects independent adversarial graphs", () => {
    expect(Object.isFrozen(evidence)).toBe(true)
    expect(Object.isFrozen(evidence.assignments)).toBe(true)
    expect(Object.isFrozen(evidence.assignments[0])).toBe(true)
    expect(Reflect.set(evidence.assignments[0], "manufacturerPartNumber", "TPS3431SDRBR")).toBe(false)
    expect(evidence.assignments[0].manufacturerPartNumber).toBe("TPS389033DSER")

    const drift = structuredClone(evidence)
    expect(Object.isFrozen(drift)).toBe(false)
    Reflect.set(drift.assignments[0], "manufacturerPartNumber", "TPS389031DSER")
    expect(() => validateBp032SupervisorWatchdogFootprintEvidence(drift)).toThrow(RangeError)
    expect(validateBp032SupervisorWatchdogFootprintEvidence(evidence)).toBe(true)

    const accessor = structuredClone(evidence)
    Object.defineProperty(accessor, "reviewState", { get: () => "prototype-first-review-only" })
    expect(() => validateBp032SupervisorWatchdogFootprintEvidence(accessor)).toThrow(RangeError)

    const cycle = structuredClone(evidence)
    Reflect.set(cycle.assignments, 0, cycle)
    expect(() => validateBp032SupervisorWatchdogFootprintEvidence(cycle)).toThrow(RangeError)

    const alias = structuredClone(evidence)
    Reflect.set(alias.assignments, 1, alias.assignments[0])
    expect(() => validateBp032SupervisorWatchdogFootprintEvidence(alias)).toThrow(RangeError)
    expect(validateBp032SupervisorWatchdogFootprintEvidence(evidence)).toBe(true)
  })
})
