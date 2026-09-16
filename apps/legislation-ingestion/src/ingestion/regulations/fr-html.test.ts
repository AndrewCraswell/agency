import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digest, officialUrl } from "@repo/legislation-core/legal-text/contracts"
import { afterEach, describe, expect, it, vi } from "vitest"
import { acquireFrHtml, parseFrHtml } from "./fr-html.js"
import { frMetadataPageSchema } from "./fr-metadata-contract.js"
import { frSubjectKey } from "./fr-subject.js"
import { RegulatorySourceClient } from "./source-client.js"

const fixture = frMetadataPageSchema.parse(
  JSON.parse(await readFile(new URL("./fixtures/fr-2024-01-02-metadata.json", import.meta.url), "utf8"))
)
const original = fixture.results[0]
if (!original) {
  throw new Error("Missing fixture record")
}
const record = {
  ...original,
  document_number: "99-33595",
  publication_date: "2000-01-03",
  volume: 65,
  type: "Notice",
  start_page: 137,
  end_page: 138,
  pdf_url: "https://www.govinfo.gov/content/pkg/FR-2000-01-03/pdf/99-33595.pdf"
}
const html = `<html><body><pre>[Federal Register Volume 65, Number 1 (Monday, January 3, 2000)]
[Notices]
[Pages 137-138]
[FR Doc No: 99-33595]
${record.title}
Text with &amp; punctuation.\n    Indented source text.
[FR Doc. 99-33595 Filed 12-30-99; 8:45 am]
BILLING CODE 4510-27-M</pre></body></html>`
const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})

describe("document-specific FR HTML rendition", () => {
  it("compares publisher quote and line-wrap conventions without changing subjects", () => {
    expect(frSubjectKey("Definition of ``Plan Assets''--\nParticipant Contributions")).toBe(
      frSubjectKey("Definition of “Plan Assets”-Participant Contributions")
    )
    expect(frSubjectKey("Industrial-\n Commercial Units")).toBe(frSubjectKey("Industrial-Commercial Units"))
    expect(frSubjectKey("Hobbs airspace")).not.toBe(frSubjectKey("Minnesota land notice"))
  })
  it("preserves publisher spacing while verifying identity, date, type and pages", () => {
    expect(parseFrHtml(html, record)).toMatchObject({ documentNumber: "99-33595", publicationReady: false })
    expect(parseFrHtml(html, record).text).toContain("& punctuation.\n    Indented")
  })
  it.each([
    [html.replace(record.title, "An unrelated publication subject"), "subject_mismatch"],
    [html.replace("No: 99-33595", "No: 99-335950"), "document_identity"],
    [html.replace("January 3", "January 4"), "publication_date"],
    [html.replace("137-138", "137-139"), "page_range"],
    [html.replace("[Notices]", "[Proposed Rules]"), "publication_kind"],
    [html.replace("</pre>", "[FR Doc. 99-34038 Filed 12-30-99]</pre>"), "publication_boundary"],
    ["<html>Access denied</html>", "unexpected_structure"]
  ])("rejects mismatched source assertions", (body, message) => {
    expect(() => parseFrHtml(body, record)).toThrow(message)
  })
  it("acquires bounded official content, replays it offline, and rejects changed raw bytes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fr-html-"))
    directories.push(directory)
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response(html, { headers: { "content-type": "text/html" } })
    )
    const client = new RegulatorySourceClient({ fetch, minimumIntervalMs: 0 })
    const input = { record, metadataManifestId: digest("metadata"), directory }
    const first = await acquireFrHtml(input, client)
    expect(first.reused).toBe(false)
    expect((await acquireFrHtml(input, client)).reused).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    await writeFile(join(directory, "blobs", `${first.receipt.sha256}.htm`), "corrupt")
    await expect(acquireFrHtml(input, client)).rejects.toThrow("source_hash_mismatch")
  })
  it("does not broaden the official-source guard to arbitrary HTML or other source types", () => {
    expect(
      officialUrl("https://www.govinfo.gov/content/pkg/FR-2000-01-03/html/99-33595.htm", "govinfo-fr").hostname
    ).toBe("www.govinfo.gov")
    expect(() =>
      officialUrl("https://www.govinfo.gov/content/pkg/FR-2000-01-03/html/99-33595.htm?x=1", "govinfo-fr")
    ).toThrow("Unexpected")
    expect(() =>
      officialUrl("https://www.govinfo.gov/content/pkg/FR-2000-01-03/html/99-33595.htm", "govinfo-cfr")
    ).toThrow("Unexpected")
  })
})
