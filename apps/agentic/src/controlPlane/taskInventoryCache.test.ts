import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { LinearTaskGraphNodeSchema } from "../contracts/linear"
import { FileTaskInventoryCache } from "./taskInventoryCache"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function cachePath(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "task-inventory-"))
  roots.push(root)
  return join(root, "nested", "inventory.json")
}

const task = LinearTaskGraphNodeSchema.parse({
  schemaVersion: "1",
  source: "linear",
  id: "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57",
  identifier: "FEN-42",
  title: "Add tests",
  description: "Add focused tests.",
  url: "https://linear.app/example/FEN-42",
  priority: 2,
  createdAt: "2026-07-18T12:00:00.000Z",
  updatedAt: "2026-07-19T12:00:00.000Z",
  state: { id: "dff7a1a0-2c52-4e3f-a325-90d314f81820", name: "Todo", type: "unstarted" },
  team: { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "FEN", name: "Frontend" },
  project: null,
  blockedBy: [],
  blocks: []
})

describe("FileTaskInventoryCache", () => {
  it("returns null when no durable inventory exists", async () => {
    const cache = new FileTaskInventoryCache(await cachePath())

    await expect(cache.load()).resolves.toBeNull()
  })

  it("atomically persists and restores validated task inventory", async () => {
    const path = await cachePath()
    const cache = new FileTaskInventoryCache(path)

    await cache.save([task])

    await expect(cache.load()).resolves.toEqual([task])
    await expect(readFile(path, "utf8")).resolves.toMatch(/"schemaVersion": "1"/u)
  })

  it("rejects malformed persisted inventory", async () => {
    const path = await cachePath()
    await new FileTaskInventoryCache(path).save([task])
    await writeFile(path, '{"schemaVersion":"1","tasks":"invalid"}', "utf8")

    await expect(new FileTaskInventoryCache(path).load()).rejects.toThrow()
  })
})
