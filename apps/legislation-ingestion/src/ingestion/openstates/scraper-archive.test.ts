import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { archiveScraperAttempt, assertSuccessfulScraperAttempt, readArchivedScraperAttempt } from "./scraper-archive.js"

it.each([
  { status: "failed", reason: "source_timeout", exit_code: 1 },
  { status: "failed", reason: "source_http_rate_limited", exit_code: 1 },
  { status: "timed_out", reason: "execution_deadline", exit_code: null },
  { status: "rejected", reason: "source_validation_failure", exit_code: 1 }
] as const)("surfaces the retained failure reason without permitting promotion: $reason", (attempt) => {
  expect(() => assertSuccessfulScraperAttempt(attempt)).toThrow(
    `Scraper extraction ${attempt.status}: ${attempt.reason} (exit ${attempt.exit_code ?? "unknown"})`
  )
})

it("does not infer a failure reason when absent and admits validated extraction success", () => {
  expect(() => assertSuccessfulScraperAttempt({ status: "failed", reason: null, exit_code: null })).toThrow(
    "Scraper extraction failed: unspecified_failure (exit unknown)"
  )
  expect(() => assertSuccessfulScraperAttempt({ status: "extracted", reason: null, exit_code: 0 })).not.toThrow()
})

class Store implements ArtifactStore {
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
function fixture() {
  const source = new Store()
  const path = "_data/nc/bill_fixture.json"
  const bytes = Buffer.from('{"fixture":true}')
  const revision = "d43f853796ceeeb49205f7d144790647764ce105"
  const attempt = {
    work_directory: "/private/local/path",
    status: "extracted",
    exit_code: 0,
    revision,
    canonical_writes: false,
    semantically_validated: false,
    reason: null,
    request: { jurisdiction: "nc", domain: "bills", session: "2025", timeout_seconds: 1200, revision },
    files: [{ path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }]
  }
  source.objects.set(path, bytes)
  function save(value: unknown = attempt) {
    source.objects.set("attempt.json", Buffer.from(JSON.stringify(value)))
  }
  save()
  return { source, path, attempt, save }
}

describe("scraper attempt archive", () => {
  it("retains Alaska through the shared writer and rejects cross-state inventory and manifest paths", async () => {
    const { source, path, attempt, save } = fixture()
    const akPath = path.replace("/nc/", "/ak/")
    source.objects.set(akPath, await source.read(path))
    const alaska = {
      ...attempt,
      request: { ...attempt.request, jurisdiction: "ak", session: "34", bill_ids: ["HB1"] },
      files: attempt.files.map((file) => ({ ...file, path: akPath }))
    }
    save(alaska)
    const target = new Store()
    const retained = await archiveScraperAttempt(source, target, "alaska-test")
    expect((await readArchivedScraperAttempt(target, retained.manifestPath)).attempt.request.jurisdiction).toBe("ak")
    const wrongPath = retained.manifestPath.replace("/ak/", "/nc/")
    target.objects.set(wrongPath, await target.read(retained.manifestPath))
    await expect(readArchivedScraperAttempt(target, wrongPath)).rejects.toThrow("identity mismatch")
    save({ ...alaska, files: attempt.files })
    await expect(archiveScraperAttempt(source, new Store(), "cross-state")).rejects.toThrow("Cross-jurisdiction")
    save({ ...alaska, request: { ...alaska.request, domain: "events", session: null, bill_ids: null } })
    await expect(archiveScraperAttempt(source, new Store(), "unapproved-events")).rejects.toThrow(/Invalid/)
  })
  it("retains the verified build fingerprint and rejects malformed provenance", async () => {
    const { source, attempt, save } = fixture()
    const fingerprint = createHash("sha256").update("approved build").digest("hex")
    save({ ...attempt, build_inputs_sha256: fingerprint })
    const target = new Store()
    const result = await archiveScraperAttempt(source, target, "provenance-1")
    expect((await readArchivedScraperAttempt(target, result.manifestPath)).attempt.build_inputs_sha256).toBe(
      fingerprint
    )
    save({ ...attempt, build_inputs_sha256: "main" })
    await expect(archiveScraperAttempt(source, new Store(), "invalid-provenance")).rejects.toThrow(/Invalid/)
  })
  it("retains explicit batches and rejects invalid scopes", async () => {
    const { source, attempt, save } = fixture()
    save({ ...attempt, request: { ...attempt.request, bill_ids: ["S2", "S10"] } })
    const target = new Store()
    const retained = await archiveScraperAttempt(source, target, "batch-1")
    expect((await readArchivedScraperAttempt(target, retained.manifestPath)).attempt.request.bill_ids).toEqual([
      "S2",
      "S10"
    ])
    for (const bill_ids of [
      [],
      ["S1", "S1"],
      ["S1", "H1"],
      ["S01"],
      null,
      Array.from({ length: 11 }, (_, index) => `S${index + 1}`)
    ]) {
      save({ ...attempt, request: { ...attempt.request, bill_ids } })
      const rejected = new Store()
      await expect(archiveScraperAttempt(source, rejected, "invalid-batch")).rejects.toThrow(
        /Invalid|Too small|Too big/
      )
      expect(rejected.objects.size).toBe(0)
    }
  })
  it("retains, verifies and replays without claiming semantic acceptance or overwriting", async () => {
    const { source } = fixture()
    const target = new Store()
    const result = await archiveScraperAttempt(source, target, "run-1")
    expect(await archiveScraperAttempt(source, target, "run-1")).toEqual(result)
    const replay = await readArchivedScraperAttempt(target, result.manifestPath)
    expect(replay.attempt.semantically_validated).toBe(false)
    expect(replay.attempt.canonical_writes).toBe(false)
    expect(replay.attempt).not.toHaveProperty("work_directory")
    expect(target.objects.size).toBe(2)
  })
  it("retains failures with no raw files without promoting them to success", async () => {
    const { source, attempt, save } = fixture()
    save({ ...attempt, status: "timed_out", exit_code: null, reason: "execution_deadline", files: [] })
    const target = new Store()
    const result = await archiveScraperAttempt(source, target, "timeout-1")
    expect(result.status).toBe("timed_out")
    expect((await readArchivedScraperAttempt(target, result.manifestPath)).attempt.files).toEqual([])
  })
  it.each([
    "source_timeout",
    "source_tls_failure",
    "source_http_failure",
    "source_http_rate_limited",
    "source_http_access_denied",
    "source_http_not_found",
    "source_http_server_error",
    "source_parse_failure",
    "source_validation_failure",
    "subprocess_failure"
  ])("retains safe diagnostic category %s without converting a failure into success", async (reason) => {
    const { source, attempt, save } = fixture()
    save({ ...attempt, status: "failed", exit_code: 1, reason, files: [] })
    const target = new Store()
    const result = await archiveScraperAttempt(source, target, "failure-1")
    const replay = await readArchivedScraperAttempt(target, result.manifestPath)
    expect(replay.attempt.reason).toBe(reason)
    expect(replay.attempt.status).toBe("failed")
    expect(replay.attempt.canonical_writes).toBe(false)
  })
  it("rejects inconsistent success, duplicate paths, unsafe paths and invalid lane payloads before upload", async () => {
    const { source, attempt, save } = fixture()
    for (const changes of [
      { exit_code: 1 },
      { files: [] },
      { files: [...attempt.files, ...attempt.files] },
      { files: [{ ...attempt.files[0], path: "../secret.json" }] },
      { request: { ...attempt.request, domain: "events" } },
      { canonical_writes: true }
    ]) {
      save({ ...attempt, ...changes })
      const target = new Store()
      await expect(archiveScraperAttempt(source, target, "run-1")).rejects.toThrow(/Invalid|Inconsistent/)
      expect(target.objects.size).toBe(0)
    }
  })
  it("detects source corruption before upload", async () => {
    const { source, path } = fixture()
    source.objects.set(path, Buffer.from("changed"))
    const target = new Store()
    await expect(archiveScraperAttempt(source, target, "run-1")).rejects.toThrow("checksum")
    expect(target.objects.size).toBe(0)
  })
  it("does not publish a marker when an immutable target file conflicts", async () => {
    const { source, path, attempt } = fixture()
    const target = new Store()
    target.objects.set(`openstates/scrapers/${attempt.revision}/nc/bills/run-1/files/${path}`, Buffer.from("changed"))
    await expect(archiveScraperAttempt(source, target, "run-1")).rejects.toThrow("checksum")
    expect([...target.objects.keys()].some((path) => path.endsWith("retained.json"))).toBe(false)
  })
  it("detects post-upload corruption and archive identity substitution", async () => {
    const { source, path } = fixture()
    const target = new Store()
    const { manifestPath } = await archiveScraperAttempt(source, target, "run-1")
    const changed = manifestPath.replace("/run-1/", "/run-2/")
    target.objects.set(changed, await target.read(manifestPath))
    await expect(readArchivedScraperAttempt(target, changed)).rejects.toThrow("identity")
    target.objects.set(manifestPath.replace("retained.json", `files/${path}`), Buffer.from("bad"))
    await expect(readArchivedScraperAttempt(target, manifestPath)).rejects.toThrow("checksum")
    await expect(readArchivedScraperAttempt(target, "../retained.json")).rejects.toThrow("path")
  })
})
