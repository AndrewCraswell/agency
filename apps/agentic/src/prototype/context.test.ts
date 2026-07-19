import { describe, expect, it } from "vitest"
import { AssignmentSchema } from "../contracts/assignment"
import { createContextBundle, findPathPolicyViolations, sha256 } from "./context"

const assignment = AssignmentSchema.parse({
  schemaVersion: "1",
  runId: "2d3d72dc-14ef-4e84-a516-1c5424efec45",
  roleExecutionId: "e4ee7d9b-1dcf-48a6-83e3-66724cd6e6ce",
  repository: { provider: "github", owner: "AndrewCraswell", name: "fencing-club-shopify-theme" },
  baseCommitSha: "8c185e6bb5214b2dd27552cd5d7e7ad0349a4cf1",
  objective: "Make the focused repair.",
  acceptanceCriteria: ["The focused test passes."],
  relevantPaths: ["sections/**"],
  validationCommands: [{ id: "focused-test", command: "pnpm test", workingDirectory: ".", timeoutMs: 120_000 }],
  pathPolicy: { allowed: ["sections/**", "tests/**"], forbidden: ["sections/locked/**"] },
  budgets: { maxTurns: 10, maxTokens: 20_000, maxElapsedMs: 600_000, maxRepairAttempts: 2 },
  contextBundle: { uri: "https://context.invalid/bundle", sha256: "a".repeat(64) },
  promptVersion: "coder-v1",
  workerImageVersion: "1.36.1"
})

describe("createContextBundle", () => {
  it("builds a deterministic manifest with verified digests and provenance", () => {
    const first = createContextBundle(assignment)
    const second = createContextBundle(assignment)
    const manifest = JSON.parse(first[0]?.content.toString() ?? "[]") as Array<Record<string, unknown>>

    expect(first.map(({ relativePath, sha256: digest }) => ({ relativePath, digest }))).toEqual(
      second.map(({ relativePath, sha256: digest }) => ({ relativePath, digest }))
    )
    expect(manifest).toHaveLength(4)
    expect(manifest[0]).toMatchObject({
      provenance: "validated-assignment",
      trust: "trusted-orchestrator-input"
    })
    expect(first.every((artifact) => sha256(artifact.content) === artifact.sha256)).toBe(true)
    expect(Buffer.concat(first.map((artifact) => artifact.content)).toString()).not.toContain("token")
  })
})

describe("findPathPolicyViolations", () => {
  it("applies forbidden patterns before allowed patterns", () => {
    expect(
      findPathPolicyViolations(assignment, ["sections/header.liquid", "sections/locked/index.liquid", "README.md"])
    ).toEqual(["sections/locked/index.liquid", "README.md"])
  })
})
