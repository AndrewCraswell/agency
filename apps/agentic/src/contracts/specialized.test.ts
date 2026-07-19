import { describe, expect, it } from "vitest"
import {
  CodingResultSchema,
  PlanningResultSchema,
  RepairResultSchema,
  ReviewFindingSchema,
  ReviewResultSchema,
  RoleAttemptSchema,
  repairResultSchemaFor,
  stableReviewFindingId
} from "./specialized"

const runId = "dff7a1a0-2c52-4e3f-a325-90d314f81820"
const baseCommitSha = "8c185e6bb5214b2dd27552cd5d7e7ad0349a4cf1"
const candidateCommitSha = "1234567890abcdef1234567890abcdef12345678"
const evidence = { uri: "file:///artifacts/evidence.json", sha256: "a".repeat(64) }
const limits = {
  maxTurns: 20,
  maxInputTokens: 100_000,
  maxOutputTokens: 20_000,
  maxElapsedMs: 1_800_000,
  maxEstimatedSpendUsd: 10
}
const commandResult = {
  commandId: "focused-test",
  exitCode: 0,
  stdoutArtifact: "commands/focused-test.stdout.txt",
  stderrArtifact: "commands/focused-test.stderr.txt",
  startedAt: "2026-07-19T00:00:00.000Z",
  endedAt: "2026-07-19T00:01:00.000Z",
  timedOut: false
}
const sourceWorkItem = {
  schemaVersion: "1",
  source: "linear",
  id: "b0c6449e-380d-4e37-bcc4-4c86dff6bb5d",
  identifier: "FEN-101",
  title: "Add focused profile helper tests",
  description: "Add focused unit coverage for the OpenHands profile helpers.",
  url: "https://linear.app/fencing-club/issue/FEN-101/add-focused-profile-helper-tests",
  priority: 4,
  state: { id: "7a766a80-3d80-4bd8-8143-b19f4fc8d4c7", name: "Todo", type: "unstarted" },
  team: { id: "b9c888b8-e2d4-4694-8820-065e4c65cdcb", key: "FEN", name: "Fencing Club" }
}

function roleAttempt(role: "scrum_master" | "coder" | "reviewer" | "repairer", attempt = 1) {
  const workspace =
    role === "scrum_master"
      ? null
      : {
          schemaVersion: "1",
          provider: "daytona",
          workspaceId: `${role}-workspace`,
          repositoryPath: "/workspace/repository",
          commitSha: role === "reviewer" ? candidateCommitSha : baseCommitSha,
          conversationId: `${role}-conversation`
        }
  return {
    schemaVersion: "1",
    runId,
    roleExecutionId: `${role === "scrum_master" ? "af32fd7f" : role === "coder" ? "bf32fd7f" : role === "reviewer" ? "cf32fd7f" : "df32fd7f"}-c98c-4a31-88ca-acfb99654c69`,
    role,
    attempt,
    modelProfile: {
      schemaVersion: "1",
      profileId: `${role.replace("_", "-")}-default`,
      role,
      provider: "openrouter",
      model: "openai/gpt-5.6",
      reasoningEffort: "medium"
    },
    prompt: { schemaVersion: "1", role, version: "v1", sha256: "b".repeat(64) },
    workspace,
    budget: {
      schemaVersion: "1",
      limits,
      turns: 3,
      inputTokens: 10_000,
      outputTokens: 2_000,
      elapsedMs: 60_000,
      estimatedSpendUsd: 0.25,
      actualSpendUsd: null
    },
    startedAt: "2026-07-19T00:00:00.000Z",
    endedAt: "2026-07-19T00:01:00.000Z"
  }
}

const blocker = { category: "ambiguity", message: "Acceptance behavior is unclear.", evidence: [evidence] }

const planningResult = {
  schemaVersion: "1",
  runId,
  roleAttempt: roleAttempt("scrum_master"),
  disposition: "ready",
  sourceWorkItem,
  objective: "Implement the bounded behavior.",
  acceptanceCriteria: ["The focused test passes."],
  baseCommitSha,
  relevantPaths: ["src/feature.ts"],
  contextEvidence: [evidence],
  validationCommands: [{ id: "focused-test", command: "pnpm test feature", workingDirectory: ".", timeoutMs: 300_000 }],
  pathPolicy: { allowed: ["src/**"], forbidden: [".git/**"] },
  risks: ["Existing callers depend on the current behavior."],
  dependencies: [],
  blockers: [],
  taskClass: "small",
  configuredBudget: limits
}

const codingResult = {
  schemaVersion: "1",
  runId,
  roleAttempt: roleAttempt("coder"),
  status: "completed",
  summary: "Implemented the bounded behavior and focused test.",
  baseCommitSha,
  resultingCommitSha: candidateCommitSha,
  changedFiles: ["src/feature.ts", "src/feature.test.ts"],
  patchArtifact: evidence,
  agentCommandClaims: [{ command: "pnpm test feature", claimedOutcome: "passed", summary: "Focused test passed." }],
  independentValidationResults: [commandResult],
  workspace: roleAttempt("coder").workspace,
  unresolvedBlockers: []
}

function reviewFinding(overrides: Record<string, unknown> = {}) {
  const identity = {
    runId,
    reviewAttempt: 1,
    locator: { path: "src/feature.ts", line: 42, symbol: null },
    category: "correctness" as const,
    finding: "The fallback returns the wrong value."
  }
  return {
    schemaVersion: "1",
    id: stableReviewFindingId(identity),
    ...identity,
    severity: "high",
    evidence: "The new branch returns false when the contract requires true.",
    expectedBehavior: "Return true for a configured fallback.",
    actionable: true,
    confidence: 0.95,
    ...overrides
  }
}

const reviewResult = {
  schemaVersion: "1",
  runId,
  roleAttempt: roleAttempt("reviewer"),
  reviewAttempt: 1,
  candidateCommitSha,
  disposition: "changes_requested",
  findings: [reviewFinding()],
  blockedReasons: []
}

const repairResult = {
  schemaVersion: "1",
  runId,
  roleAttempt: roleAttempt("repairer"),
  repairAttempt: 1,
  reviewedCandidateCommitSha: candidateCommitSha,
  resultingCommitSha: "abcdef1234567890abcdef1234567890abcdef12",
  status: "completed",
  addressedFindingIds: [reviewResult.findings[0].id],
  declinedFindings: [],
  remainingActionableFindingIds: [],
  changedFiles: ["src/feature.ts"],
  patchArtifact: evidence,
  independentValidationResults: [commandResult],
  workspace: roleAttempt("repairer").workspace,
  blockers: []
}

describe("specialized role metadata", () => {
  it("accepts each role attempt and rejects contradictory role metadata", () => {
    for (const role of ["scrum_master", "coder", "reviewer", "repairer"] as const) {
      expect(RoleAttemptSchema.safeParse(roleAttempt(role)).success).toBe(true)
    }

    const attempt = roleAttempt("reviewer")
    expect(RoleAttemptSchema.safeParse({ ...attempt, prompt: { ...attempt.prompt, role: "coder" } }).success).toBe(
      false
    )
    expect(
      RoleAttemptSchema.safeParse({ ...attempt, modelProfile: { ...attempt.modelProfile, role: "coder" } }).success
    ).toBe(false)
  })

  it("rejects a role attempt that ends before it starts", () => {
    expect(RoleAttemptSchema.safeParse({ ...roleAttempt("coder"), endedAt: "2026-07-18T23:59:00.000Z" }).success).toBe(
      false
    )
  })

  it("rejects unsupported contract versions", () => {
    expect(RoleAttemptSchema.safeParse({ ...roleAttempt("coder"), schemaVersion: "2" }).success).toBe(false)
  })
})

describe("PlanningResultSchema", () => {
  it("accepts a ready bounded plan", () => {
    expect(PlanningResultSchema.parse(planningResult)).toEqual(planningResult)
  })

  it("rejects contradictory ready and blocked plans", () => {
    expect(PlanningResultSchema.safeParse({ ...planningResult, blockers: [blocker] }).success).toBe(false)
    expect(PlanningResultSchema.safeParse({ ...planningResult, disposition: "blocked", blockers: [] }).success).toBe(
      false
    )
  })

  it("rejects a plan tied to a different workflow run", () => {
    expect(
      PlanningResultSchema.safeParse({ ...planningResult, runId: "9539b499-1c48-4770-ab32-da1cbda14d57" }).success
    ).toBe(false)
  })
})

describe("CodingResultSchema", () => {
  it("keeps agent claims separate from independent validation", () => {
    expect(CodingResultSchema.parse(codingResult)).toEqual(codingResult)
  })

  it("rejects completed work with unresolved blockers", () => {
    expect(CodingResultSchema.safeParse({ ...codingResult, unresolvedBlockers: [blocker] }).success).toBe(false)
  })

  it("requires blockers for incomplete work and matching run identity", () => {
    expect(CodingResultSchema.safeParse({ ...codingResult, status: "blocked" }).success).toBe(false)
    expect(
      CodingResultSchema.safeParse({ ...codingResult, runId: "9539b499-1c48-4770-ab32-da1cbda14d57" }).success
    ).toBe(false)
  })
})

describe("Review contracts", () => {
  it("normalizes finding text into a stable identity", () => {
    const first = reviewFinding()
    const second = reviewFinding({ finding: "  THE fallback\nreturns the wrong value.  " })
    expect(second.id).toBe(first.id)
    expect(ReviewFindingSchema.safeParse(second).success).toBe(true)
  })

  it("rejects a finding whose stable identity was altered", () => {
    expect(ReviewFindingSchema.safeParse(reviewFinding({ category: "security" })).success).toBe(false)
  })

  it("requires a concrete line or symbol locator", () => {
    expect(
      ReviewFindingSchema.safeParse(reviewFinding({ locator: { path: "src/feature.ts", line: null, symbol: null } }))
        .success
    ).toBe(false)
  })

  it("accepts requested changes with an actionable finding", () => {
    expect(ReviewResultSchema.parse(reviewResult)).toEqual(reviewResult)
  })

  it("rejects requested changes without an actionable finding", () => {
    const finding = reviewFinding({ actionable: false })
    expect(ReviewResultSchema.safeParse({ ...reviewResult, findings: [finding] }).success).toBe(false)
  })

  it.each([
    reviewFinding(),
    reviewFinding({ severity: "medium", actionable: false }),
    reviewFinding({ severity: "low", actionable: true })
  ])("rejects approved reviews with approval-blocking findings", (finding) => {
    expect(
      ReviewResultSchema.safeParse({ ...reviewResult, disposition: "approved", findings: [finding] }).success
    ).toBe(false)
  })

  it("accepts approval with only a non-actionable low finding", () => {
    const identity = {
      runId,
      reviewAttempt: 1,
      locator: { path: "src/feature.ts", line: 10, symbol: null },
      category: "maintainability" as const,
      finding: "A local name could be clearer."
    }
    const finding = reviewFinding({
      ...identity,
      id: stableReviewFindingId(identity),
      severity: "low",
      actionable: false
    })
    expect(
      ReviewResultSchema.safeParse({ ...reviewResult, disposition: "approved", findings: [finding] }).success
    ).toBe(true)
  })

  it("rejects duplicate and cross-review finding identities", () => {
    const finding = reviewFinding()
    expect(ReviewResultSchema.safeParse({ ...reviewResult, findings: [finding, finding] }).success).toBe(false)

    const otherIdentity = {
      runId,
      reviewAttempt: 2,
      locator: { path: "src/feature.ts", line: 42, symbol: null },
      category: "correctness" as const,
      finding: "The fallback returns the wrong value."
    }
    const otherFinding = reviewFinding({ ...otherIdentity, id: stableReviewFindingId(otherIdentity) })
    expect(ReviewResultSchema.safeParse({ ...reviewResult, findings: [otherFinding] }).success).toBe(false)
  })

  it("keeps blocked reasons consistent with the review disposition", () => {
    expect(
      ReviewResultSchema.safeParse({ ...reviewResult, disposition: "blocked", findings: [], blockedReasons: [] })
        .success
    ).toBe(false)
    expect(ReviewResultSchema.safeParse({ ...reviewResult, blockedReasons: [blocker] }).success).toBe(false)
    expect(
      ReviewResultSchema.safeParse({ ...reviewResult, disposition: "blocked", findings: [], blockedReasons: [blocker] })
        .success
    ).toBe(true)
  })

  it("rejects review output tied to another workflow run", () => {
    expect(
      ReviewResultSchema.safeParse({ ...reviewResult, runId: "9539b499-1c48-4770-ab32-da1cbda14d57" }).success
    ).toBe(false)
  })

  it("rejects malformed and unsupported review output", () => {
    expect(ReviewResultSchema.safeParse({ ...reviewResult, findings: [{ prose: "trust me" }] }).success).toBe(false)
    expect(ReviewResultSchema.safeParse({ ...reviewResult, schemaVersion: "2" }).success).toBe(false)
  })
})

describe("RepairResultSchema", () => {
  it("accepts a completed repair against the latest review", () => {
    expect(repairResultSchemaFor(reviewResult).parse(repairResult)).toEqual(repairResult)
  })

  it("rejects finding IDs absent from the latest accepted review", () => {
    const unknownFindingId = `finding_${"f".repeat(24)}`
    expect(
      repairResultSchemaFor(reviewResult).safeParse({ ...repairResult, addressedFindingIds: [unknownFindingId] })
        .success
    ).toBe(false)
  })

  it("rejects contradictory repair outcomes", () => {
    const findingId = reviewResult.findings[0].id
    expect(RepairResultSchema.safeParse({ ...repairResult, remainingActionableFindingIds: [findingId] }).success).toBe(
      false
    )
    expect(RepairResultSchema.safeParse({ ...repairResult, blockers: [blocker] }).success).toBe(false)
    expect(RepairResultSchema.safeParse({ ...repairResult, status: "blocked" }).success).toBe(false)
  })

  it("requires repair identity and candidate SHA to match the latest review", () => {
    expect(
      repairResultSchemaFor(reviewResult).safeParse({
        ...repairResult,
        runId: "9539b499-1c48-4770-ab32-da1cbda14d57"
      }).success
    ).toBe(false)
    expect(
      repairResultSchemaFor(reviewResult).safeParse({ ...repairResult, reviewedCandidateCommitSha: baseCommitSha })
        .success
    ).toBe(false)
  })

  it("rejects a remaining finding that was not actionable in the latest review", () => {
    const lowIdentity = {
      runId,
      reviewAttempt: 1,
      locator: { path: "src/feature.ts", line: 10, symbol: null },
      category: "maintainability" as const,
      finding: "A local name could be clearer."
    }
    const lowFinding = reviewFinding({
      ...lowIdentity,
      id: stableReviewFindingId(lowIdentity),
      severity: "low",
      actionable: false
    })
    const reviewWithLowFinding = { ...reviewResult, findings: [...reviewResult.findings, lowFinding] }
    expect(
      repairResultSchemaFor(reviewWithLowFinding).safeParse({
        ...repairResult,
        status: "blocked",
        blockers: [blocker],
        remainingActionableFindingIds: [lowFinding.id]
      }).success
    ).toBe(false)
  })
})
