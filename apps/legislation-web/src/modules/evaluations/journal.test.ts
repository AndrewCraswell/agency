import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { digest } from "./contracts"
import { createStageJournal, durableCallCounter, snapshotSources, withEvaluationLock } from "./journal"

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
  it("records tracked source deletions without dropping them from a deterministic inventory", async () => {
    const root = await temporary()
    await writeFile(path.join(root, "present.ts"), "source")
    expect(await snapshotSources(root, ["present.ts", "deleted.ts", "present.ts"], new Set(["deleted.ts"]))).toEqual([
      { file: "deleted.ts", hash: null },
      { file: "present.ts", hash: digest("source") }
    ])
  })

  it("hashes a source restored after Git reported it deleted", async () => {
    const root = await temporary()
    await writeFile(path.join(root, "restored.ts"), "restored")
    expect(await snapshotSources(root, ["restored.ts"], new Set(["restored.ts"]))).toEqual([
      { file: "restored.ts", hash: digest("restored") }
    ])
  })

  it("surfaces missing sources not reported deleted and other read failures", async () => {
    const root = await temporary()
    await expect(snapshotSources(root, ["missing.ts"], new Set())).rejects.toMatchObject({ code: "ENOENT" })
    await mkdir(path.join(root, "directory.ts"))
    await expect(snapshotSources(root, ["directory.ts"], new Set(["directory.ts"]))).rejects.toMatchObject({
      code: "EISDIR"
    })
  })

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
