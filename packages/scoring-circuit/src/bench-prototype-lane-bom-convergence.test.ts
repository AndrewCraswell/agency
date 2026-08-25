import { describe, expect, it } from "vitest"
import {
  benchPrototypeLaneBomConvergence,
  benchPrototypeLaneBomRows,
  evaluateLaneBomConvergence,
  projectExactLaneRowsOntoOrderCandidateBaseline,
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
  footprintEvidenceState: source === "BP-010" ? "not-started" : "approved",
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
  it("keeps the current prototype order candidate and fabrication release denied after exact BP-034 selections", () => {
    expect(benchPrototypeLaneBomConvergence).toMatchObject({
      workUnit: "BP-035",
      orderCandidateReady: false,
      prototypeOrderDisposition: "DENY",
      fabricationDisposition: "DENY",
      productionRelease: false
    })
    expect(benchPrototypeLaneBomConvergence.blockers.filter(({ code }) => code === "selection-blocked")).toEqual([])
    expect(benchPrototypeLaneBomConvergence.blockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "footprint-evidence-open", reference: "U_SCORING" })])
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
    const board = { ...complete("BP-034", "J1"), sampleEvidenceRequired: true, sampleEvidenceComplete: false }
    const external: LaneBomRow = {
      ...complete("BP-034", "BP034_SAMPLE:cable:1:CABLE-1"),
      mpn: "CABLE-1",
      package: null,
      classification: "external-sample-test",
      footprintEvidenceRequired: false,
      footprintEvidenceState: "not-started",
      sampleEvidenceRequired: true,
      sampleEvidenceComplete: false
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

  it("derives review state only from explicit per-row footprint evidence", () => {
    const stateCounts = (source: LaneBomRow["source"]) =>
      Object.fromEntries(
        Object.entries(
          Object.groupBy(
            benchPrototypeLaneBomRows.filter((row) => row.source === source),
            (row) => row.footprintEvidenceState
          )
        ).map(([state, rows]) => [state, rows.length])
      )
    const stateFor = (source: LaneBomRow["source"], reference: string) =>
      benchPrototypeLaneBomRows.find((row) => row.source === source && row.reference === reference)
        ?.footprintEvidenceState

    expect(stateCounts("BP-031")).toEqual({ "reviewed-unapproved": 84, "not-started": 29 })
    expect(stateCounts("BP-032")).toEqual({ "not-started": 22, "reviewed-unapproved": 29 })
    expect(stateCounts("BP-033")).toEqual({ "reviewed-unapproved": 53, "not-started": 48 })
    expect(stateFor("BP-031", "U_SAR_1")).toBe("reviewed-unapproved")
    expect(stateFor("BP-031", "U_OVP_BUFFER_1")).toBe("reviewed-unapproved")
    expect(stateFor("BP-031", "R_ESD_1")).toBe("reviewed-unapproved")
    expect(stateFor("BP-031", "U_REF_1")).toBe("reviewed-unapproved")
    expect(stateFor("BP-031", "C_SAR_1")).toBe("reviewed-unapproved")
    expect(stateFor("BP-031", "C_REF_IN_1")).toBe("reviewed-unapproved")
    expect(stateFor("BP-031", "C_REF_REG_HF_1")).toBe("reviewed-unapproved")
    expect(stateFor("BP-032", "C_ESP_EN_DELAY")).toBe("reviewed-unapproved")
    expect(stateFor("BP-032", "C_STM_SUPERVISOR_CT")).toBe("reviewed-unapproved")
    expect(stateFor("BP-032", "U_APP_RESET_FANOUT")).toBe("reviewed-unapproved")
    expect(stateFor("BP-032", "Q_ESP_RESET_STM")).toBe("reviewed-unapproved")
    expect(stateFor("BP-032", "J_STM_SWD")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "J_USB_C")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "U_USB_PD")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "U_USB_PORT_PROTECT")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "U_USB_DATA_PROTECT")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "U_VBUS_EFUSE")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "U_DISPLAY_LIMITER")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "C_ETH_AVDD_FERRITE_INPUT")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "C_W5500_AVDD_6")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "U_W5500")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "U_IR")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "J_LINK_INPUT")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "J_LINK_SCORING")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "R_APP_REG_PGOOD")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "R_HUB75_R1_PD")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "R_IR_PULLUP")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "R_FRAM_HOLD_PULLUP")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "J_HUB75")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "D_SOURCE_SELECTOR")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "S_SOURCE_SELECTOR")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "D_VBUS_TVS")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "F_APPLICATION")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "F_DISPLAY")).toBe("reviewed-unapproved")
    expect(stateFor("BP-033", "F_SCORING")).toBe("reviewed-unapproved")
    expect(benchPrototypeLaneBomRows.filter((row) => ["BP-031", "BP-032", "BP-033"].includes(row.source))).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ footprintEvidenceState: "approved" })])
    )
  })

  it("projects only exact lane identities into the BP-035 order-candidate baseline", () => {
    const historical = [complete("BP-010", "U_HISTORICAL"), complete("BP-010", "U_EXISTING")]
    const projection = projectExactLaneRowsOntoOrderCandidateBaseline(historical, [
      complete("BP-031", "U_EXACT"),
      { ...complete("BP-032", "U_TBD"), population: "TBD" },
      { ...complete("BP-033", "U_NO_PACKAGE"), package: null },
      { ...complete("BP-033", "U_TBD_PACKAGE"), package: "TBD" },
      { ...complete("BP-033", "U_EXISTING"), mpn: "CONFLICT" }
    ])

    expect(projection).toEqual([
      expect.objectContaining({
        source: "BP-035",
        reference: "U_EXACT",
        orderCandidateProjection: true,
        mpn: "EXACT-1",
        package: "PACKAGE-1",
        population: "populate"
      })
    ])
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
