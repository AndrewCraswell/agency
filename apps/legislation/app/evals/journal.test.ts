import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { createStageJournal, durableCallCounter, withEvaluationLock } from "./journal"

const directories: string[] = []
async function temporary() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "legislation-eval-"))
  directories.push(directory)
  return directory
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("evaluation journal", () => {
  it("reuses completed stages and rejects changed evidence", async () => {
    const journal = createStageJournal(await temporary())
    const operation = vi.fn<() => Promise<string>>().mockResolvedValue("judge result")
    await journal.stage("judge", { evidence: "original" }, z.string(), operation)
    await expect(journal.stage("judge", { evidence: "original" }, z.string(), operation)).resolves.toBe("judge result")
    await expect(journal.stage("judge", { evidence: "changed" }, z.string(), operation)).rejects.toThrow(
      "inputs changed"
    )
    expect(operation).toHaveBeenCalledTimes(1)
  })
  it("preserves the judge when a critic fails", async () => {
    const directory = await temporary()
    const journal = createStageJournal(directory)
    await journal.stage("judge", "key", z.string(), async () => "judged")
    await expect(
      journal.stage("critic", "key", z.string(), async () => {
        throw new Error("provider")
      })
    ).rejects.toThrow("provider")
    await expect(
      createStageJournal(directory).stage("judge", "key", z.string(), async () => {
        throw new Error("must not run")
      })
    ).resolves.toBe("judged")
    await expect(journal.stage("critic", "key", z.string(), async () => "recovered")).resolves.toBe("recovered")
  })
  it("excludes concurrent jobs and releases the lock on failure", async () => {
    const directory = await temporary()
    await expect(
      withEvaluationLock(async () => {
        await expect(withEvaluationLock(async () => undefined, directory)).rejects.toThrow("lock exists")
        throw new Error("job failed")
      }, directory)
    ).rejects.toThrow("job failed")
    await expect(withEvaluationLock(async () => "released", directory)).resolves.toBe("released")
  })
  it("keeps call reservations across restarts", async () => {
    const file = path.join(await temporary(), "calls.jsonl")
    durableCallCounter(file).claim()
    const restarted = durableCallCounter(file)
    expect(restarted.used).toBe(1)
    restarted.claim()
    expect(durableCallCounter(file).used).toBe(2)
  })
  it("does not automatically redispatch an interrupted candidate", async () => {
    const journal = createStageJournal(await temporary())
    await expect(
      journal.stage(
        "candidate",
        "identity",
        z.string(),
        async () => {
          throw new Error("process interrupted")
        },
        true
      )
    ).rejects.toThrow("interrupted")
    const dispatch = vi.fn<() => Promise<string>>().mockResolvedValue("new answer")
    await expect(journal.stage("candidate", "identity", z.string(), dispatch, true)).rejects.toThrow(
      "Uncheckpointed candidate"
    )
    expect(dispatch).not.toHaveBeenCalled()
  })
})
