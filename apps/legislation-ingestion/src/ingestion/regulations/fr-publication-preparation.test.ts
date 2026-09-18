import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { acquisitionUnitSchema, digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryRecordSchema } from "@repo/legislation-core/legal-text/parser-contract"
import invariant from "tiny-invariant"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { frMetadataPageSchema, type FrPageEvidence } from "./fr-metadata-contract.js"
import { collectFrMetadata, collectFrMetadataToDirectory } from "./fr-metadata.js"
import { loadOrCollectFrMetadata, planFrPublicationRenditions } from "./fr-publication-preparation.js"
import { reconcileFrIssue } from "./fr-reconciliation.js"
import { parseRegulatoryArtifact } from "./parser-bridge.js"

const fixtures = new URL("./fixtures/", import.meta.url)
const source = z
  .array(z.object({ fixture: z.string(), sourceUnit: acquisitionUnitSchema, fixtureHash: z.string() }))
  .parse(JSON.parse(await readFile(new URL("provenance.json", fixtures), "utf8")))
  .find((row) => row.fixture === "fr-2024-01-02-excerpt.xml")
invariant(source, "missing_fr_fixture")
const allMetadata = frMetadataPageSchema.parse(
  JSON.parse(await readFile(new URL("fr-2024-01-02-metadata.json", fixtures), "utf8"))
).results
const directory = await mkdtemp(join(tmpdir(), "rostra-fr-preparation-"))

function evidence(url: string, page: unknown): FrPageEvidence {
  const body = JSON.stringify(page)
  return {
    url,
    sha256: digest(body),
    bytes: Buffer.byteLength(body),
    body,
    retrievedAt: "2026-09-18T00:00:00Z",
    contentType: "application/json"
  }
}

let fixture: {
  metadata: Awaited<ReturnType<typeof collectFrMetadata>>
  monthlyMetadata: Awaited<ReturnType<typeof collectFrMetadata>>
  reconciliation: ReturnType<typeof reconcileFrIssue>
}

beforeAll(async () => {
  const parsed = await parseRegulatoryArtifact({
    unit: source.sourceUnit,
    artifactHash: source.fixtureHash,
    path: fileURLToPath(new URL(source.fixture, fixtures)),
    outputRoot: directory
  })
  const records: z.infer<typeof regulatoryRecordSchema>[] = []
  for (const shard of parsed.summary.shards) {
    for (const line of (await readFile(join(parsed.directory, shard.file), "utf8")).trimEnd().split("\n")) {
      records.push(regulatoryRecordSchema.parse(JSON.parse(line)))
    }
  }
  const selected = allMetadata.filter((row) => records.some((record) => record.nativeId === row.document_number))
  const metadata = await collectFrMetadata(
    { start: "2024-01-02", end: "2024-01-02", cutoff: "2024-01-02" },
    async (url) => evidence(url, { count: selected.length, total_pages: 1, next_page_url: null, results: selected }),
    { pageSize: 200 }
  )
  const monthlyMetadata = await collectFrMetadata(
    { start: "2024-01-01", end: "2024-01-31", cutoff: "2024-01-31" },
    async (url) => evidence(url, { count: selected.length, total_pages: 1, next_page_url: null, results: selected }),
    { pageSize: 200 }
  )
  fixture = {
    metadata,
    monthlyMetadata,
    reconciliation: reconcileFrIssue({
      unit: source.sourceUnit,
      summary: parsed.summary,
      records,
      metadata: metadata.records,
      metadataManifestId: metadata.id
    })
  }
})

afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe("Federal Register publication preparation", () => {
  it("creates one deterministic PDF intent for every reconciled XML publication", () => {
    const intents = planFrPublicationRenditions({
      issueDate: "2024-01-02",
      metadata: fixture.metadata,
      reconciliation: fixture.reconciliation
    })
    expect(intents.map((intent) => intent.documentNumber)).toEqual(["2023-28718", "2023-28797", "C1-2023-27742"])
    expect(intents.every((intent) => intent.sourceUrl.includes("/content/pkg/FR-2024-01-02/pdf/"))).toBe(true)
  })

  it("uses one replay-validated monthly manifest for a covered historical issue", async () => {
    const retainedManifestPath = join(directory, "retained-monthly-metadata.json")
    await writeFile(retainedManifestPath, JSON.stringify(fixture.monthlyMetadata), { flag: "wx" })
    const collect = vi.fn<typeof collectFrMetadataToDirectory>()
    const loaded = await loadOrCollectFrMetadata(join(directory, "daily-metadata"), "2024-01-02", collect, {
      retainedManifestPath
    })
    expect(loaded).toMatchObject({
      manifest: { id: fixture.monthlyMetadata.id, scope: { start: "2024-01-01", end: "2024-01-31" } },
      manifestPath: retainedManifestPath,
      reused: true
    })
    expect(collect).not.toHaveBeenCalled()
    expect(
      planFrPublicationRenditions({
        issueDate: "2024-01-02",
        metadata: loaded.manifest,
        reconciliation: { ...fixture.reconciliation, metadataManifestId: loaded.manifest.id }
      })
    ).toHaveLength(3)
    await expect(
      loadOrCollectFrMetadata(join(directory, "outside-month"), "2024-02-01", collect, { retainedManifestPath })
    ).rejects.toThrow("fr_metadata_scope_mismatch")
    expect(collect).not.toHaveBeenCalled()
  })

  it("fails closed when a reconciled publication has no official PDF rendition", () => {
    const first = fixture.metadata.records[0]
    invariant(first, "missing_metadata_fixture")
    const metadata = {
      ...fixture.metadata,
      records: fixture.metadata.records.map((record) =>
        record.document_number === first.document_number ? { ...record, pdf_url: null } : record
      )
    }
    const reconciliation = { ...fixture.reconciliation, metadataManifestId: metadata.id }
    expect(() => planFrPublicationRenditions({ issueDate: "2024-01-02", metadata, reconciliation })).toThrow(
      "fr_required_rendition_not_listed"
    )
  })

  it("plans a rendition when GovInfo XML resolves an uncategorized publisher record", () => {
    const first = fixture.metadata.records[0]
    invariant(first, "missing_metadata_fixture")
    const metadata = {
      ...fixture.metadata,
      records: fixture.metadata.records.map((record) =>
        record.document_number === first.document_number
          ? { ...record, type: "Uncategorized Document" as const }
          : record
      )
    }
    const intents = planFrPublicationRenditions({
      issueDate: "2024-01-02",
      metadata,
      reconciliation: fixture.reconciliation
    })
    expect(intents).toContainEqual(
      expect.objectContaining({
        documentNumber: first.document_number,
        metadataRecord: expect.objectContaining({ type: "Uncategorized Document" })
      })
    )
  })
})
