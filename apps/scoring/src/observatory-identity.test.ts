import { describe, expect, it } from "vitest"
import { projectObservatoryIdentity } from "./observatory-identity.js"

describe("observatory identity projection", () => {
  it("normalizes an executable scenario identity and enables Run", () => {
    expect(
      projectObservatoryIdentity({
        status: "passed",
        scenario: { ruleRevision: "  fie-2026-sabre  ", scenarioId: "  sabre.lockout-cutoff  " }
      })
    ).toEqual({
      canRun: true,
      id: "sabre.lockout-cutoff",
      idLabel: "Scenario ID",
      kind: "scenario",
      ruleRevision: "fie-2026-sabre"
    })
  })

  it("keeps a failed runner case executable when its identity is valid", () => {
    expect(
      projectObservatoryIdentity({
        status: "failed",
        scenario: { ruleRevision: "fie-2026-foil", scenarioId: "foil.failed" }
      })
    ).toMatchObject({ canRun: true, id: "foil.failed", ruleRevision: "fie-2026-foil" })
  })

  it.each([undefined, "", "   ", 42, null])("fails closed for malformed executable ID %j", (scenarioId) => {
    expect(projectObservatoryIdentity({ status: "passed", scenario: { scenarioId } })).toEqual({
      canRun: false,
      id: "unavailable",
      idLabel: "Scenario ID",
      kind: "scenario",
      ruleRevision: "unknown revision"
    })
  })

  it.each([undefined, "", "   ", 42, null])("uses the executable revision fallback for %j", (ruleRevision) => {
    expect(
      projectObservatoryIdentity({ status: "passed", scenario: { ruleRevision, scenarioId: "epee.valid" } })
    ).toMatchObject({ canRun: false, ruleRevision: "unknown revision" })
  })

  it.each([undefined, "", "accepted", "rejected", 1])("fails closed for non-executable status %j", (status) => {
    expect(
      projectObservatoryIdentity({
        status,
        scenario: { ruleRevision: "fie-2026-epee", scenarioId: "epee.valid" }
      })
    ).toMatchObject({ canRun: false, idLabel: "Scenario ID", kind: "scenario" })
  })

  it("uses the separately validated planned traceability ID", () => {
    expect(
      projectObservatoryIdentity({
        status: "skipped",
        scenario: { ruleRevision: " ", scenarioId: "wrong-field", traceabilityId: "  SABRE-07 " }
      })
    ).toEqual({
      canRun: false,
      id: "SABRE-07",
      idLabel: "Requirement ID",
      kind: "requirement",
      ruleRevision: "not declared"
    })
  })

  it.each([undefined, "", " ", false, 7])("fails closed for malformed planned ID %j", (traceabilityId) => {
    expect(projectObservatoryIdentity({ status: "skipped", scenario: { traceabilityId } })).toMatchObject({
      canRun: false,
      id: "unavailable",
      idLabel: "Requirement ID",
      kind: "requirement",
      ruleRevision: "not declared"
    })
  })
})
