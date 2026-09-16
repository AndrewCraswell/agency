import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, readFile, rename, writeFile, open, unlink } from "node:fs/promises"
import { join, resolve } from "node:path"
import { createInterface } from "node:readline"
import { isDeepStrictEqual, parseArgs } from "node:util"
import { embeddingTokenizer } from "@repo/legislation-core/embeddings/embedding-tokenizer"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParserContract } from "@repo/legislation-core/legal-text/parser-contract"
import { storedLegalSourceBlocks } from "@repo/legislation-core/legal-text/reader-text"
import {
  assertRights,
  provisionContent,
  regulatoryStorageContract
} from "@repo/legislation-core/legal-text/storage-contract"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { regulatoryDependencyFingerprint } from "../../src/ingestion/regulations/dependency-fingerprint.js"
import {
  inspectLegalPassagePreparation,
  legalPreparationInspectionSchema
} from "../../src/ingestion/regulations/passage-inspection.js"
import { inspectLegalPassageShape, legalPassageShapeContract } from "../../src/ingestion/regulations/passage-shapes.js"

const { values } = parseArgs({
  options: {
    output: { type: "string" },
    edition: { type: "string", multiple: true },
    prepare: { type: "boolean", default: false }
  }
})
const output = resolve(z.string().min(1).parse(values.output))
const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
const target = new URL(connectionString)
invariant(
  ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) && target.pathname === "/regulations_test",
  "shape_inventory_requires_local_pilot"
)
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  options: "-c default_transaction_read_only=on -c statement_timeout=60000"
})
const requested = values.edition === undefined ? null : z.array(z.uuid()).min(1).max(200).parse(values.edition)
const tokenizers = values.prepare
  ? await Promise.all(
      (["openai/text-embedding-3-small", "voyageai/voyage-4"] as const).map(async (model) => ({
        model,
        tokenizer: await embeddingTokenizer(model)
      }))
    )
  : []
const preparation = tokenizers.map(({ model, tokenizer }) => ({ model, tokenizerId: tokenizer.id }))
async function fingerprint() {
  const lockfile = await readFile(new URL("../../../../pnpm-lock.yaml", import.meta.url), "utf8")
  const dependencies = [
    regulatoryDependencyFingerprint(lockfile, "apps/legislation-ingestion", [
      "cheerio",
      "fast-xml-parser",
      "pg",
      "tiny-invariant",
      "tsx",
      "yaml",
      "zod"
    ]),
    regulatoryDependencyFingerprint(lockfile, "packages/legislation-core", ["@huggingface/tokenizers", "tiktoken"])
  ]
  return digest(
    (
      await Promise.all(
        [
          new URL(import.meta.url),
          new URL(import.meta.resolve("@repo/legislation-core/legal-text/contracts")),
          new URL("../../src/ingestion/regulations/dependency-fingerprint.ts", import.meta.url),
          new URL("../../src/ingestion/regulations/passage-shapes.ts", import.meta.url),
          new URL("../../src/ingestion/regulations/passage-inspection.ts", import.meta.url),
          new URL("../../src/ingestion/regulations/passage-failure.ts", import.meta.url),
          new URL("../../src/ingestion/regulations/passages.ts", import.meta.url),
          new URL(import.meta.resolve("@repo/legislation-core/embeddings/embedding-preparation")),
          new URL(import.meta.resolve("@repo/legislation-core/embeddings/embedding-tokenizer")),
          new URL(import.meta.resolve("@repo/legislation-core/embeddings/embedding-routing")),
          new URL(import.meta.resolve("@repo/legislation-core/embeddings/openrouter-embeddings")),
          new URL(import.meta.resolve("@repo/legislation-core/legal-text/reader-contract")),
          new URL(import.meta.resolve("@repo/legislation-core/legal-text/reader-text")),
          new URL("../../src/ingestion/regulations/table-passages.ts", import.meta.url),
          new URL(import.meta.resolve("@repo/legislation-core/legal-text/parser-contract")),
          new URL(import.meta.resolve("@repo/legislation-core/legal-text/storage-contract"))
        ].map((file) => readFile(file))
      )
    )
      .map((bytes) => digest(bytes))
      .concat(dependencies, process.versions.node, process.platform, process.arch)
      .join("\n")
  )
}
const implementationHash = await fingerprint()
const editionSchema = z.object({
  id: z.uuid(),
  source_id: z.enum(["ecfr", "govinfo-cfr"]),
  generation_id: z.string(),
  rights_profile_id: z.string(),
  native_key: z.string(),
  currency_date: z.string().nullable()
})
type Edition = z.infer<typeof editionSchema>
const memberSchema = z.object({
  ordinal: z.int().nonnegative(),
  version_id: z.uuid(),
  content_hash: z.string(),
  input_contract: z.string(),
  native_id: z.string(),
  source_locator: z.string(),
  context: z.string().max(16000)
})
const sizedSchema = memberSchema.extend({ body_bytes: z.int().nonnegative(), blocks_bytes: z.int().nonnegative() })
const storedSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  blocks: z.unknown(),
  heading: z.string(),
  node_kind: z.string(),
  input_contract: z.string(),
  language: z.literal("en")
})
const countersSchema = z
  .object({
    records: z.int(),
    empty: z.int(),
    invalid: z.int(),
    oversized: z.int(),
    withTables: z.int(),
    tableBlocks: z.int(),
    nestedTableBlocks: z.int(),
    rowSpanBlocks: z.int(),
    columnSpanBlocks: z.int(),
    blockedTableBlocks: z.int(),
    bodyCharacters: z.int(),
    maximumBodyBytes: z.int(),
    maximumRawCellCharacters: z.int(),
    preparation: z.record(
      z.string(),
      z.strictObject({
        prepared: z.int(),
        blocked: z.int(),
        passages: z.int(),
        tokens: z.int(),
        maximumTokens: z.int(),
        maximumInputCharacters: z.int(),
        continuations: z.int(),
        reasons: z.record(z.string(), z.int())
      })
    ),
    reasons: z.record(z.string(), z.int())
  })
  .strict()
const recordSchema = z.object({
  ordinal: z.int(),
  versionId: z.uuid(),
  contentHash: z.string(),
  nativeId: z.string(),
  sourceLocator: z.string(),
  preparation: z.array(legalPreparationInspectionSchema),
  inspection: z.object({
    status: z.enum(["classified", "invalid_source", "oversized"]),
    bodyCharacters: z.int().optional(),
    bodyBytes: z.int().optional(),
    isEmpty: z.boolean().optional(),
    reason: z.string().optional(),
    tableBlocks: z
      .array(
        z.object({
          status: z.string(),
          nestedTables: z.int().optional(),
          rowSpanAttributes: z.int().optional(),
          columnSpanAttributes: z.int().optional(),
          maximumRawCellCharacters: z.int().optional(),
          layoutFailure: z.string().nullable().optional(),
          reason: z.string().optional()
        })
      )
      .optional()
  })
})
const summarySchema = z.strictObject({
  contract: z.literal(legalPassageShapeContract),
  implementationHash: z.string(),
  preparation: z.array(z.strictObject({ model: z.string(), tokenizerId: z.string() })),
  edition: editionSchema,
  inventoryHash: z.string(),
  rightsHash: z.string(),
  dataHash: z.string(),
  counters: countersSchema
})

function counters() {
  return countersSchema.parse({
    records: 0,
    empty: 0,
    invalid: 0,
    oversized: 0,
    withTables: 0,
    tableBlocks: 0,
    nestedTableBlocks: 0,
    rowSpanBlocks: 0,
    columnSpanBlocks: 0,
    blockedTableBlocks: 0,
    bodyCharacters: 0,
    maximumBodyBytes: 0,
    maximumRawCellCharacters: 0,
    preparation: {},
    reasons: {}
  })
}
function add(total: ReturnType<typeof counters>, value: unknown) {
  const { inspection, preparation: prepared } = recordSchema.parse(value)
  invariant(
    isDeepStrictEqual(
      prepared.map(({ model, tokenizerId }) => ({ model, tokenizerId })),
      preparation
    ),
    "shape_preparation_models_mismatch"
  )
  for (const item of prepared) {
    const counts = (total.preparation[item.model] ??= {
      prepared: 0,
      blocked: 0,
      passages: 0,
      tokens: 0,
      maximumTokens: 0,
      maximumInputCharacters: 0,
      continuations: 0,
      reasons: {}
    })
    if (item.status === "blocked") {
      counts.blocked++
      counts.reasons[item.reason] = (counts.reasons[item.reason] ?? 0) + 1
    } else {
      counts.prepared++
      counts.passages += item.passages
      counts.tokens += item.tokens
      counts.maximumTokens = Math.max(counts.maximumTokens, item.maximumTokens)
      counts.maximumInputCharacters = Math.max(counts.maximumInputCharacters, item.maximumInputCharacters)
      counts.continuations += item.continuations
    }
  }
  total.records++
  total.empty += Number(inspection.isEmpty === true)
  total.invalid += Number(inspection.status === "invalid_source")
  total.oversized += Number(inspection.status === "oversized")
  total.bodyCharacters += inspection.bodyCharacters ?? 0
  total.maximumBodyBytes = Math.max(total.maximumBodyBytes, inspection.bodyBytes ?? 0)
  const reason = (code: string | null | undefined) => {
    if (code) {
      total.reasons[code] = (total.reasons[code] ?? 0) + 1
    }
  }
  reason(inspection.reason)
  const tables = inspection.tableBlocks ?? []
  total.withTables += Number(tables.length > 0)
  total.tableBlocks += tables.length
  for (const table of tables) {
    total.nestedTableBlocks += Number((table.nestedTables ?? 0) > 0)
    total.rowSpanBlocks += Number((table.rowSpanAttributes ?? 0) > 0)
    total.columnSpanBlocks += Number((table.columnSpanAttributes ?? 0) > 0)
    total.blockedTableBlocks += Number(table.status !== "classified" || table.layoutFailure !== null)
    total.maximumRawCellCharacters = Math.max(total.maximumRawCellCharacters, table.maximumRawCellCharacters ?? 0)
    reason(table.reason ?? table.layoutFailure)
  }
}
async function editions() {
  const result = await pool.query(
    `SELECT e.id,e.source_id,e.generation_id,e.rights_profile_id,e.native_key,e.currency_date::text
    FROM legislation.legal_editions e WHERE e.published_at IS NOT NULL AND ${requested === null ? "e.id IN (SELECT edition_id FROM legislation.legal_code_heads WHERE source_id='ecfr')" : "e.id=ANY($1::uuid[])"} ORDER BY e.id`,
    requested === null ? [] : [requested]
  )
  const rows = z.array(editionSchema).parse(result.rows)
  invariant(
    rows.length > 0 && (requested === null || rows.length === new Set(requested).size),
    "shape_edition_scope_unavailable"
  )
  return rows
}
async function rights(edition: Edition) {
  const row = z
    .object({ policy: z.unknown(), policy_hash: z.string() })
    .parse(
      (
        await pool.query("SELECT policy,policy_hash FROM legislation.legal_rights_profiles WHERE id=$1 AND is_active", [
          edition.rights_profile_id
        ])
      ).rows[0]
    )
  const policy = assertRights(row.policy, "displayText")
  assertRights(policy, "localSearch")
  invariant(digest(JSON.stringify(policy)) === row.policy_hash, "shape_rights_hash_mismatch")
  return row.policy_hash
}
async function inventory(edition: Edition) {
  const hash = createHash("sha256")
  let count = 0
  let after = -1
  while (true) {
    const rows = z.array(memberSchema).parse(
      (
        await pool.query(
          `SELECT m.ordinal,m.version_id,v.content_hash,v.input_contract,m.native_id,m.source_locator,
          left(concat_ws(E'\n',c.jurisdiction_id,c.name,m.native_id,v.heading),16001) AS context
      FROM legislation.legal_edition_provisions m JOIN legislation.legal_provision_versions v ON v.id=m.version_id
      JOIN legislation.legal_codes c ON c.id=m.code_id
      WHERE m.edition_id=$1 AND m.ordinal>$2 ORDER BY m.ordinal LIMIT 1000`,
          [edition.id, after]
        )
      ).rows
    )
    for (const row of rows) {
      hash.update(JSON.stringify(row) + "\n")
      count++
      after = row.ordinal
    }
    if (rows.length < 1000) {
      break
    }
  }
  invariant(count > 0, "shape_inventory_empty")
  return { count, hash: hash.digest("hex") }
}
async function inspect(edition: Edition) {
  const initial = await inventory(edition)
  const rightsHash = await rights(edition)
  const key = digest(
    JSON.stringify([legalPassageShapeContract, implementationHash, preparation, edition, initial, rightsHash])
  )
  const directory = join(output, key)
  await mkdir(directory, { recursive: true })
  const reportPath = join(directory, "report.json")
  let previous: string | undefined
  try {
    previous = await readFile(reportPath, "utf8")
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error
    }
  }
  if (previous !== undefined) {
    const report = summarySchema.parse(JSON.parse(previous))
    invariant(
      report.implementationHash === implementationHash &&
        isDeepStrictEqual(report.preparation, preparation) &&
        report.inventoryHash === initial.hash &&
        report.rightsHash === rightsHash &&
        isDeepStrictEqual(report.edition, edition),
      "shape_report_binding_mismatch"
    )
    const total = counters()
    const hash = createHash("sha256")
    const stream = createReadStream(join(directory, "records.ndjson"))
    stream.on("data", (bytes) => hash.update(bytes))
    for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
      add(total, JSON.parse(line))
    }
    invariant(
      hash.digest("hex") === report.dataHash &&
        isDeepStrictEqual(total, report.counters) &&
        total.records === initial.count,
      "shape_report_replay_mismatch"
    )
    invariant(
      (await rights(edition)) === rightsHash && isDeepStrictEqual(await inventory(edition), initial),
      "shape_source_changed"
    )
    return { key, reused: true, ...report }
  }
  const lock = await open(join(directory, "active.lock"), "wx")
  const pending = join(directory, `${randomUUID()}.pending`)
  let file: Awaited<ReturnType<typeof open>> | undefined
  const total = counters()
  const hash = createHash("sha256")
  const scanned = createHash("sha256")
  const emit = async (
    member: z.infer<typeof memberSchema>,
    inspection: unknown,
    prepared: z.infer<typeof legalPreparationInspectionSchema>[]
  ) => {
    scanned.update(JSON.stringify(member) + "\n")
    const value = {
      ordinal: member.ordinal,
      versionId: member.version_id,
      contentHash: member.content_hash,
      nativeId: member.native_id,
      sourceLocator: member.source_locator,
      preparation: prepared,
      inspection
    }
    add(total, value)
    const line = JSON.stringify(value) + "\n"
    hash.update(line)
    invariant(file, "shape_output_unavailable")
    await file.writeFile(line)
  }
  try {
    file = await open(pending, "wx")
    let after = -1
    while (true) {
      invariant((await rights(edition)) === rightsHash, "shape_rights_changed")
      const page = z.array(sizedSchema).parse(
        (
          await pool.query(
            `SELECT m.ordinal,m.version_id,v.content_hash,v.input_contract,m.native_id,m.source_locator,octet_length(v.body) AS body_bytes,octet_length(v.blocks::text) AS blocks_bytes,
            left(concat_ws(E'\n',c.jurisdiction_id,c.name,m.native_id,v.heading),16001) AS context
        FROM legislation.legal_edition_provisions m JOIN legislation.legal_provision_versions v ON v.id=m.version_id
        JOIN legislation.legal_codes c ON c.id=m.code_id
        WHERE m.edition_id=$1 AND m.ordinal>$2 ORDER BY m.ordinal LIMIT 100`,
            [edition.id, after]
          )
        ).rows
      )
      let start = 0
      while (start < page.length) {
        const first = page[start]
        invariant(first, "shape_page_empty")
        if (first.body_bytes + first.blocks_bytes > 16 * 1024 * 1024) {
          await emit(
            memberSchema.parse(first),
            {
              status: "oversized",
              reason: "inspection_row_byte_limit",
              bodyBytes: first.body_bytes
            },
            preparation.map((identity) => ({
              ...identity,
              contextHash: digest(first.context.trim()),
              status: "blocked",
              reason: "inspection_row_byte_limit"
            }))
          )
          start++
          continue
        }
        let end = start
        let bytes = 0
        while (end < page.length) {
          const item = page[end]
          invariant(item, "shape_page_empty")
          if (bytes + item.body_bytes + item.blocks_bytes > 16 * 1024 * 1024) {
            break
          }
          bytes += item.body_bytes + item.blocks_bytes
          end++
        }
        const group = page.slice(start, end)
        const bodies = z
          .array(storedSchema)
          .parse(
            (
              await pool.query(
                "SELECT id,body,blocks,heading,node_kind,input_contract,language FROM legislation.legal_provision_versions WHERE id=ANY($1::uuid[]) AND octet_length(body)+octet_length(blocks::text)<=16777216",
                [group.map((item) => item.version_id)]
              )
            ).rows
          )
        const byId = new Map(bodies.map((row) => [row.id, row]))
        for (const item of group) {
          const row = byId.get(item.version_id)
          invariant(
            row && row.input_contract === regulatoryStorageContract && row.input_contract === item.input_contract,
            "shape_version_changed"
          )
          const contentHash = provisionContent({
            contract: regulatoryParserContract,
            nodeKind: row.node_kind,
            heading: row.heading,
            text: row.body,
            blocks: storedLegalSourceBlocks({ body: row.body, blocks: row.blocks, inputContract: row.input_contract })
          })
          invariant(contentHash === item.content_hash, "shape_canonical_content_mismatch")
          await emit(
            memberSchema.parse(item),
            inspectLegalPassageShape({
              versionId: row.id,
              body: row.body,
              blocks: row.blocks,
              inputContract: row.input_contract,
              nodeKind: row.node_kind
            }),
            tokenizers.map(({ model, tokenizer }) =>
              inspectLegalPassagePreparation({
                versionId: row.id,
                body: row.body,
                blocks: row.blocks,
                inputContract: row.input_contract,
                context: item.context,
                model,
                tokenizer
              })
            )
          )
        }
        start = end
      }
      if (page.length < 100) {
        break
      }
      const last = page.at(-1)
      invariant(last && last.ordinal > after, "shape_cursor_stalled")
      after = last.ordinal
    }
    invariant(
      total.records === initial.count &&
        scanned.digest("hex") === initial.hash &&
        isDeepStrictEqual(await inventory(edition), initial) &&
        (await rights(edition)) === rightsHash,
      "shape_inventory_changed"
    )
    await file.close()
    invariant((await fingerprint()) === implementationHash, "shape_implementation_changed")
    await rename(pending, join(directory, "records.ndjson"))
    const report = {
      contract: legalPassageShapeContract,
      implementationHash,
      preparation,
      edition,
      inventoryHash: initial.hash,
      rightsHash,
      dataHash: hash.digest("hex"),
      counters: total
    }
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" })
    return { key, reused: false, ...report }
  } finally {
    try {
      await file?.close()
    } finally {
      try {
        await lock.close()
      } finally {
        await unlink(join(directory, "active.lock"))
      }
    }
  }
}
await mkdir(output, { recursive: true })
try {
  const selected = await editions()
  const results = []
  for (const edition of selected) {
    const result = await inspect(edition)
    results.push(result)
    console.error(
      JSON.stringify({
        editionId: edition.id,
        nativeKey: edition.native_key,
        reused: result.reused,
        ...result.counters
      })
    )
    await writeFile(
      join(output, "progress.json"),
      JSON.stringify(
        { contract: legalPassageShapeContract, implementationHash, preparation, selected, results, complete: false },
        null,
        2
      ) + "\n"
    )
  }
  invariant(isDeepStrictEqual(await editions(), selected), "shape_selected_heads_changed")
  invariant((await fingerprint()) === implementationHash, "shape_implementation_changed")
  await writeFile(
    join(output, "inventory.json"),
    JSON.stringify(
      { contract: legalPassageShapeContract, implementationHash, preparation, selected, results, complete: true },
      null,
      2
    ) + "\n"
  )
} finally {
  await pool.end()
}
