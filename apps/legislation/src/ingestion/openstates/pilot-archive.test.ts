import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { northCarolinaPeopleSource } from "./people-repository.js"
import { archivePeoplePilot, readArchivedPeoplePilot } from "./pilot-archive.js"

class MemoryStore implements ArtifactStore {
  objects = new Map<string, Uint8Array>()
  async exists(path: string) {
    return this.objects.has(path)
  }
  async put(path: string, bytes: Uint8Array) {
    if (this.objects.has(path)) {
      return false
    }
    this.objects.set(path, bytes)
    return true
  }
  async read(path: string) {
    const bytes = this.objects.get(path)
    if (!bytes) {
      throw new Error("Missing artifact")
    }
    return bytes
  }
}
function fixture(directory = "legislature", state = "nc") {
  const source = new MemoryStore()
  const path = `data/${state}/${directory}/person.yml`
  const bytes = Buffer.from("id: ocd-person/test\nname: Test")
  source.objects.set(path, bytes)
  source.objects.set(
    "report.json",
    Buffer.from(
      JSON.stringify({
        revision: northCarolinaPeopleSource.revision,
        retrievedAt: "2026-09-14T00:00:00Z",
        artifacts: [{ path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }]
      })
    )
  )
  source.objects.set(
    "tree.json",
    Buffer.from(
      JSON.stringify({ sha: northCarolinaPeopleSource.revision, truncated: false, tree: [{ path, type: "blob" }] })
    )
  )
  return { source, path }
}
describe("pilot archive", () => {
  it("reuses archive replay for Alaska while rejecting a cross-state source", async () => {
    const { source } = fixture("legislature", "ak")
    const target = new MemoryStore()
    await expect(archivePeoplePilot(source, target, "wrong-state")).rejects.toThrow("pattern")
    expect(target.objects.size).toBe(0)
    const archive = await archivePeoplePilot(source, target, "alaska", "entities", "ak")
    const replay = await readArchivedPeoplePilot(target, archive.manifestPath)
    expect(replay.state).toBe("ak")
    expect(replay.files[0]?.path).toBe("data/ak/legislature/person.yml")
    expect(await archivePeoplePilot(source, target, "alaska", "entities", "ak")).toEqual(archive)
  })
  it("archives historical sources separately and replays them", async () => {
    const { source } = fixture("retired")
    const target = new MemoryStore()
    const result = await archivePeoplePilot(source, target, "history-1", "history")
    expect(result.manifestPath).toContain("/nc/history/")
    const replay = await readArchivedPeoplePilot(target, result.manifestPath)
    expect(replay.lane).toBe("history")
    expect(replay.files).toHaveLength(1)
    expect(await archivePeoplePilot(source, target, "history-1", "history")).toEqual(result)
  })
  it("rejects historical files in the current-entity lane before upload", async () => {
    const { source } = fixture("retired")
    const target = new MemoryStore()
    await expect(archivePeoplePilot(source, target, "run-1")).rejects.toThrow(/pattern/)
    expect(target.objects.size).toBe(0)
  })
  it("rejects current files in the historical lane before upload", async () => {
    const { source } = fixture()
    const target = new MemoryStore()
    await expect(archivePeoplePilot(source, target, "run-1", "history")).rejects.toThrow(/pattern/)
    expect(target.objects.size).toBe(0)
  })
  it("archives, replays and retries without overwriting", async () => {
    const { source } = fixture()
    const target = new MemoryStore()
    const result = await archivePeoplePilot(source, target, "run-1")
    expect((await readArchivedPeoplePilot(target, result.manifestPath)).files).toHaveLength(1)
    expect(await archivePeoplePilot(source, target, "run-1")).toEqual(result)
    expect(target.objects.size).toBe(4)
  })
  it("publishes no completion marker when an existing path conflicts", async () => {
    const { source } = fixture()
    const target = new MemoryStore()
    target.objects.set(
      `openstates/people/${northCarolinaPeopleSource.revision}/nc/entities/run-1/files/report.json`,
      Buffer.from("conflict")
    )
    await expect(archivePeoplePilot(source, target, "run-1")).rejects.toThrow("conflict")
    expect([...target.objects.keys()].some((path) => path.endsWith("complete.json"))).toBe(false)
  })
  it("rejects damaged raw source before uploading", async () => {
    const { source, path } = fixture()
    source.objects.set(path, Buffer.from("bad"))
    const target = new MemoryStore()
    await expect(archivePeoplePilot(source, target, "run-1")).rejects.toThrow("checksum")
    expect(target.objects.size).toBe(0)
  })
  it("rejects post-upload corruption on replay", async () => {
    const { source, path } = fixture()
    const target = new MemoryStore()
    const result = await archivePeoplePilot(source, target, "run-1")
    target.objects.set(result.manifestPath.replace("complete.json", `files/${path}`), Buffer.from("changed"))
    await expect(readArchivedPeoplePilot(target, result.manifestPath)).rejects.toThrow("checksum")
  })
})
