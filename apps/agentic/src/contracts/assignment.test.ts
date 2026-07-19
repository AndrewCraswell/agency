import { describe, expect, it } from "vitest"
import { AssignmentSchema } from "./assignment"

const validAssignment = {
  schemaVersion: "1",
  runId: "dff7a1a0-2c52-4e3f-a325-90d314f81820",
  roleExecutionId: "bf32fd7f-c98c-4a31-88ca-acfb99654c69",
  repository: {
    provider: "github",
    owner: "AndrewCraswell",
    name: "fencing-club-shopify-theme"
  },
  baseCommitSha: "8c185e6bb5214b2dd27552cd5d7e7ad0349a4cf1",
  objective: "Verify that the theme passes its focused validation command.",
  acceptanceCriteria: ["The focused validation command passes."],
  relevantPaths: ["**/*"],
  validationCommands: [
    {
      id: "focused-test",
      command: "pnpm test",
      workingDirectory: ".",
      timeoutMs: 300_000
    }
  ],
  pathPolicy: {
    allowed: ["**/*"],
    forbidden: [".git/**"]
  },
  budgets: {
    maxTurns: 20,
    maxTokens: 100_000,
    maxElapsedMs: 1_800_000,
    maxRepairAttempts: 0
  },
  contextBundle: {
    uri: "file:///workspace/orchestrator-context/phase-1/manifest.json",
    sha256: "a".repeat(64)
  },
  promptVersion: "coder-v1",
  workerImageVersion: "openhands-agent-server-1"
}

describe("AssignmentSchema", () => {
  it("accepts a complete version 1 assignment", () => {
    expect(AssignmentSchema.parse(validAssignment)).toEqual(validAssignment)
  })

  it.each([
    ["unknown schema version", { schemaVersion: "2" }],
    ["non-immutable base reference", { baseCommitSha: "master" }],
    ["empty validation command", { validationCommands: [{ ...validAssignment.validationCommands[0], command: "" }] }],
    ["malformed context digest", { contextBundle: { ...validAssignment.contextBundle, sha256: "abc123" } }]
  ])("rejects %s", (_scenario, replacement) => {
    expect(AssignmentSchema.safeParse({ ...validAssignment, ...replacement }).success).toBe(false)
  })

  it("rejects unknown fields", () => {
    expect(AssignmentSchema.safeParse({ ...validAssignment, unexpected: true }).success).toBe(false)
  })
})
