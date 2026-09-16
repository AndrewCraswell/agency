import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { afterEach, describe, expect, it, vi } from "vitest"
import { frMetadataPageSchema } from "./fr-metadata-contract.js"
import { acquireFrPdfs } from "./fr-pdf.js"
import { RegulatorySourceClient } from "./source-client.js"

const fixture = frMetadataPageSchema.parse(
  JSON.parse(await readFile(new URL("./fixtures/fr-2024-01-02-metadata.json", import.meta.url), "utf8"))
)
const record = fixture.results.find((item) => item.type === "Rule")
invariant(record, "fixture_rule_missing")
const pdf = "%PDF-1.7\nfixture acquisition bytes, not a structurally valid document\n%%EOF\n"
const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})
async function setup(
  response: () => Response = () => new Response(pdf, { headers: { "content-type": "application/pdf" } })
) {
  const directory = await mkdtemp(join(tmpdir(), "fr-pdf-"))
  directories.push(directory)
  const fetcher = vi.fn<typeof fetch>(async () => response())
  return {
    input: {
      metadataManifestId: digest("metadata"),
      records: [record],
      date: "2024-01-02",
      directory,
      limit: 10,
      client: new RegulatorySourceClient({ fetch: fetcher, minimumIntervalMs: 0 })
    },
    fetcher
  }
}
describe("Federal Register PDF acquisition", () => {
  it("retains immutable bytes and replays without network while keeping structural validation pending", async () => {
    const { input, fetcher } = await setup()
    const first = await acquireFrPdfs(input)
    expect(first.acquisitionComplete).toBe(true)
    expect(first.publicationReady).toBe(false)
    expect(first.results[0]).toMatchObject({
      receipt: { sha256: digest(pdf), reused: false, structuralValidation: "pending" }
    })
    const second = await acquireFrPdfs(input)
    expect(second.results[0]).toMatchObject({ receipt: { reused: true } })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(await readdir(join(input.directory, "temporary"))).toEqual([])
  })
  it.each([
    ["type", "application/json", pdf, "content_type"],
    ["signature", "application/pdf", "<html>error</html>%%EOF", "signature_missing"],
    ["truncated", "application/pdf", "%PDF-1.7\ntruncated", "end_marker_missing"]
  ])("rejects %s failures without a success receipt", async (_label, type, body, reason) => {
    const { input } = await setup(() => new Response(body, { headers: { "content-type": type } }))
    const result = await acquireFrPdfs(input)
    expect(result.acquisitionComplete).toBe(false)
    expect(result.results[0]).toMatchObject({ status: "failed", reason: expect.stringContaining(reason) })
    expect(await readdir(join(input.directory, "receipts"))).toEqual([])
  })
  it("bounds unknown-length responses and leaves a failed download retryable", async () => {
    const { input } = await setup()
    const result = await acquireFrPdfs({ ...input, maximumBytes: 8 })
    expect(result.results[0]).toMatchObject({ status: "failed", reason: expect.stringContaining("byte_limit") })
    expect((await acquireFrPdfs(input)).acquisitionComplete).toBe(true)
  })
  it("detects cached byte corruption without silently replacing retained evidence", async () => {
    const { input, fetcher } = await setup()
    await acquireFrPdfs(input)
    await writeFile(join(input.directory, "blobs", `${digest(pdf)}.pdf`), "corrupt")
    const result = await acquireFrPdfs(input)
    expect(result.results[0]).toMatchObject({ status: "failed", reason: expect.stringContaining("cache_corrupt") })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it("rejects untrusted publisher URLs before network and records missing renditions", async () => {
    const { input, fetcher } = await setup()
    const result = await acquireFrPdfs({ ...input, records: [{ ...record, pdf_url: "https://example.com/fake.pdf" }] })
    expect(result.results[0]).toMatchObject({
      status: "failed",
      reason: expect.stringContaining("untrusted_fr_pdf_location")
    })
    const missing = await acquireFrPdfs({ ...input, records: [{ ...record, pdf_url: null }] })
    expect(missing.results[0]).toMatchObject({ status: "failed", reason: expect.stringContaining("not_listed") })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("does not treat a bounded subset as complete and excludes presidential documents", async () => {
    const { input } = await setup()
    const result = await acquireFrPdfs({ ...input, records: fixture.results, limit: 1 })
    expect(result.expected).toBe(63)
    expect(result.results).toHaveLength(1)
    expect(result.acquisitionComplete).toBe(false)
  })
  it("rejects duplicate identities and concurrent writers", async () => {
    const { input } = await setup()
    await expect(acquireFrPdfs({ ...input, records: [record, record] })).rejects.toThrow("duplicate_identity")
    await writeFile(join(input.directory, "writer.lock"), "busy")
    await expect(acquireFrPdfs(input)).rejects.toThrow("EEXIST")
  })
})
