import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { PlanningResultSchema } from "../contracts/specialized"
import { assignmentFromPlan } from "./planAssignment"

const fixtureUrl = new URL("../../tests/fixtures/planning-result-ready.json", import.meta.url)

describe("assignmentFromPlan", () => {
  it("maps a ready plan and trusted repository into a bounded three-repair assignment", async () => {
    const plan = PlanningResultSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")))

    const assignment = assignmentFromPlan(
      plan,
      { provider: "github", owner: "AndrewCraswell", name: "agency" },
      () => "60deb42e-f436-4ad2-acb7-02c481bce492"
    )

    expect(assignment).toMatchObject({
      runId: plan.runId,
      repository: { owner: "AndrewCraswell", name: "agency" },
      objective: plan.objective,
      budgets: { maxRepairAttempts: 3 }
    })
  })
})
