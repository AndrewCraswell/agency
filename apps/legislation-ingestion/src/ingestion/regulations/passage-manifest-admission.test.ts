import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import pg from "pg"
import { expect, it, vi } from "vitest"
import { auditLegalPassageManifestAdmission } from "./passage-manifest-admission.js"
import { legalPassageManifestContract } from "./passage-manifest.js"
import { legalPassageContract } from "./passages.js"

const ownerId = "00000000-0000-4000-8000-000000000001"
const versionId = "00000000-0000-4000-8000-000000000002"
const context = "jurisdiction:us\nCode of Federal Regulations, title 1\nnative\nHeading"
const generationId = "a".repeat(64)
const storageId = digest(JSON.stringify(["provision", generationId]))
const inputManifestHash = "b".repeat(64)
const sourceHash = "c".repeat(64)
const rightsHash = "d".repeat(64)

async function artifacts() {
  const root = await mkdtemp(join(tmpdir(), "passage-admission-"))
  const relativeDirectory = `${ownerId}/model`
  const directory = join(root, relativeDirectory)
  await mkdir(directory, { recursive: true })
  const entry = {
    ordinal: 0,
    versionId,
    contentHash: "e".repeat(64),
    nativeId: "native",
    sourceLocator: "/ECFR[1]",
    contextHash: digest(context),
    eligibility: "eligible",
    generationId,
    inputManifestHash,
    passageCount: 1
  }
  const entriesContents = `${JSON.stringify(entry)}\n`
  const entriesPath = `${relativeDirectory}/entries.ndjson`
  await writeFile(join(root, entriesPath), entriesContents)
  const manifest = {
    contract: legalPassageManifestContract,
    contracts: {
      qualification: "qualification",
      qualificationImplementation: "f".repeat(64),
      sourceInput: "source",
      reader: "reader",
      passage: legalPassageContract
    },
    owner: {
      kind: "edition",
      id: ownerId,
      sourceId: "ecfr",
      sourceGenerationId: "1".repeat(64),
      rightsProfileId: "rights",
      nativeKey: "2026-09-15",
      currencyDate: "2026-09-15"
    },
    sourceMembership: {
      inventoryHash: "2".repeat(64),
      qualificationDataHash: "3".repeat(64),
      rightsHash,
      records: 1
    },
    preparation: { model: "openai/text-embedding-3-small", tokenizerId: "tokenizer" },
    entries: {
      file: entriesPath,
      sha256: digest(entriesContents),
      versions: 1,
      passages: 1,
      eligibility: { eligible: 1, emptyText: 0 }
    }
  }
  const manifestContents = `${JSON.stringify(manifest)}\n`
  const manifestPath = `${relativeDirectory}/manifest.json`
  await writeFile(join(root, manifestPath), manifestContents)
  const catalog = {
    contract: legalPassageManifestContract,
    qualificationInventoryHash: "4".repeat(64),
    implementationHash: "f".repeat(64),
    model: "openai/text-embedding-3-small",
    tokenizerId: "tokenizer",
    partitions: [
      {
        ownerId,
        manifestHash: digest(manifestContents),
        entriesHash: digest(entriesContents),
        versions: 1,
        passages: 1,
        manifest: manifestPath
      }
    ],
    totals: { partitions: 1, versions: 1, passages: 1 }
  }
  const catalogContents = `${JSON.stringify(catalog)}\n`
  const catalogPath = join(root, "catalog.json")
  await writeFile(catalogPath, catalogContents)
  return { catalogPath, catalogHash: digest(catalogContents) }
}

function database(options: { generation?: boolean; changedManifest?: boolean } = {}) {
  const client = Object.assign(new pg.Client(), { release: vi.fn<() => void>() })
  vi.spyOn(client, "query").mockImplementation(async (...arguments_) => {
    const sql = typeof arguments_[0] === "string" ? arguments_[0] : ""
    let rows: unknown[] = []
    if (sql.includes("FROM legislation.legal_editions")) {
      rows = [
        {
          id: ownerId,
          source_id: "ecfr",
          generation_id: "1".repeat(64),
          rights_profile_id: "rights",
          native_key: "2026-09-15",
          currency_date: "2026-09-15",
          published_at: new Date("2026-09-15T00:00:00Z"),
          policy_hash: rightsHash,
          is_active: true,
          members: 1
        }
      ]
    } else if (sql.includes("FROM legislation.legal_edition_provisions")) {
      rows = [
        {
          ordinal: 0,
          version_id: versionId,
          content_hash: "e".repeat(64),
          native_id: "native",
          source_locator: "/ECFR[1]",
          context,
          source_hash: sourceHash
        }
      ]
    } else if (sql.includes("FROM legislation.legal_passage_generations") && options.generation) {
      rows = [
        {
          id: storageId,
          provision_version_id: versionId,
          document_version_id: null,
          contract: legalPassageContract,
          tokenizer_id: "tokenizer",
          context,
          manifest_hash: options.changedManifest ? "0".repeat(64) : inputManifestHash,
          passage_count: 1,
          actual_passages: 1,
          eligibility: "eligible",
          source_hash: sourceHash
        }
      ]
    }
    return { rows, command: "SELECT", rowCount: rows.length, oid: 0, fields: [] }
  })
  const pool = new pg.Pool()
  vi.spyOn(pool, "connect").mockImplementation(async () => client)
  return pool
}

it("accounts for frozen entries as materialized or pending", async () => {
  const artifact = await artifacts()
  await expect(auditLegalPassageManifestAdmission(database(), artifact)).resolves.toMatchObject({
    admission: {
      contract: "legal-passage-manifest-admission",
      catalogHash: artifact.catalogHash,
      model: "openai/text-embedding-3-small",
      tokenizerId: "tokenizer",
      scopeKind: "edition",
      partitions: [{ ownerId, versions: 1, passages: 1 }]
    },
    totals: { partitions: 1, versions: 1, passages: 1, materialized: 0, pending: 1 }
  })
  await expect(auditLegalPassageManifestAdmission(database({ generation: true }), artifact)).resolves.toMatchObject({
    totals: { materialized: 1, pending: 0 }
  })
})

it("rejects catalog tampering and conflicting stored generations", async () => {
  const artifact = await artifacts()
  await expect(
    auditLegalPassageManifestAdmission(database(), { ...artifact, catalogHash: "0".repeat(64) })
  ).rejects.toThrow("legal_passage_admission_catalog_hash")
  await expect(
    auditLegalPassageManifestAdmission(database({ generation: true, changedManifest: true }), artifact)
  ).rejects.toThrow("legal_passage_admission_generation_changed")
})
