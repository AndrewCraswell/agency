import { appendFileSync, readFileSync } from "node:fs"
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { assertSafeArtifact, digest } from "./contracts"

function isMissing(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

export class CheckpointMismatch extends Error {}

export async function snapshotSources(root: string, files: readonly string[], deleted: ReadonlySet<string>) {
  return Promise.all(
    [...new Set(files)].sort().map(async (file) => {
      try {
        return { file, hash: digest(await readFile(path.join(root, file), "utf8")) }
      } catch (error) {
        if (!deleted.has(file) || !isMissing(error)) {
          throw error
        }
        return { file, hash: null }
      }
    })
  )
}

export async function withEvaluationLock<Result>(
  operation: () => Promise<Result>,
  lockDirectory = fileURLToPath(new URL("../../../tmp/agent-evaluations", import.meta.url))
) {
  await mkdir(lockDirectory, { recursive: true })
  const file = path.join(lockDirectory, "active.lock")
  let handle
  try {
    handle = await open(file, "wx")
  } catch {
    throw new Error(
      `Evaluation lock exists or is inaccessible: ${file}. Verify its owner is stopped before removing a stale lock.`
    )
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
    await handle.sync()
    return await operation()
  } finally {
    await handle.close()
    await unlink(file)
  }
}

export async function writeArtifact(file: string, value: unknown) {
  assertSafeArtifact(value)
  const temporary = `${file}.${crypto.randomUUID()}.tmp`
  await mkdir(path.dirname(file), { recursive: true })
  const handle = await open(temporary, "wx")
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`)
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporary, file)
}

export function createStageJournal(directory: string) {
  return {
    async stage<Value>(
      name: string,
      identity: unknown,
      schema: z.ZodType<Value>,
      operation: () => Promise<Value>,
      protectDispatch = false
    ) {
      if (!/^[a-z0-9_-]+$/.test(name)) {
        throw new Error("Invalid stage name")
      }
      const key = digest(identity)
      const file = path.join(directory, `${name}.checkpoint.json`)
      try {
        const saved = z.object({ key: z.string(), value: schema }).parse(JSON.parse(await readFile(file, "utf8")))
        if (saved.key !== key) {
          throw new CheckpointMismatch(`Checkpoint inputs changed for ${name}; start a new run.`)
        }
        return saved.value
      } catch (error) {
        if (!isMissing(error)) {
          throw error
        }
      }
      if (protectDispatch) {
        await mkdir(directory, { recursive: true })
        let marker
        try {
          marker = await open(path.join(directory, `${name}.dispatch.json`), "wx")
        } catch {
          throw new CheckpointMismatch(
            `Uncheckpointed candidate dispatch exists for ${name}; reconcile it before rerunning.`
          )
        }
        try {
          await marker.writeFile(JSON.stringify({ key, startedAt: new Date().toISOString() }))
          await marker.sync()
        } finally {
          await marker.close()
        }
      }
      const value = schema.parse(await operation())
      await writeArtifact(file, { key, value })
      return value
    }
  }
}

export function durableCallCounter(file: string) {
  let used = 0
  try {
    const lines = readFileSync(file, "utf8").trim().split("\n").filter(Boolean)
    for (const line of lines) {
      const entry = z.object({ call: z.number().int().positive() }).parse(JSON.parse(line))
      if (entry.call !== used + 1) {
        throw new Error("Corrupt evaluation call ledger")
      }
      used = entry.call
    }
  } catch (error) {
    if (!isMissing(error)) {
      throw error
    }
  }
  return {
    get used() {
      return used
    },
    claim() {
      appendFileSync(file, `${JSON.stringify({ call: used + 1, startedAt: new Date().toISOString() })}\n`, {
        flush: true
      })
      used++
    }
  }
}
