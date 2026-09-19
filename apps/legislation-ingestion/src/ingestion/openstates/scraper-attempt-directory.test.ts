import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"
import { isScraperDataArtifactPath } from "./scraper-archive.js"
import { scraperAttemptDirectory } from "./scraper-attempt-directory.js"

it("reads every admitted jurisdiction through the same manifest and filesystem path contract", async () => {
  const root = await mkdtemp(join(tmpdir(), "scraper-path-test-"))
  try {
    const reader = scraperAttemptDirectory(root)
    for (const state of ["nc", "ak", "wa"]) {
      const path = `_data/${state}/bill_fixture.json`
      expect(isScraperDataArtifactPath(path)).toBe(true)
      await mkdir(join(root, "_data", state), { recursive: true })
      await writeFile(join(root, path), "{}")
      expect(Buffer.from(await reader.read(path)).toString()).toBe("{}")
    }
    for (const path of [
      "../attempt.json",
      "_data/wa/../bill.json",
      "_data/ca/bill.json",
      "_data/wa/bill.json/extra",
      "_data\\wa\\bill.json"
    ]) {
      expect(isScraperDataArtifactPath(path)).toBe(false)
      await expect(reader.read(path)).rejects.toThrow("Invalid attempt artifact path")
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
