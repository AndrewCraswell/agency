import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import invariant from "tiny-invariant"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"
import { acquisitionUnitSchema, digest } from "./contracts.js"
import { frMetadataPageSchema } from "./fr-metadata-contract.js"
import { frPdfLocation, reconcileFrIssue } from "./fr-reconciliation.js"
import { parseRegulatoryArtifact } from "./parser-bridge.js"
import { regulatoryRecordSchema } from "./parser-contract.js"

const fixtures = new URL("./fixtures/", import.meta.url)
const source = z
  .array(z.object({ fixture: z.string(), sourceUnit: acquisitionUnitSchema, fixtureHash: z.string() }))
  .parse(JSON.parse(await readFile(new URL("provenance.json", fixtures), "utf8")))
  .find((row) => row.fixture === "fr-2024-01-02-excerpt.xml")
invariant(source, "missing_fr_fixture")
const fixtureSource = source
const metadata = frMetadataPageSchema.parse(
  JSON.parse(await readFile(new URL("fr-2024-01-02-metadata.json", fixtures), "utf8"))
).results
const directory = await mkdtemp(join(tmpdir(), "tabra-fr-reconciliation-"))
async function loadFixture() {
  const result = await parseRegulatoryArtifact({
    unit: fixtureSource.sourceUnit,
    artifactHash: fixtureSource.fixtureHash,
    path: fileURLToPath(new URL(fixtureSource.fixture, fixtures)),
    outputRoot: directory
  })
  const records: z.infer<typeof regulatoryRecordSchema>[] = []
  for (const shard of result.summary.shards) {
    for (const line of (await readFile(join(result.directory, shard.file), "utf8")).trimEnd().split("\n")) {
      records.push(regulatoryRecordSchema.parse(JSON.parse(line)))
    }
  }
  return {
    unit: fixtureSource.sourceUnit,
    summary: result.summary,
    records,
    metadata: metadata.filter((row) => records.some((r) => r.nativeId === row.document_number)),
    metadataManifestId: digest("synthetic selection of retained source metadata for three XML excerpts")
  }
}
let fixture: Awaited<ReturnType<typeof loadFixture>>
beforeAll(async () => {
  fixture = await loadFixture()
})
afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe("Federal Register text/metadata union", () => {
  it("matches each real publication and retains the unresolved publisher correction link", () => {
    const report = reconcileFrIssue(fixture)
    expect(report).toMatchObject({
      matchedPublications: 3,
      metadataComplete: true,
      publicationReady: false,
      artifactsComplete: false,
      listedPdfsNotAcquired: 3
    })
    expect(report.corrections).toContainEqual({
      from: "C1-2023-27742",
      to: "2023-27742",
      basis: "publisher_link",
      sourceUrl: "https://www.federalregister.gov/api/v1/documents/2023-27742",
      targetInSlice: false,
      status: "unresolved_target"
    })
    expect(report.matches.every((match) => match.legalStatus === "unknown")).toBe(true)
  })
  it("records presidential documents as explicit exclusions, matching the XML source count", () => {
    const presidents = metadata.filter((row) => row.type === "Presidential Document")
    const report = reconcileFrIssue({
      ...fixture,
      metadata: [...fixture.metadata, ...presidents],
      summary: { ...fixture.summary, sourceTagCounts: { ...fixture.summary.sourceTagCounts, PRESDOCU: 2 } }
    })
    expect(report.outsideScope).toHaveLength(2)
    expect(report.metadataComplete).toBe(true)
    expect(reconcileFrIssue({ ...fixture, metadata: [...fixture.metadata, ...presidents] }).gaps).toContainEqual({
      documentNumber: "",
      reason: "outside_scope_count_mismatch"
    })
  })
  it("keeps missing metadata, missing text and ambiguous matches distinct", () => {
    const first = fixture.metadata[0]
    invariant(first, "missing_fixture")
    expect(reconcileFrIssue({ ...fixture, metadata: fixture.metadata.slice(1) }).gaps).toContainEqual({
      documentNumber: first.document_number,
      reason: "missing_metadata"
    })
    expect(reconcileFrIssue({ ...fixture, metadata: [...fixture.metadata, first] }).gaps).toContainEqual({
      documentNumber: first.document_number,
      reason: "ambiguous_metadata_match"
    })
    const extra = metadata.find(
      (row) =>
        row.type !== "Presidential Document" && !fixture.metadata.some((r) => r.document_number === row.document_number)
    )
    invariant(extra, "missing_extra")
    expect(reconcileFrIssue({ ...fixture, metadata: [...fixture.metadata, extra] }).gaps).toContainEqual({
      documentNumber: extra.document_number,
      reason: "missing_text"
    })
  })
  it("blocks mismatched classifications and untrusted PDF destinations", () => {
    const changed = fixture.metadata.map((row) => ({ ...row, type: "Presidential Document" }))
    expect(reconcileFrIssue({ ...fixture, metadata: changed })).toMatchObject({
      metadataComplete: false,
      matchedPublications: 0
    })
    const bad = fixture.metadata.map((row) => ({ ...row, pdf_url: "https://example.test/a.pdf" }))
    expect(reconcileFrIssue({ ...fixture, metadata: bad })).toMatchObject({
      metadataComplete: false,
      listedPdfsNotAcquired: 0
    })
  })
  it("reports unavailable PDF listings without inventing an artifact or changing valid text matches", () => {
    const report = reconcileFrIssue({
      ...fixture,
      metadata: fixture.metadata.map((row) => ({ ...row, pdf_url: null }))
    })
    expect(report).toMatchObject({ metadataComplete: true, artifactsComplete: false, listedPdfsNotAcquired: 0 })
    expect(report.matches.every((row) => row.pdfStatus === "not_listed")).toBe(true)
  })
  it("rejects incomplete parser output and mismatched acquisition lineage", () => {
    expect(() => reconcileFrIssue({ ...fixture, records: fixture.records.slice(1) })).toThrow(
      "fr_parser_count_mismatch"
    )
    expect(() => reconcileFrIssue({ ...fixture, summary: { ...fixture.summary, inputHash: "0".repeat(64) } })).toThrow(
      "fr_parser_provenance_mismatch"
    )
  })
  it("allows only the exact government PDF corresponding to the joined publication", () => {
    expect(
      frPdfLocation(
        "https://www.govinfo.gov/content/pkg/FR-2024-01-02/pdf/C1-2023-27742.pdf",
        "C1-2023-27742",
        "2024-01-02"
      )
    ).toContain("/pdf/C1-")
    expect(() =>
      frPdfLocation(
        "https://www.govinfo.gov/content/pkg/FR-2024-01-03/pdf/C1-2023-27742.pdf",
        "C1-2023-27742",
        "2024-01-02"
      )
    ).toThrow("untrusted_fr_pdf_location")
  })
})
