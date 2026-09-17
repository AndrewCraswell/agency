import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { isDeepStrictEqual } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalPassageShapeContract } from "./passage-shapes.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const modelCountersSchema = z.strictObject({
  prepared: z.int().nonnegative(),
  blocked: z.int().nonnegative(),
  passages: z.int().nonnegative(),
  tokens: z.int().nonnegative(),
  maximumTokens: z.int().nonnegative(),
  maximumInputCharacters: z.int().nonnegative(),
  continuations: z.int().nonnegative(),
  reasons: z.record(z.string(), z.int().positive())
})
const countersSchema = z.strictObject({
  records: z.int().positive(),
  empty: z.int().nonnegative(),
  invalid: z.int().nonnegative(),
  oversized: z.int().nonnegative(),
  withTables: z.int().nonnegative(),
  tableBlocks: z.int().nonnegative(),
  nestedTableBlocks: z.int().nonnegative(),
  rowSpanBlocks: z.int().nonnegative(),
  columnSpanBlocks: z.int().nonnegative(),
  blockedTableBlocks: z.int().nonnegative(),
  bodyCharacters: z.int().nonnegative(),
  maximumBodyBytes: z.int().nonnegative(),
  maximumRawCellCharacters: z.int().nonnegative(),
  preparation: z.record(z.string(), modelCountersSchema),
  reasons: z.record(z.string(), z.int().positive())
})
const editionSchema = z.object({
  id: z.uuid(),
  source_id: z.enum(["ecfr", "govinfo-cfr"]),
  generation_id: hashSchema,
  rights_profile_id: z.string().min(1),
  native_key: z.string().min(1),
  currency_date: z.string().nullable()
})
const preparationSchema = z.array(z.strictObject({ model: z.string().min(1), tokenizerId: z.string().min(1) })).min(1)
const summarySchema = z.strictObject({
  contract: z.literal(legalPassageShapeContract),
  implementationHash: hashSchema,
  preparation: preparationSchema,
  edition: editionSchema,
  inventoryHash: hashSchema,
  rightsHash: hashSchema,
  dataHash: hashSchema,
  counters: countersSchema
})
const resultSchema = summarySchema.extend({ key: hashSchema, reused: z.boolean() })
const inventorySchema = z.strictObject({
  contract: z.literal(legalPassageShapeContract),
  implementationHash: hashSchema,
  preparation: preparationSchema,
  selected: z.array(editionSchema).min(1),
  results: z.array(resultSchema).min(1),
  complete: z.literal(true)
})
const requestSchema = z.strictObject({
  expectedEditions: z.int().positive(),
  implementationHash: hashSchema
})

async function hashLines(path: string) {
  const hash = createHash("sha256")
  let lines = 0
  for await (const chunk of createReadStream(path)) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    hash.update(bytes)
    for (const byte of bytes) lines += Number(byte === 10)
  }
  return { hash: hash.digest("hex"), lines }
}

function addReasons(target: Record<string, number>, reasons: Record<string, number>) {
  for (const [reason, count] of Object.entries(reasons)) target[reason] = (target[reason] ?? 0) + count
}

/** Verifies a terminal offline qualification artifact and every retained per-edition byte stream. */
export async function auditRegulatoryQualification(inventoryPath: string, requestValue: unknown) {
  const request = requestSchema.parse(requestValue)
  const inventory = inventorySchema.parse(JSON.parse(await readFile(inventoryPath, "utf8")))
  invariant(inventory.implementationHash === request.implementationHash, "qualification_implementation_mismatch")
  invariant(inventory.selected.length === request.expectedEditions, "qualification_selected_count_mismatch")
  invariant(inventory.results.length === request.expectedEditions, "qualification_result_count_mismatch")
  invariant(
    new Set(inventory.selected.map((edition) => edition.id)).size === inventory.selected.length,
    "qualification_duplicate_edition"
  )
  invariant(
    new Set(inventory.results.map((result) => result.key)).size === inventory.results.length,
    "qualification_duplicate_result"
  )
  const directory = dirname(inventoryPath)
  const totals = {
    editions: 0,
    records: 0,
    invalid: 0,
    oversized: 0,
    empty: 0,
    tableBlocks: 0,
    blockedTableBlocks: 0,
    reasons: {} as Record<string, number>,
    preparation: {} as Record<string, z.infer<typeof modelCountersSchema>>
  }
  for (const [index, result] of inventory.results.entries()) {
    const selected = inventory.selected[index]
    invariant(selected && isDeepStrictEqual(result.edition, selected), "qualification_result_order_mismatch")
    invariant(
      isDeepStrictEqual(result.preparation, inventory.preparation),
      "qualification_preparation_identity_mismatch"
    )
    const report = summarySchema.parse(JSON.parse(await readFile(join(directory, result.key, "report.json"), "utf8")))
    const { key: _, reused: __, ...expectedReport } = result
    invariant(isDeepStrictEqual(report, expectedReport), "qualification_report_mismatch")
    const data = await hashLines(join(directory, result.key, "records.ndjson"))
    invariant(data.hash === report.dataHash, "qualification_data_hash_mismatch")
    invariant(data.lines === report.counters.records, "qualification_record_count_mismatch")
    totals.editions++
    totals.records += report.counters.records
    totals.invalid += report.counters.invalid
    totals.oversized += report.counters.oversized
    totals.empty += report.counters.empty
    totals.tableBlocks += report.counters.tableBlocks
    totals.blockedTableBlocks += report.counters.blockedTableBlocks
    addReasons(totals.reasons, report.counters.reasons)
    for (const [model, counters] of Object.entries(report.counters.preparation)) {
      const aggregate = (totals.preparation[model] ??= {
        prepared: 0,
        blocked: 0,
        passages: 0,
        tokens: 0,
        maximumTokens: 0,
        maximumInputCharacters: 0,
        continuations: 0,
        reasons: {}
      })
      aggregate.prepared += counters.prepared
      aggregate.blocked += counters.blocked
      aggregate.passages += counters.passages
      aggregate.tokens += counters.tokens
      aggregate.maximumTokens = Math.max(aggregate.maximumTokens, counters.maximumTokens)
      aggregate.maximumInputCharacters = Math.max(aggregate.maximumInputCharacters, counters.maximumInputCharacters)
      aggregate.continuations += counters.continuations
      addReasons(aggregate.reasons, counters.reasons)
    }
  }
  invariant(
    isDeepStrictEqual(Object.keys(totals.preparation).sort(), inventory.preparation.map(({ model }) => model).sort()),
    "qualification_model_inventory_mismatch"
  )
  const tokenizerQualified =
    totals.invalid === 0 &&
    totals.oversized === 0 &&
    Object.values(totals.preparation).every((value) => value.blocked === 0)
  return {
    contract: inventory.contract,
    implementationHash: inventory.implementationHash,
    preparation: inventory.preparation,
    totals,
    terminalIntegrity: true as const,
    tokenizerQualified,
    tableShapeQualified: totals.blockedTableBlocks === 0
  }
}
