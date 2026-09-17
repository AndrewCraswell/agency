import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, it } from "vitest"
import { legalPassageShapeContract } from "./passage-shapes.js"
import { auditRegulatoryQualification } from "./qualification-audit.js"

const directories: string[] = []
afterEach(async () => Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))))

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "tabra-qualification-audit-"))
  directories.push(root)
  const key = "a".repeat(64)
  const implementationHash = "b".repeat(64)
  const edition = {
    id: randomUUID(),
    source_id: "ecfr",
    generation_id: "c".repeat(64),
    rights_profile_id: "official-federal-text",
    native_key: "2026-09-17",
    currency_date: "2026-09-17"
  }
  const preparation = [{ model: "openai/text-embedding-3-small", tokenizerId: "pinned-tokenizer" }]
  const reviewedVersionId = randomUUID()
  const reviewedContentHash = "f".repeat(64)
  const reviewedBlockHash = "1".repeat(64)
  const records =
    JSON.stringify({
      ordinal: 0,
      versionId: reviewedVersionId,
      contentHash: reviewedContentHash,
      inspection: {
        tableBlocks: [
          {
            blockHash: reviewedBlockHash,
            status: "classified",
            layoutFailure: "passage_table_unresolved_ditto"
          }
        ]
      }
    }) +
    "\n" +
    JSON.stringify({
      ordinal: 1,
      versionId: randomUUID(),
      contentHash: "2".repeat(64),
      inspection: { tableBlocks: [] }
    }) +
    "\n"
  const counters = {
    records: 2,
    empty: 0,
    invalid: 0,
    oversized: 0,
    withTables: 1,
    tableBlocks: 1,
    nestedTableBlocks: 0,
    rowSpanBlocks: 0,
    columnSpanBlocks: 0,
    blockedTableBlocks: 1,
    bodyCharacters: 20,
    maximumBodyBytes: 20,
    maximumRawCellCharacters: 4,
    preparation: {
      "openai/text-embedding-3-small": {
        prepared: 2,
        blocked: 0,
        passages: 3,
        tokens: 20,
        maximumTokens: 10,
        maximumInputCharacters: 30,
        continuations: 0,
        reasons: {}
      }
    },
    reasons: { passage_table_data_rows_required: 1 }
  }
  const report = {
    contract: legalPassageShapeContract,
    implementationHash,
    preparation,
    edition,
    inventoryHash: "d".repeat(64),
    rightsHash: "e".repeat(64),
    dataHash: createHash("sha256").update(records).digest("hex"),
    counters
  }
  await mkdir(join(root, key))
  await writeFile(join(root, key, "records.ndjson"), records)
  await writeFile(join(root, key, "report.json"), JSON.stringify(report))
  const inventoryPath = join(root, "inventory.json")
  await writeFile(
    inventoryPath,
    JSON.stringify({
      contract: legalPassageShapeContract,
      implementationHash,
      preparation,
      selected: [edition],
      results: [{ key, reused: false, ...report }],
      complete: true
    })
  )
  return {
    inventoryPath,
    implementationHash,
    recordsPath: join(root, key, "records.ndjson"),
    sourceReview: {
      editionId: edition.id,
      versionId: reviewedVersionId,
      tableIndex: 0,
      disposition: "quarantined_source_gap",
      reason: "publisher_source_missing_reference_row",
      expected: {
        contentHash: reviewedContentHash,
        blockHash: reviewedBlockHash,
        nativeId: "cfr:33:section:110.214",
        sourceLocator: "/ECFR/DIV8",
        sourceId: "ecfr",
        generationId: edition.generation_id,
        artifactHash: "3".repeat(64),
        sourceUrl: "https://www.ecfr.gov/example.xml",
        rightsProfileId: edition.rights_profile_id,
        rightsHash: "4".repeat(64)
      },
      corroboration: [
        {
          sourceUrl: "https://www.govinfo.gov/example.pdf",
          artifactHash: "5".repeat(64),
          bytes: 100,
          observation: "The annual edition contains the missing predecessor row."
        }
      ],
      canonicalBodyChanged: false,
      contextInjected: false,
      derivedPassagesAllowed: false
    }
  }
}

it("verifies retained bytes and reports tokenizer readiness separately from table review", async () => {
  const value = await fixture()
  await expect(
    auditRegulatoryQualification(value.inventoryPath, {
      expectedEditions: 1,
      implementationHash: value.implementationHash
    })
  ).resolves.toMatchObject({
    terminalIntegrity: true,
    tokenizerQualified: true,
    tableShapeQualified: false,
    totals: {
      editions: 1,
      records: 2,
      blockedTableBlocks: 1,
      preparation: { "openai/text-embedding-3-small": { prepared: 2, blocked: 0, passages: 3, tokens: 20 } }
    }
  })
})

it("rejects a retained byte stream changed after terminal completion", async () => {
  const value = await fixture()
  await writeFile(value.recordsPath, '{"ordinal":0}\n')
  await expect(
    auditRegulatoryQualification(value.inventoryPath, {
      expectedEditions: 1,
      implementationHash: value.implementationHash
    })
  ).rejects.toThrow("qualification_data_hash_mismatch")
})

it("accounts for an exact source-gap quarantine without claiming the table itself qualified", async () => {
  const value = await fixture()
  await expect(
    auditRegulatoryQualification(value.inventoryPath, {
      expectedEditions: 1,
      implementationHash: value.implementationHash,
      sourceReviews: [value.sourceReview]
    })
  ).resolves.toMatchObject({
    tokenizerQualified: true,
    quarantinedSourceGapBlocks: 1,
    unresolvedTableBlocks: 0,
    tableShapeAccounted: true,
    tableShapeQualified: false,
    sourceReviewHashes: [expect.stringMatching(/^[a-f0-9]{64}$/)]
  })
})

it("rejects a quarantine when its exact table hash no longer matches", async () => {
  const value = await fixture()
  await expect(
    auditRegulatoryQualification(value.inventoryPath, {
      expectedEditions: 1,
      implementationHash: value.implementationHash,
      sourceReviews: [
        { ...value.sourceReview, expected: { ...value.sourceReview.expected, blockHash: "6".repeat(64) } }
      ]
    })
  ).rejects.toThrow("qualification_source_review_table_changed")
})
