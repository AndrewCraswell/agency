import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { artifactPath, LocalArtifactStore } from "./artifact-store.js"

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

describe("local artifact storage", () => {
  it("stores deterministic immutable artifacts inside its app boundary", async () => {
    const root = await mkdtemp(join(tmpdir(), "legislation-artifacts-"))
    directories.push(root)
    const store = new LocalArtifactStore(root)
    const path = artifactPath("govinfo", "bill:us:119:hr:1:document:ih", "a".repeat(64), "https://example.test/ih.xml")
    await store.put(path, new TextEncoder().encode("first"))
    await store.put(path, new TextEncoder().encode("second"))

    await expect(store.exists(path)).resolves.toBe(true)
    await expect(readFile(join(root, path), "utf8")).resolves.toBe("first")
    await expect(store.put("../outside", new Uint8Array())).rejects.toThrow("escapes")
  })
})
