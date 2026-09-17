import { zipSync } from "fflate"
import { describe, expect, it } from "vitest"
import type { ArtifactStore } from "../documents/artifact-store.js"
import {
  archivePeopleRepositoryRevision,
  downloadPeopleRepositoryRevision,
  resolvePeopleRepositoryRevision
} from "./people-source-acquisition.js"
import { readArchivedPeoplePilot } from "./pilot-archive.js"

const revision = "0123456789abcdef0123456789abcdef01234567"

class MemoryStore implements ArtifactStore {
  readonly objects = new Map<string, Uint8Array>()

  async exists(path: string) {
    return this.objects.has(path)
  }

  async put(path: string, bytes: Uint8Array) {
    if (this.objects.has(path)) return false
    this.objects.set(path, bytes)
    return true
  }

  async read(path: string) {
    const bytes = this.objects.get(path)
    if (!bytes) throw new Error(`Missing test object: ${path}`)
    return bytes
  }
}

describe("Open States people source acquisition", () => {
  it("resolves the exact main-branch revision", async () => {
    const fetcher = async () => Response.json({ object: { sha: revision } })
    await expect(resolvePeopleRepositoryRevision(fetcher as typeof fetch)).resolves.toBe(revision)
  })

  it("downloads only supported Alaska and North Carolina source files", async () => {
    const archive = zipSync({
      [`people-${revision}/data/ak/legislature/a.yml`]: Buffer.from("id: person-a"),
      [`people-${revision}/data/nc/committees/c.yaml`]: Buffer.from("id: committee-c"),
      [`people-${revision}/data/ca/legislature/ignored.yml`]: Buffer.from("ignored"),
      [`people-${revision}/README.md`]: Buffer.from("ignored")
    })
    const fetcher = async () => new Response(archive, { status: 200 })
    await expect(downloadPeopleRepositoryRevision(revision, fetcher as typeof fetch)).resolves.toEqual([
      { path: "data/ak/legislature/a.yml", content: "id: person-a" },
      { path: "data/nc/committees/c.yaml", content: "id: committee-c" }
    ])
  })

  it("archives both immutable lanes at a newly resolved revision", async () => {
    const store = new MemoryStore()
    const result = await archivePeopleRepositoryRevision(store, {
      files: [
        { path: "data/ak/legislature/a.yml", content: "id: person-a" },
        { path: "data/ak/committees/c.yml", content: "id: committee-c" },
        { path: "data/ak/retired/r.yml", content: "id: person-r" }
      ],
      retrievedAt: new Date("2026-09-17T06:17:00.000Z"),
      revision,
      state: "ak"
    })
    const [current, history] = await Promise.all([
      readArchivedPeoplePilot(store, result.currentManifestPath),
      readArchivedPeoplePilot(store, result.historyManifestPath)
    ])
    expect(current).toMatchObject({ revision, state: "ak", lane: "entities" })
    expect(history).toMatchObject({ revision, state: "ak", lane: "history" })
  })
})
