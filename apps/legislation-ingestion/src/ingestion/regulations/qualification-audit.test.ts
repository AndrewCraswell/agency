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
  const records = '{"ordinal":0}\n{"ordinal":1}\n'
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
  return { inventoryPath, implementationHash, recordsPath: join(root, key, "records.ndjson") }
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
