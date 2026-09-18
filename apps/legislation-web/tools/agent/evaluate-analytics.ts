import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { isDeepStrictEqual } from "node:util"
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing"
import * as schema from "@repo/legislation-core/database/schema/schema"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { sanitizeTelemetry } from "@repo/legislation-core/observability/sanitize-telemetry"
import { analyticsDataset } from "@repo/legislation-core/research/analytics-catalog"
import { analyticsQuerySchema } from "@repo/legislation-core/research/analytics-contract"
import { createLegislationResearchTools } from "@repo/legislation-core/research/tools"
import { dynamicTool, generateText, isStepCount, Output, type ToolSet } from "ai"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { z } from "zod"
import { createResearchModel, researchModelId } from "../../src/modules/conversations/agent"
import { getResearchPrompt } from "../../src/modules/conversations/prompt"
import { modelInputSchema } from "../../src/modules/conversations/research"
import { analyticsMetricProjection } from "../../src/modules/evaluations/analyticsChecks"
import { LegislationQueryService } from "../../src/modules/legislation/query-service"
import { langfuseSettings } from "../../src/services/langfuse/client"
import { startLangfuseTelemetry } from "../../src/services/langfuse/telemetry"
import { analyticsCases, type AnalyticsCase } from "./analytics-cases"

const { values } = parseArgs({
  options: {
    references: { type: "boolean", default: false },
    replay: { type: "string" },
    case: { type: "string" },
    output: { type: "string", default: "tmp/analytics-acceptance" }
  }
})
const cell = z.union([z.string(), z.number(), z.boolean(), z.null()])
const answerSchema = z.strictObject({
  answer: z.string(),
  queryId: z.string().regex(/^aq_[a-f0-9]{16}$/),
  columns: z.array(z.string()).max(24),
  rows: z.array(z.array(cell).max(24)).max(100)
})
const toolDataSchema = z.object({
  query: analyticsQuerySchema,
  rows: z.array(z.record(z.string(), cell)),
  receipt: z.object({ queryHash: z.string(), queryId: z.string() })
})
const retainedCaseSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: answerSchema,
  reference: z.array(z.record(z.string(), cell)).optional(),
  calls: z.array(z.object({ name: z.string(), input: z.unknown(), output: z.unknown() })),
  usage: z.unknown().optional(),
  sessionId: z.string()
})
const logger = createLogger({ service: "analytics-acceptance", level: "error" })
const contract = `This is a read-only relationship analytics acceptance run. Today is 2026-09-17. Use the real tools to answer the user, never estimated values. Discover available field paths with describe_analytics. Exact scope and counting semantics in the question are mandatory.
Use only the requested output columns. A single requested count is always named total, even when filtered. Use matching only when a second count or numerator is explicitly requested alongside total. Use percent for percentages and earliest/latest for extrema. Do not add unsolicited totals or denominator columns. Canonical IDs (id or related entity id) must be selected and copied when the question asks for IDs; identifier is not an ID. Count distinct identity, not joined rows. For an unbounded question return at most ten result rows, stating when the result window has more rows. Sort requested rankings descending, breaking ties by canonical grouping ID then other requested grouping fields, ascending with nulls last. Explicitly ascending requests remain ascending.
Before your final response, check the tool query against every phrase of the question: the counted grain, the source of session scope (bill, amendment, vote or membership), explicit option literals (absent is not not-voting), required non-null filters, and exact output identity fields. Correct a wrong plan before answering. Do not convert a question scoped by amendment session into bill session, or count people when asked for position identities. A zero numerator must not cause you to switch categories. Reuse the first catalog instead of repeatedly discovering it.
Keep unknown grouping values unless explicitly excluded. Rankings retain entities with zero recorded relationships unless the question says only entities with a relationship or a minimum count. Do not add unsolicited notNull filters. Preserve the requested distinct grain even when two different grains happen to have equal counts.
Finish with the structured answer object. Set queryId to receipt.queryId of the chosen analyze_legislation result. Copy its rows without inventing, rounding or deleting values. For columns, remove relationship prefixes (bill.id becomes id); preserve field and metric names otherwise. rows is an array of arrays in columns order. Explain results briefly in answer, preserving locally-collected coverage caveats and unknowns. The query receipt is database evidence, not an official source citation. Never make citation anchors from queryId or queryHash. Do not invoke tools merely to produce citations for database aggregates. Never invent a zero or an entity for an empty result. Do not confuse current party with party at a historical vote.`

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function normalizeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    const entries = Object.entries(row).map(([key, value]) => {
      const name = key.split(".").at(-1) ?? key
      const normalized = typeof value === "number" ? Math.round(value * 1e6) / 1e6 : value
      return [name, normalized] as const
    })
    if (new Set(entries.map(([key]) => key)).size !== entries.length) {
      throw new Error("Ambiguous projected column names")
    }
    return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)))
  })
}

function sameRowValues(left: Record<string, unknown>[], right: Record<string, unknown>[]) {
  const values = (rows: Record<string, unknown>[]) =>
    normalizeRows(rows).map((row) =>
      Object.values(row)
        .map((value) => JSON.stringify(value))
        .sort()
    )
  return isDeepStrictEqual(values(left), values(right))
}

function scopeOwner(datasetName: string, path: string) {
  const parts = path.split(".")
  let name = datasetName
  let dataset = analyticsDataset(name)
  let foreignOwner: string | undefined
  for (const relationName of parts.slice(0, -1)) {
    const relation = dataset.relations[relationName]
    if (!relation) {
      return undefined
    }
    const key = Object.entries(dataset.fields).find(([, value]) => value.column === relation.columns.at(-1))?.[0]
    foreignOwner = relation.many || !key ? undefined : `${name}.${key}`
    name = relation.dataset
    dataset = analyticsDataset(name)
  }
  const field = parts.at(-1)
  if (field === "id" && foreignOwner) {
    return foreignOwner
  }
  return `${name}.${field}`
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required")
  }
  if (!values.references && !values.replay && !process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is required")
  }
  const selected = analyticsCases.filter((item) => !values.case || values.case.split(",").includes(item.id))
  if (!selected.length) {
    throw new Error("No matching acceptance cases")
  }
  const runId = randomUUID()
  const directory = path.resolve(values.output, runId)
  await mkdir(directory, { recursive: true })
  const replayCases = new Map<string, z.output<typeof retainedCaseSchema>>()
  if (values.replay) {
    for (const source of values.replay.split(",")) {
      for (const file of (await readdir(source)).filter((file) => /^analytics-\d{3}\.json$/.test(file))) {
        const parsed = retainedCaseSchema.safeParse(JSON.parse(await readFile(path.join(source, file), "utf8")))
        if (!parsed.success) {
          throw new Error(`Cannot replay incomplete result: ${file}`)
        }
        replayCases.set(parsed.data.id, parsed.data)
      }
    }
  }
  const hasLiveModel = !values.references && !values.replay
  const prompt = hasLiveModel ? await getResearchPrompt(process.env, AbortSignal.timeout(15000)) : undefined
  const telemetry = !hasLiveModel
    ? undefined
    : startLangfuseTelemetry({
        ...langfuseSettings(process.env),
        environment: "analytics-acceptance",
        mediaUploadEnabled: false,
        mask: ({ data }) => sanitizeTelemetry(data)
      })
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 10000
  })
  pg.types.setTypeParser(1700, Number)
  pg.types.setTypeParser(1082, (value) => value)
  const instructions = `${prompt?.prompt ?? ""}\n\n${contract}`
  const sources = await Promise.all(
    [
      new URL("../../../../packages/legislation-core/src/research/analytics.ts", import.meta.url),
      new URL("../../../../packages/legislation-core/src/research/analytics-contract.ts", import.meta.url),
      new URL("../../../../packages/legislation-core/src/research/analytics-catalog.ts", import.meta.url),
      new URL("./analytics-cases.ts", import.meta.url),
      new URL("../../src/modules/evaluations/analyticsChecks.ts", import.meta.url),
      new URL("./evaluate-analytics.ts", import.meta.url)
    ].map(async (url) => ({ file: url.pathname, hash: digest(await readFile(url, "utf8")) }))
  )
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(
      {
        runId,
        model: researchModelId,
        reasoning: "low",
        corpusHash: digest(analyticsCases),
        questionHash: digest(analyticsCases.map((item) => ({ id: item.id, question: item.question }))),
        sources,
        cases: analyticsCases,
        selected: selected.map((item) => item.id),
        instructions,
        promptVersion: prompt?.version,
        referencesOnly: values.references,
        replaySources: values.replay?.split(","),
        createdAt: new Date().toISOString()
      },
      null,
      2
    ),
    { flag: "wx" }
  )
  const results: Record<string, unknown>[] = []
  async function execute(item: AnalyticsCase) {
    const startedAt = performance.now()
    const sessionId = `${runId}:${item.id}`
    const client = await pool.connect()
    let record: Record<string, unknown> = { id: item.id, question: item.question, sessionId }
    try {
      await client.query("begin isolation level repeatable read read only")
      await client.query("set local statement_timeout = '15000'")
      await client.query("set local idle_in_transaction_session_timeout = '180000'")
      const snapshot = await client.query(
        "select pg_current_snapshot()::text as snapshot, transaction_timestamp() as observed_at"
      )
      let reference: Record<string, unknown>[] | undefined
      await client.query("savepoint reference_query")
      await client.query("set local statement_timeout = '60000'")
      const referenceStartedAt = performance.now()
      try {
        reference = z
          .array(z.record(z.string(), z.union([cell, z.date().transform((value) => value.toISOString())])))
          .parse((await client.query(item.referenceSql)).rows)
      } catch (error) {
        await client.query("rollback to savepoint reference_query")
        record.referenceError = sanitizeTelemetry(error)
        if (values.references) {
          throw error
        }
      }
      await client.query("release savepoint reference_query")
      await client.query("set local statement_timeout = '15000'")
      record.referenceDurationMs = Math.round(performance.now() - referenceStartedAt)
      record = { ...record, snapshot: snapshot.rows[0], reference }
      if (values.references) {
        record.status = "reference-verified"
      } else {
        const database = drizzle(client, { schema })
        const service = new LegislationQueryService(database)
        const definitions = createLegislationResearchTools(service, logger).filter((definition) =>
          [
            "describe_analytics",
            "analyze_legislation",
            "resolve_record",
            "list_jurisdictions",
            "list_sessions"
          ].includes(definition.name)
        )
        const calls: Array<{ name: string; input: unknown; output: unknown; durationMs: number }> = []
        record.toolSchemaHash = digest(
          definitions.map((definition) => ({
            name: definition.name,
            description: definition.description,
            schema: z.toJSONSchema(definition.inputSchema, { io: "input" })
          }))
        )
        record.calls = calls
        const tools: ToolSet = {}
        let callCount = 0
        let pending: Promise<unknown> = Promise.resolve()
        for (const definition of definitions) {
          tools[definition.name] = dynamicTool({
            description: definition.description,
            inputSchema: modelInputSchema(definition.inputSchema),
            execute: async (input) => {
              const execution = pending.then(async () => {
                callCount++
                if (callCount > 12) {
                  throw new Error("Analytics acceptance tool budget exceeded")
                }
                const started = performance.now()
                await client.query("savepoint analytics_tool")
                const result = await definition.execute(input)
                if ("isError" in result && result.isError) {
                  await client.query("rollback to savepoint analytics_tool")
                }
                await client.query("release savepoint analytics_tool")
                const output = "structuredContent" in result ? result.structuredContent.data : result
                calls.push({
                  name: definition.name,
                  input,
                  output,
                  durationMs: Math.round(performance.now() - started)
                })
                return output
              })
              pending = execution.catch(() => undefined)
              return await execution
            }
          })
        }
        const replayAnswer = async () => {
          const retained = replayCases.get(item.id)
          if (!retained || retained.question !== item.question) {
            throw new Error("Replay requires the unchanged original question and its retained LLM answer")
          }
          const source = retained.calls.find((call) => {
            const result = toolDataSchema.safeParse(call.output)
            return result.success && result.data.receipt.queryId === retained.answer.queryId
          })
          const definition = definitions.find((definition) => definition.name === "analyze_legislation")
          if (!source || !definition) {
            throw new Error("The retained LLM answer has no matching analytical receipt")
          }
          const started = performance.now()
          const result = await definition.execute(source.input)
          const output = "structuredContent" in result ? result.structuredContent.data : result
          calls.push({
            name: "analyze_legislation",
            input: source.input,
            output,
            durationMs: Math.round(performance.now() - started)
          })
          record.originalSessionId = retained.sessionId
          record.originalReference = retained.reference
          return { answer: retained.answer, usage: retained.usage, finishReason: "replayed-plan" }
        }
        const generated = values.replay
          ? await replayAnswer()
          : await propagateAttributes({ sessionId }, () =>
              startActiveObservation(
                "legislative-analytics-acceptance",
                async (observation) => {
                  observation.update({
                    input: item.question,
                    metadata: { caseId: item.id, runId, corpusHash: digest(analyticsCases) }
                  })
                  const response = await generateText({
                    model: createResearchModel(process.env.OPENROUTER_API_KEY, researchModelId, {
                      reasoning: { effort: "low" }
                    }),
                    instructions,
                    prompt: item.question,
                    tools,
                    stopWhen: isStepCount(8),
                    prepareStep: ({ stepNumber }) => (stepNumber === 7 ? { toolChoice: "none" } : {}),
                    maxOutputTokens: 6000,
                    maxRetries: 0,
                    output: Output.object({ schema: answerSchema }),
                    abortSignal: AbortSignal.timeout(150000)
                  })
                  observation.update({
                    output: response.output,
                    metadata: {
                      usage: {
                        input: response.totalUsage.inputTokens ?? 0,
                        output: response.totalUsage.outputTokens ?? 0
                      }
                    }
                  })
                  return { answer: response.output, usage: response.totalUsage, finishReason: response.finishReason }
                },
                { asType: "agent" }
              )
            )
        const answer = answerSchema.parse(generated.answer)
        const answerRows = answer.rows.map((row) => {
          if (row.length !== answer.columns.length) {
            throw new Error("Answer row width does not match columns")
          }
          return Object.fromEntries(answer.columns.map((name, index) => [name, row[index]]))
        })
        const selectedOutput = calls
          .map((call) => toolDataSchema.safeParse(call.output))
          .find((result) => result.success && result.data.receipt.queryId === answer.queryId)
        const hasGroundedOutput = selectedOutput?.success === true
        const hasExactToolRows =
          reference !== undefined &&
          hasGroundedOutput &&
          isDeepStrictEqual(normalizeRows(selectedOutput.data.rows), normalizeRows(reference))
        const hasExactAnswerRows =
          reference !== undefined && isDeepStrictEqual(normalizeRows(answerRows), normalizeRows(reference))
        const projection = hasGroundedOutput
          ? analyticsMetricProjection(selectedOutput.data.query, item.metricBindings, item.helperMetrics)
          : undefined
        const projectedToolRows = hasGroundedOutput ? (projection?.project(selectedOutput.data.rows) ?? []) : []
        const projectedAnswerRows = projection?.project(answerRows) ?? answerRows
        const hasCorrectToolRows =
          reference !== undefined &&
          hasGroundedOutput &&
          isDeepStrictEqual(normalizeRows(projectedToolRows), normalizeRows(reference))
        const hasCorrectAnswerRows =
          reference !== undefined && isDeepStrictEqual(normalizeRows(projectedAnswerRows), normalizeRows(reference))
        const actualMetrics = projection?.actualMetrics ?? []
        const hasCorrectMetricGrains =
          hasGroundedOutput &&
          projection?.hasValidBindings === true &&
          isDeepStrictEqual([...actualMetrics].sort(), [...item.expectedMetrics].sort())
        const hasNoFabricatedCitations = !answer.answer.includes("#citation-")
        const scopeOwners = hasGroundedOutput
          ? [
              ...selectedOutput.data.query.filters,
              ...(selectedOutput.data.query.metrics.length === 1
                ? (selectedOutput.data.query.metrics[0]?.filters ?? [])
                : [])
            ]
              .filter((filter) => ["eq", "in"].includes(filter.op))
              .map((filter) => scopeOwner(selectedOutput.data.query.dataset, filter.field))
          : []
        const hasCorrectScopeOwner = !item.requiredScope || scopeOwners.includes(item.requiredScope)
        const hasNoLiteralIdentity =
          hasGroundedOutput &&
          !selectedOutput.data.query.filters.some(
            (filter) => filter.field.endsWith(".name") && ["eq", "in", "notIn"].includes(filter.op)
          )
        const retainedReference = replayCases.get(item.id)?.reference
        const hasSourceDataDrift = Boolean(
          values.replay &&
          retainedReference &&
          reference &&
          hasCorrectToolRows &&
          !hasCorrectAnswerRows &&
          isDeepStrictEqual(normalizeRows(answerRows), normalizeRows(retainedReference)) &&
          hasCorrectMetricGrains &&
          hasCorrectScopeOwner &&
          hasNoLiteralIdentity &&
          hasNoFabricatedCitations
        )
        const hasAliasOnlyDifference =
          reference !== undefined &&
          hasGroundedOutput &&
          sameRowValues(selectedOutput.data.rows, reference) &&
          sameRowValues(answerRows, reference) &&
          !(hasCorrectToolRows && hasCorrectAnswerRows)
        let status =
          hasCorrectToolRows &&
          hasCorrectAnswerRows &&
          hasCorrectMetricGrains &&
          hasNoFabricatedCitations &&
          hasCorrectScopeOwner &&
          hasNoLiteralIdentity
            ? "matched"
            : "mismatch"
        if (reference === undefined) {
          status = "reference-blocked"
        }
        record = {
          ...record,
          ...generated,
          hasGroundedOutput,
          hasExactToolRows,
          hasExactAnswerRows,
          hasCorrectToolRows,
          hasCorrectAnswerRows,
          hasCorrectMetricGrains,
          hasNoFabricatedCitations,
          hasCorrectScopeOwner,
          hasNoLiteralIdentity,
          hasSourceDataDrift,
          scopeOwners,
          actualMetrics,
          acceptedMetricAliases: projection?.acceptedAliases,
          acceptedHelperMetrics: projection?.helperMetrics,
          hasAliasOnlyDifference,
          requiresEmptyPlanReview:
            reference !== undefined &&
            reference.every((row: Record<string, unknown>) =>
              Object.values(row).every((value) => value === 0 || value === null)
            ),
          status
        }
      }
      await client.query("rollback")
    } catch (error) {
      await client.query("rollback").catch(() => undefined)
      record = { ...record, status: "failed", error: sanitizeTelemetry(error) }
    } finally {
      client.release()
      record.durationMs = Math.round(performance.now() - startedAt)
      results.push(record)
      await writeFile(path.join(directory, `${item.id}.json`), JSON.stringify(record, null, 2), { flag: "wx" })
      process.stdout.write(`${item.id} ${String(record.status)} ${String(record.durationMs)}ms\n`)
    }
  }
  try {
    for (let index = 0; index < selected.length; index += 2) {
      await Promise.all(selected.slice(index, index + 2).map(execute))
    }
  } finally {
    await pool.end()
    await telemetry?.flush()
    await telemetry?.shutdown()
  }
  const summary = {
    runId,
    directory,
    mode: values.replay ? "retained-llm-plan-replay" : "live-llm",
    planned: selected.length,
    matched: results.filter((result) => result.status === "matched").length,
    referencesVerified: results.filter((result) => result.status === "reference-verified").length,
    failed: results.filter((result) => result.status === "failed").map((result) => result.id),
    mismatched: results.filter((result) => result.status === "mismatch").map((result) => result.id),
    referenceBlocked: results.filter((result) => result.status === "reference-blocked").map((result) => result.id),
    aliasOnlyDifferences: results.filter((result) => result.hasAliasOnlyDifference).map((result) => result.id),
    sourceDataDrift: results.filter((result) => result.hasSourceDataDrift).map((result) => result.id),
    requiresEmptyPlanReview: results.filter((result) => result.requiresEmptyPlanReview).map((result) => result.id)
  }
  const casesReport = results
    .map((result) => ({
      id: result.id,
      question: result.question,
      status: result.status,
      originalSessionId: result.originalSessionId ?? result.sessionId,
      hasGroundedOutput: result.hasGroundedOutput,
      hasCorrectToolRows: result.hasCorrectToolRows,
      hasCorrectAnswerRows: result.hasCorrectAnswerRows,
      hasCorrectMetricGrains: result.hasCorrectMetricGrains,
      hasCorrectScopeOwner: result.hasCorrectScopeOwner,
      hasNoLiteralIdentity: result.hasNoLiteralIdentity,
      hasNoFabricatedCitations: result.hasNoFabricatedCitations,
      hasSourceDataDrift: result.hasSourceDataDrift,
      requiresEmptyPlanReview: result.requiresEmptyPlanReview,
      durationMs: result.durationMs
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
  await writeFile(path.join(directory, "case-report.json"), JSON.stringify(casesReport, null, 2), { flag: "wx" })
  await writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2), { flag: "wx" })
  process.stdout.write(`${JSON.stringify(summary)}\n`)
  if (summary.failed.length || summary.mismatched.length || summary.referenceBlocked.length) {
    process.exitCode = 1
  }
}

await main()
