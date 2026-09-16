import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import invariant from "tiny-invariant"
import { afterEach, describe, expect, it } from "vitest"
import { stageReviewedFrPdfRegions, validateReviewedFrRegionText } from "./fr-pdf-regions.js"

const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})
describe("reviewed Federal Register shared-page boundaries", () => {
  it("isolates the three real source documents, atomically reuses evidence and rejects altered regions", async () => {
    const output = await mkdtemp(join(tmpdir(), "fr-pdf-regions-"))
    directories.push(output)
    const path = fileURLToPath(new URL("./fixtures/fr-2000-01-18.pdf", import.meta.url))
    const results = await Promise.all([
      stageReviewedFrPdfRegions(path, output),
      stageReviewedFrPdfRegions(path, output)
    ])
    expect(results.map((row) => row.reused).sort()).toEqual([false, true])
    const result = results[0]
    invariant(result, "region_fixture_missing")
    expect(result.artifact.result.inspection).toMatchObject({
      pages: 321,
      emptyTextPages: [300],
      parserChecks: "all_pages_text_and_operators"
    })
    const documents = result.artifact.result.documents
    expect(documents.map((row) => row.nativeIdentity)).toEqual([
      "fr:2000-01-18:65:2537:rule",
      "fr:2000-01-18:65:2639:notice",
      "00-1083"
    ])
    // Golden text from the independently reviewed original columns, including all seven Minnesota numbered items.
    expect(documents.map((row) => row.textHash)).toEqual([
      "f3174c1de6924066d364ea620960ebc9fb62a4ee44734728e1b4f271a8eb7eaa",
      "4cb69056e53c54e2cd9371482d6500d2d5a9a45789daf0c3ec7a46e3fc6b094b",
      "03088a3b5a2b99d8476d2bb55e67ff7c926bb25026f752f39cd0d8afca454ca5"
    ])
    for (const row of documents) {
      expect(row.publicationReady).toBe(false)
      expect(() =>
        validateReviewedFrRegionText(row.nativeIdentity, `${row.text}\n[FR Doc. 99-999 Filed 1-1-00]`)
      ).toThrow("footer_mismatch")
      expect(() => validateReviewedFrRegionText(row.nativeIdentity, `${row.text}\n${row.excludedAnchors[0]}`)).toThrow(
        "adjacent_text"
      )
      expect(() =>
        validateReviewedFrRegionText(row.nativeIdentity, row.text.replace(/\[FR Doc\.[^\]]+\]/i, ""))
      ).toThrow("footer_mismatch")
    }
    expect((await stageReviewedFrPdfRegions(path, output)).reused).toBe(true)
    const tampered = result.artifact
    const firstRegion = tampered.result.documents[0]?.regions[0]
    invariant(firstRegion, "region_fixture_missing")
    firstRegion.top = 0
    await writeFile(result.path, JSON.stringify(tampered))
    await expect(stageReviewedFrPdfRegions(path, output)).rejects.toThrow("evidence_changed")
    const changed = Buffer.from(await readFile(path))
    changed[0] = 0
    const wrongPath = join(output, "changed.pdf")
    await writeFile(wrongPath, changed)
    await expect(stageReviewedFrPdfRegions(wrongPath, output)).rejects.toThrow("source_unreviewed")
  }, 60000)
  it("rejects unreviewed identities and text that lacks document-specific evidence", () => {
    expect(() => validateReviewedFrRegionText("00-111", "anything")).toThrow("identity_unreviewed")
    expect(() => validateReviewedFrRegionText("00-1083", "[FR Doc. 00-1083 Filed 1-14-00]")).toThrow("anchor_missing")
  })
})
