import { createHash } from "node:crypto"
import { PgDialect } from "drizzle-orm/pg-core"
import { z } from "zod"
import { buildLexicalSupportingMaterialCandidateQuery } from "./query-service"

const diagnosticQueryNameSchema = z.enum(["supporting_material.search.lexical"])
const diagnosticFixtureNameSchema = z.enum(["student-data"])
const diagnosticInputSchema = z.object({
  fixture: diagnosticFixtureNameSchema,
  query: diagnosticQueryNameSchema,
  timeoutMs: z.number().int().min(1_000).max(30_000)
})
const planEnvelopeSchema = z
  .array(
    z
      .object({
        "Execution Time": z.number().finite().nonnegative(),
        Plan: z.record(z.string(), z.unknown()),
        "Planning Time": z.number().finite().nonnegative(),
        Settings: z.record(z.string(), z.unknown()).optional()
      })
      .passthrough()
  )
  .length(1)
const planNodeSchema = z
  .object({
    "Actual Loops": z.number().finite().nonnegative().optional(),
    "Actual Rows": z.number().finite().nonnegative().optional(),
    "Actual Startup Time": z.number().finite().nonnegative().optional(),
    "Actual Total Time": z.number().finite().nonnegative().optional(),
    "Hash Batches": z.number().finite().nonnegative().optional(),
    "Index Name": z.string().min(1).optional(),
    "Join Type": z.string().min(1).optional(),
    "Node Type": z.string().min(1),
    "Peak Memory Usage": z.number().finite().nonnegative().optional(),
    "Plan Rows": z.number().finite().nonnegative().optional(),
    "Plan Width": z.number().finite().nonnegative().optional(),
    Plans: z.array(z.unknown()).optional(),
    "Relation Name": z.string().min(1).optional(),
    "Rows Removed by Filter": z.number().finite().nonnegative().optional(),
    "Rows Removed by Index Recheck": z.number().finite().nonnegative().optional(),
    "Rows Removed by Join Filter": z.number().finite().nonnegative().optional(),
    "Scan Direction": z.string().min(1).optional(),
    Schema: z.string().min(1).optional(),
    "Shared Dirtied Blocks": z.number().finite().nonnegative().optional(),
    "Shared Hit Blocks": z.number().finite().nonnegative().optional(),
    "Shared Read Blocks": z.number().finite().nonnegative().optional(),
    "Shared Written Blocks": z.number().finite().nonnegative().optional(),
    "Sort Method": z.string().min(1).optional(),
    "Sort Space Type": z.string().min(1).optional(),
    "Sort Space Used": z.number().finite().nonnegative().optional(),
    "Temp Read Blocks": z.number().finite().nonnegative().optional(),
    "Temp Written Blocks": z.number().finite().nonnegative().optional(),
    "WAL Bytes": z.number().finite().nonnegative().optional(),
    "WAL FPI": z.number().finite().nonnegative().optional(),
    "WAL Records": z.number().finite().nonnegative().optional()
  })
  .passthrough()

const MAX_PLAN_NODES = 200
const MAX_PLAN_DEPTH = 20
const MAX_REPORT_BYTES = 256_000

export type QueryPlanDiagnosticInput = z.input<typeof diagnosticInputSchema>

export type QueryPlanDiagnosticReport = Readonly<{
  query: Readonly<{
    database: "canonical"
    fixture: z.infer<typeof diagnosticFixtureNameSchema>
    name: z.infer<typeof diagnosticQueryNameSchema>
    observedQueryIds: readonly string[]
    revision: number
    source: string
  }>
  safeguards: Readonly<{
    analyzeEnabled: true
    maximumPlanNodes: number
    parametersIncluded: false
    queryTextIncluded: false
    transactionReadOnly: true
  }>
  result: Readonly<{
    orderedDigest: string
    rowCount: number
  }>
  plan: Readonly<{
    executionTimeMs: number
    nodes: readonly QueryPlanNodeSummary[]
    planningTimeMs: number
    settings: Readonly<Record<string, boolean | number | string>>
  }>
}>

type QueryPlanNodeSummary = Readonly<{
  actualLoops?: number
  actualRows?: number
  actualStartupTimeMs?: number
  actualTotalTimeMs?: number
  depth: number
  hashBatches?: number
  indexName?: string
  joinType?: string
  nodeType: string
  parentPath?: string
  path: string
  peakMemoryKilobytes?: number
  planRows?: number
  planWidthBytes?: number
  relationName?: string
  rowsRemovedByFilter?: number
  rowsRemovedByIndexRecheck?: number
  rowsRemovedByJoinFilter?: number
  scanDirection?: string
  schemaName?: string
  sharedBlocksDirtied?: number
  sharedBlocksHit?: number
  sharedBlocksRead?: number
  sharedBlocksWritten?: number
  sortMethod?: string
  sortSpaceKilobytes?: number
  sortSpaceType?: string
  temporaryBlocksRead?: number
  temporaryBlocksWritten?: number
  walBytes?: number
  walFullPageImages?: number
  walRecords?: number
}>

export interface QueryPlanDiagnosticClient {
  query(text: string, values?: unknown[]): Promise<Readonly<{ rows: Record<string, unknown>[] }>>
}

const definitions = {
  "supporting_material.search.lexical": {
    database: "canonical" as const,
    fixtures: {
      "student-data": () =>
        buildLexicalSupportingMaterialCandidateQuery(
          { limit: 5, mode: "lexical", query: "student data education technology vendor privacy" },
          "student data education technology vendor privacy",
          5,
          0
        )
    },
    observedQueryIds: ["1328274108816803535"],
    revision: 1,
    source: "apps/legislation-web/src/modules/legislation/query-service.ts#buildLexicalSupportingMaterialCandidateQuery"
  }
} satisfies Record<
  z.infer<typeof diagnosticQueryNameSchema>,
  Readonly<{
    database: "canonical"
    fixtures: Record<
      z.infer<typeof diagnosticFixtureNameSchema>,
      () => ReturnType<typeof buildLexicalSupportingMaterialCandidateQuery>
    >
    observedQueryIds: readonly string[]
    revision: number
    source: string
  }>
>

export function parseQueryPlanDiagnosticInput(input: unknown): QueryPlanDiagnosticInput {
  return diagnosticInputSchema.parse(input)
}

export async function runQueryPlanDiagnostic(
  client: QueryPlanDiagnosticClient,
  rawInput: QueryPlanDiagnosticInput
): Promise<QueryPlanDiagnosticReport> {
  const input = diagnosticInputSchema.parse(rawInput)
  const definition = definitions[input.query]
  const statement = new PgDialect().sqlToQuery(definition.fixtures[input.fixture]())
  assertReadOnlyStatement(statement.sql)

  let hasTransaction = false
  try {
    await client.query("begin read only")
    hasTransaction = true
    await client.query("select set_config('statement_timeout', $1, true), set_config('lock_timeout', $2, true)", [
      String(input.timeoutMs),
      "1000"
    ])
    const explained = await client.query(`explain (analyze, buffers, wal, settings, format json) ${statement.sql}`, [
      ...statement.params
    ])
    const result = await client.query(statement.sql, [...statement.params])
    const plan = parsePlan(explained.rows)
    const report: QueryPlanDiagnosticReport = {
      query: {
        database: definition.database,
        fixture: input.fixture,
        name: input.query,
        observedQueryIds: definition.observedQueryIds,
        revision: definition.revision,
        source: definition.source
      },
      safeguards: {
        analyzeEnabled: true,
        maximumPlanNodes: MAX_PLAN_NODES,
        parametersIncluded: false,
        queryTextIncluded: false,
        transactionReadOnly: true
      },
      result: {
        orderedDigest: orderedResultDigest(result.rows),
        rowCount: result.rows.length
      },
      plan
    }
    if (Buffer.byteLength(JSON.stringify(report), "utf8") > MAX_REPORT_BYTES) {
      throw new Error("Sanitized query plan report exceeded the output limit")
    }
    return report
  } finally {
    if (hasTransaction) {
      await client.query("rollback")
    }
  }
}

function assertReadOnlyStatement(statement: string): void {
  const normalized = statement.trim().toLowerCase()
  if (!normalized.startsWith("select") && !normalized.startsWith("with")) {
    throw new Error("Registered diagnostic statement must be a SELECT or WITH query")
  }
  if (/\b(?:alter|call|copy|create|delete|do|drop|grant|insert|merge|revoke|truncate|update)\b/u.test(normalized)) {
    throw new Error("Registered diagnostic statement contains a prohibited operation")
  }
}

function orderedResultDigest(rows: readonly Record<string, unknown>[]): string {
  const hash = createHash("sha256")
  for (const row of rows) {
    hash.update(JSON.stringify(row))
    hash.update("\n")
  }
  return `sha256:${hash.digest("hex")}`
}

function parsePlan(rows: readonly Record<string, unknown>[]): QueryPlanDiagnosticReport["plan"] {
  const envelope = planEnvelopeSchema.parse(rows[0]?.["QUERY PLAN"])
  const root = envelope[0]
  if (root === undefined) {
    throw new Error("PostgreSQL did not return an execution plan")
  }
  const nodes: QueryPlanNodeSummary[] = []
  collectPlanNodes(root.Plan, "0", undefined, 0, nodes)
  return {
    executionTimeMs: root["Execution Time"],
    nodes,
    planningTimeMs: root["Planning Time"],
    settings: safePlanSettings(root.Settings)
  }
}

function collectPlanNodes(
  input: unknown,
  path: string,
  parentPath: string | undefined,
  depth: number,
  output: QueryPlanNodeSummary[]
): void {
  if (depth > MAX_PLAN_DEPTH || output.length >= MAX_PLAN_NODES) {
    throw new Error("PostgreSQL execution plan exceeded the structural limit")
  }
  const node = planNodeSchema.parse(input)
  output.push({
    actualLoops: node["Actual Loops"],
    actualRows: node["Actual Rows"],
    actualStartupTimeMs: node["Actual Startup Time"],
    actualTotalTimeMs: node["Actual Total Time"],
    depth,
    hashBatches: node["Hash Batches"],
    indexName: node["Index Name"],
    joinType: node["Join Type"],
    nodeType: node["Node Type"],
    parentPath,
    path,
    peakMemoryKilobytes: node["Peak Memory Usage"],
    planRows: node["Plan Rows"],
    planWidthBytes: node["Plan Width"],
    relationName: node["Relation Name"],
    rowsRemovedByFilter: node["Rows Removed by Filter"],
    rowsRemovedByIndexRecheck: node["Rows Removed by Index Recheck"],
    rowsRemovedByJoinFilter: node["Rows Removed by Join Filter"],
    scanDirection: node["Scan Direction"],
    schemaName: node.Schema,
    sharedBlocksDirtied: node["Shared Dirtied Blocks"],
    sharedBlocksHit: node["Shared Hit Blocks"],
    sharedBlocksRead: node["Shared Read Blocks"],
    sharedBlocksWritten: node["Shared Written Blocks"],
    sortMethod: node["Sort Method"],
    sortSpaceKilobytes: node["Sort Space Used"],
    sortSpaceType: node["Sort Space Type"],
    temporaryBlocksRead: node["Temp Read Blocks"],
    temporaryBlocksWritten: node["Temp Written Blocks"],
    walBytes: node["WAL Bytes"],
    walFullPageImages: node["WAL FPI"],
    walRecords: node["WAL Records"]
  })
  for (const [index, child] of (node.Plans ?? []).entries()) {
    collectPlanNodes(child, `${path}.${index}`, path, depth + 1, output)
  }
}

function safePlanSettings(input: Readonly<Record<string, unknown>> | undefined) {
  const allowed = z
    .object({
      effective_cache_size: z.union([z.string(), z.number(), z.boolean()]).optional(),
      enable_hashjoin: z.union([z.string(), z.number(), z.boolean()]).optional(),
      enable_indexscan: z.union([z.string(), z.number(), z.boolean()]).optional(),
      enable_nestloop: z.union([z.string(), z.number(), z.boolean()]).optional(),
      enable_seqscan: z.union([z.string(), z.number(), z.boolean()]).optional(),
      jit: z.union([z.string(), z.number(), z.boolean()]).optional(),
      random_page_cost: z.union([z.string(), z.number(), z.boolean()]).optional(),
      statement_timeout: z.union([z.string(), z.number(), z.boolean()]).optional(),
      work_mem: z.union([z.string(), z.number(), z.boolean()]).optional()
    })
    .parse(input ?? {})
  return Object.fromEntries(Object.entries(allowed).filter((entry) => entry[1] !== undefined))
}
