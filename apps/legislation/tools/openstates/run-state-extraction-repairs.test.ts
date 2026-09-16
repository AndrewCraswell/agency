import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { expect, it } from "vitest"

const execute = promisify(execFile)
const script = fileURLToPath(new URL("./run-state-extraction-repairs.ts", import.meta.url))

it("plans deterministically and rejects changed or out-of-scope evidence before dispatch", async () => {
  const directory = await mkdtemp(join(tmpdir(), "state-repair-dispatch-"))
  const path = join(directory, "payload.json")
  const payload = {
    state: "nc",
    session: "2025",
    extractionRepairs: [
      {
        documentId: "document:fixture",
        billId: "bill:nc:2025:hb:1",
        sourceUrl: "https://www.ncleg.gov/fixture.pdf",
        sourceSha256: "a".repeat(64),
        previousTextHash: "b".repeat(32)
      }
    ]
  }
  const bytes = JSON.stringify(payload)
  const digest = createHash("sha256").update(bytes).digest("hex")
  const invoke = (hash: string) =>
    execute(
      process.execPath,
      ["--import", "tsx", script, "--payload", path, "--sha256", hash, "--version", "20260916.1"],
      { timeout: 20_000 }
    )
  try {
    await writeFile(path, bytes)
    const first = await invoke(digest)
    expect(JSON.parse(first.stdout)).toMatchObject({
      state: "nc",
      session: "2025",
      candidates: 1,
      dispatched: false,
      version: "20260916.1",
      idempotencyKey: `state-extraction-repair:nc:20260916.1:${digest}`
    })
    expect((await invoke(digest)).stdout).toBe(first.stdout)
    await expect(
      execute(
        process.execPath,
        ["--import", "tsx", script, "--payload", path, "--sha256", digest, "--version", "20260916.1", "--apply"],
        { timeout: 20_000 }
      )
    ).rejects.toThrow("ZodError")
    await expect(invoke("0".repeat(64))).rejects.toThrow("Repair payload checksum mismatch")
    const changed = JSON.stringify({ ...payload, state: "ak" })
    await writeFile(path, changed)
    await expect(invoke(createHash("sha256").update(changed).digest("hex"))).rejects.toThrow("outside")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 30_000)
