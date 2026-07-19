import { mkdtemp, rm } from "node:fs/promises"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, normalize } from "node:path"
import { describe, expect, it } from "vitest"
import { AssignmentSchema } from "../contracts/assignment"
import { phase2ArtifactRoot } from "./runtime"
import { createInitialGraphState } from "./state"
import {
  cancellationRequestPath,
  clearWorkflowCancellationRequest,
  hasWorkflowCancellationRequest,
  readWorkflowState,
  requestWorkflowCancellation,
  workflowStatePath,
  writeWorkflowState
} from "./store"

const fixtureUrl = new URL("../../tests/fixtures/phase-1-repair-assignment.json", import.meta.url)

describe("local Phase 2 state store", () => {
  it("persists and reconstructs graph state through the schema", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "phase-2-state-"))
    try {
      const assignment = AssignmentSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")))
      const state = createInitialGraphState(assignment)

      await expect(writeWorkflowState(temporaryRoot, state)).resolves.toBe(workflowStatePath(temporaryRoot))
      await expect(readWorkflowState(temporaryRoot)).resolves.toEqual(state)
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })

  it("derives artifacts from the package directory instead of the process working directory", () => {
    const root = normalize(phase2ArtifactRoot("run-1"))

    expect(root).toMatch(/[\\/]apps[\\/]agentic[\\/]artifacts[\\/]run-1$/u)
    expect(root).not.toMatch(/[\\/]apps[\\/]agentic[\\/]apps[\\/]agentic[\\/]/u)
  })

  it("records and clears a local cancellation request", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "phase-2-cancel-"))
    try {
      await expect(hasWorkflowCancellationRequest(temporaryRoot)).resolves.toBe(false)
      await expect(requestWorkflowCancellation(temporaryRoot)).resolves.toBe(cancellationRequestPath(temporaryRoot))
      await expect(hasWorkflowCancellationRequest(temporaryRoot)).resolves.toBe(true)
      await clearWorkflowCancellationRequest(temporaryRoot)
      await expect(hasWorkflowCancellationRequest(temporaryRoot)).resolves.toBe(false)
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })
})
