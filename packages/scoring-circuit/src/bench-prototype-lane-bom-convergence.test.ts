import { describe, expect, it } from "vitest"
import {
  benchPrototypeLaneBomConvergence,
  evaluateLaneBomConvergence,
  type LaneBomRow
} from "./bench-prototype-lane-bom-convergence.js"

const complete = (source: LaneBomRow["source"], reference: string): LaneBomRow => ({
  source,
  reference,
  mpn: "EXACT-1",
  package: "PACKAGE-1",
  population: "populate",
  classification: "board-populated",
  footprintEvidenceRequired: source !== "BP-010",
  footprintEvidenceComplete: true,
  sampleEvidenceRequired: false,
  sampleEvidenceComplete: false
})

const supplied = (...sources: LaneBomRow["source"][]) =>
  sources.map((source) => ({ source, status: "provided" as const }))

const reviewedNotApplicable = (source: LaneBomRow["source"]) => ({
  source,
  status: "reviewed-not-applicable" as const,
  reviewer: "Independent reviewer",
  rationale: "No rows apply to this focused evaluator fixture."
})

const allSourcesFor = (...provided: LaneBomRow["source"][]) => [
  ...supplied(...provided),
  ...(["BP-010", "BP-031", "BP-032", "BP-033", "BP-034"] as const)
    .filter((source) => !provided.includes(source))
    .map(reviewedNotApplicable)
]

describe("BP-035 lane BOM convergence", () => {
  it("keeps the current prototype order candidate and fabrication release denied", () => {
    expect(benchPrototypeLaneBomConvergence).toMatchObject({
      workUnit: "BP-035",
      orderCandidateReady: false,
      prototypeOrderDisposition: "DENY",
      fabricationDisposition: "DENY",
      productionRelease: false
    })
    expect(benchPrototypeLaneBomConvergence.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "selection-blocked", reference: "J_USB_C" }),
        expect.objectContaining({ code: "selection-blocked", reference: "J_ETH" }),
        expect.objectContaining({ code: "footprint-evidence-open", reference: "U_SCORING" }),
        expect.objectContaining({ code: "sample-evidence-open", reference: "J_USB_C" })
      ])
    )
  })

  it("accepts a fully aligned prototype order row while retaining fabrication denial", () => {
    const evaluation = evaluateLaneBomConvergence({
      rows: [complete("BP-010", "U1"), complete("BP-032", "U1")],
      sourceArtifacts: allSourcesFor("BP-010", "BP-032"),
      selectionBlockers: []
    })
    expect(evaluation).toMatchObject({
      orderCandidateReady: true,
      prototypeOrderDisposition: "READY",
      fabricationDisposition: "DENY",
      productionRelease: false,
      blockers: []
    })
  })

  it("rejects an empty input instead of treating absence as convergence", () => {
    const evaluation = evaluateLaneBomConvergence({ rows: [], sourceArtifacts: [], selectionBlockers: [] })
    expect(evaluation.orderCandidateReady).toBe(false)
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-baseline-reference", reference: "GLOBAL" }),
        expect.objectContaining({ code: "missing-lane-reference", reference: "GLOBAL" }),
        expect.objectContaining({ code: "missing-source-artifact", reference: "GLOBAL" })
      ])
    )
  })

  it("rejects duplicate, missing, identity, package, population, and evidence drift", () => {
    const evaluation = evaluateLaneBomConvergence({
      rows: [
        complete("BP-010", "U1"),
        complete("BP-010", "U1"),
        { ...complete("BP-032", "U1"), mpn: "DRIFT", package: "PACKAGE-DRIFT", population: "DNP" },
        { ...complete("BP-033", "U2"), footprintEvidenceComplete: false },
        { ...complete("BP-010", "U3"), sampleEvidenceRequired: true, sampleEvidenceComplete: false },
        { ...complete("BP-010", "U4"), mpn: null, package: null },
        complete("BP-033", "U4")
      ],
      sourceArtifacts: allSourcesFor("BP-010", "BP-032", "BP-033"),
      selectionBlockers: [{ reference: "J1", detail: "exact cable remains unselected" }]
    })
    const codes = new Set(evaluation.blockers.map((blocker) => blocker.code))
    expect(codes).toEqual(
      new Set([
        "duplicate-reference",
        "missing-baseline-reference",
        "missing-lane-reference",
        "mpn-drift",
        "package-drift",
        "population-drift",
        "footprint-evidence-open",
        "sample-evidence-open",
        "unresolved-mpn",
        "unresolved-package",
        "selection-blocked"
      ])
    )
  })

  it("requires every source artifact or a complete reviewed not-applicable declaration", () => {
    const evaluation = evaluateLaneBomConvergence({
      rows: [complete("BP-010", "U1"), complete("BP-032", "U1")],
      sourceArtifacts: [
        ...supplied("BP-010", "BP-032"),
        reviewedNotApplicable("BP-031"),
        reviewedNotApplicable("BP-033"),
        reviewedNotApplicable("BP-033"),
        { source: "BP-034", status: "reviewed-not-applicable", reviewer: "", rationale: "" }
      ],
      selectionBlockers: []
    })
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate-source-artifact", sources: ["BP-033"] }),
        expect.objectContaining({ code: "source-artifact-review-open", sources: ["BP-034"] })
      ])
    )
  })

  it("reconciles BP-034 board rows but excludes external sample rows from baseline identity drift", () => {
    const board = { ...complete("BP-034", "J1"), sampleEvidenceRequired: true, sampleEvidenceComplete: true }
    const external: LaneBomRow = {
      ...complete("BP-034", "BP034_SAMPLE:cable:1:CABLE-1"),
      mpn: "CABLE-1",
      package: null,
      classification: "external-sample-test",
      footprintEvidenceRequired: false,
      sampleEvidenceRequired: true,
      sampleEvidenceComplete: true
    }
    const evaluation = evaluateLaneBomConvergence({
      rows: [complete("BP-010", "J1"), board, external],
      sourceArtifacts: allSourcesFor("BP-010", "BP-034"),
      selectionBlockers: []
    })
    expect(evaluation).toMatchObject({ orderCandidateReady: true, blockers: [] })

    const boardDrift = evaluateLaneBomConvergence({
      rows: [complete("BP-010", "J1"), { ...board, mpn: "BOARD-DRIFT" }, external],
      sourceArtifacts: allSourcesFor("BP-010", "BP-034"),
      selectionBlockers: []
    })
    expect(boardDrift.blockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "mpn-drift", reference: "J1" })])
    )
    expect(boardDrift.blockers).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing-baseline-reference", reference: external.reference })
      ])
    )
  })

  it("rejects identified TBD population, DNP versus TBD drift, and a lane-only DNP reference", () => {
    const evaluation = evaluateLaneBomConvergence({
      rows: [
        { ...complete("BP-010", "U1"), population: "DNP" },
        { ...complete("BP-032", "U1"), population: "TBD" },
        { ...complete("BP-033", "U_LANE_ONLY"), population: "DNP" }
      ],
      sourceArtifacts: allSourcesFor("BP-010", "BP-032", "BP-033"),
      selectionBlockers: []
    })
    expect(evaluation.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unresolved-population", reference: "U1" }),
        expect.objectContaining({ code: "population-drift", reference: "U1" }),
        expect.objectContaining({ code: "missing-baseline-reference", reference: "U_LANE_ONLY" })
      ])
    )
  })

  it("deep-freezes every direct evaluator result including nested blocker sources", () => {
    const evaluation = evaluateLaneBomConvergence({ rows: [], sourceArtifacts: [], selectionBlockers: [] })
    expect(Object.isFrozen(evaluation)).toBe(true)
    expect(Object.isFrozen(evaluation.blockers)).toBe(true)
    expect(Object.isFrozen(evaluation.blockers[0])).toBe(true)
    expect(Object.isFrozen(evaluation.blockers[0]?.sources)).toBe(true)
    expect(Object.isFrozen(evaluation.unresolvedPopulatedReferences)).toBe(true)
  })

  it("enumerates every unresolved populated reference once", () => {
    const references = benchPrototypeLaneBomConvergence.unresolvedPopulatedReferences
    expect(references).toEqual([...new Set(references)].sort())
    expect(references).toContain("J_ETH")
    expect(references).toContain("J_USB_C")
    expect(references).toContain("U_SCORING")
    expect(references).toContain("U_ANALOG_CELL_1")
    expect(Object.isFrozen(benchPrototypeLaneBomConvergence.blockers)).toBe(true)
  })
})
