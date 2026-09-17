import { createHash } from "node:crypto"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { Telemetry } from "@repo/legislation-core/observability/telemetry"
import { analyticsDataset, type AnalyticsDataset } from "@repo/legislation-core/research/analytics-catalog"
import {
  analyticsFilterSchema,
  analyticsQuerySchema,
  type AnalyticsQuery
} from "@repo/legislation-core/research/analytics-contract"
import { sql, type SQL } from "drizzle-orm"
import { z } from "zod"

function invalid(message: string): never {
  throw new LegislationError("invalid_request", message)
}

type CompiledAnalytics = {
  query: AnalyticsQuery
  statement: SQL
  unpaged: SQL
  joinCount: number
}

export function compileAnalytics(input: unknown): CompiledAnalytics {
  return compileAnalyticsQuery(analyticsQuerySchema.parse(input), false)
}

function compileAnalyticsQuery(query: AnalyticsQuery, hasOuterGrouping: boolean): CompiledAnalytics {
  const root = analyticsDataset(query.dataset)
  const nodes = new Map<string, { dataset: AnalyticsDataset; alias: string }>([["", { dataset: root, alias: "root" }]])
  const joins: SQL[] = []
  let hasFanOut = false
  const column = (alias: string, name: string) => sql`${sql.identifier(alias)}.${sql.identifier(name)}`
  function visibility(dataset: AnalyticsDataset, alias: string): SQL[] {
    const predicates: SQL[] = []
    if (dataset === analyticsDataset("meetings")) {
      predicates.push(sql`${column(alias, "is_deleted")} = false`)
    }
    if (dataset === analyticsDataset("votes")) {
      return predicates
    }
    for (const relation of Object.values(dataset.relations)) {
      if (relation.many || relation.dataset !== "meetings") {
        continue
      }
      const key = relation.columns[0]
      if (!key) {
        return invalid("Missing meeting relationship key")
      }
      const meeting = analyticsDataset("meetings")
      predicates.push(
        sql`(${column(alias, key)} is null or exists (select 1 from ${meeting.table} visible_meeting where visible_meeting.id = ${column(alias, key)} and visible_meeting.is_deleted = false))`
      )
    }
    return predicates
  }
  function field(path: string) {
    const parts = path.split(".")
    const name = parts.pop()
    let prefix = ""
    let node: { dataset: AnalyticsDataset; alias: string } = { dataset: root, alias: "root" }
    if (!name) return invalid("Invalid field")
    for (const relationName of parts) {
      const nextPrefix = prefix ? `${prefix}.${relationName}` : relationName
      let next = nodes.get(nextPrefix)
      if (!next) {
        if (!Object.hasOwn(node.dataset.relations, relationName)) return invalid(`Unknown relationship: ${nextPrefix}`)
        const relation: AnalyticsDataset["relations"][string] | undefined = node.dataset.relations[relationName]
        if (!relation) return invalid("Unknown relationship")
        if (joins.length >= 8) return invalid("Analytics allows at most eight joins")
        hasFanOut ||= relation.many
        next = { dataset: analyticsDataset(relation.dataset), alias: `join${nodes.size}` }
        const sourceAlias = node.alias
        const targetAlias = next.alias
        const conditions = relation.columns.map((key, index) => {
          const target = relation.targetColumns[index]
          if (!target) return invalid("Invalid relationship configuration")
          return sql`${column(sourceAlias, key)} = ${column(targetAlias, target)}`
        })
        conditions.push(...visibility(next.dataset, next.alias))
        joins.push(
          sql`left join ${next.dataset.table} ${sql.identifier(next.alias)} on ${sql.join(conditions, sql` and `)}`
        )
        nodes.set(nextPrefix, next)
      }
      node = next
      prefix = nextPrefix
    }
    if (name === "_key") {
      const keys = node.dataset.keys.map((key) => column(node.alias, key))
      const first = keys[0]
      if (!first) return invalid("Dataset has no identity")
      if (keys.length === 1) {
        return { expression: first, isIdentityName: false, type: "identity" }
      }
      return {
        expression: sql`case when ${first} is null then null else jsonb_build_array(${sql.join(keys, sql`, `)}) end`,
        isIdentityName: false,
        type: "identity"
      }
    }
    if (!Object.hasOwn(node.dataset.fields, name)) return invalid(`Unknown field: ${path}`)
    const selected = node.dataset.fields[name]
    if (!selected) return invalid("Unknown field")
    const isIdentityName =
      name === "name" &&
      [
        analyticsDataset("people"),
        analyticsDataset("organizations"),
        analyticsDataset("sponsorships"),
        analyticsDataset("participants")
      ].includes(node.dataset)
    return { expression: column(node.alias, selected.column), type: selected.type, isIdentityName }
  }
  function filter(inputFilter: z.output<typeof analyticsFilterSchema>): SQL {
    const selected = field(inputFilter.field)
    const values = inputFilter.values
    if (inputFilter.op === "isNull" || inputFilter.op === "notNull") {
      if (values.length) return invalid("Null filters do not accept values")
      if (inputFilter.op === "isNull") return sql`${selected.expression} is null`
      return sql`${selected.expression} is not null`
    }
    if (!values.length) return invalid("A filter requires values")
    if (selected.isIdentityName && ["eq", "in", "notIn"].includes(inputFilter.op)) {
      return invalid(
        "Resolve the person or organization with resolve_record and filter its canonical ID. Published names may be inverted or ambiguous; do not treat a literal name mismatch as zero activity."
      )
    }
    for (const value of values) {
      if (selected.type === "boolean" && typeof value !== "boolean")
        return invalid("Boolean field requires boolean values")
      if (selected.type === "number" && typeof value !== "number")
        return invalid("Numeric field requires numeric values")
      if (["string", "date", "array"].includes(selected.type) && typeof value !== "string")
        return invalid("Text/date/array field requires string values")
      if (selected.type === "identity") return invalid("Filter identity columns rather than _key")
    }
    if (selected.type === "array" && inputFilter.op !== "contains")
      return invalid("Array fields support contains or null filters")
    if (inputFilter.op === "in")
      return sql`${selected.expression} in (${sql.join(
        values.map((value) => sql`${value}`),
        sql`, `
      )})`
    if (inputFilter.op === "notIn")
      return sql`${selected.expression} not in (${sql.join(
        values.map((value) => sql`${value}`),
        sql`, `
      )})`
    if (values.length !== 1) return invalid("This filter requires exactly one value")
    const value = values[0]
    if (inputFilter.op === "contains") {
      if (typeof value !== "string") return invalid("contains requires text")
      if (selected.type === "array") return sql`${selected.expression} @> array[${value}]::text[]`
      if (selected.type !== "string") return invalid("contains requires a text or array field")
      const literal = value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")
      return sql`${selected.expression} ilike ${`%${literal}%`}`
    }
    if (inputFilter.op === "gte") return sql`${selected.expression} >= ${value}`
    if (inputFilter.op === "lte") return sql`${selected.expression} <= ${value}`
    return sql`${selected.expression} = ${value}`
  }
  const aliases = [
    ...query.select,
    ...query.metrics.map((metric) => metric.name),
    ...query.rates.map((rate) => rate.name)
  ]
  if (!aliases.length || new Set(aliases).size !== aliases.length) return invalid("Select unique fields or metrics")
  for (const path of [
    ...query.select,
    ...query.filters.map((item) => item.field),
    ...query.metrics.flatMap((metric) => [metric.field, ...metric.filters.map((item) => item.field)])
  ])
    field(path)
  const groups = query.select.map((path) => field(path).expression)
  const projections = groups.map(
    (expression, index) => sql`${expression} as ${sql.identifier(query.select[index] ?? "")}`
  )
  for (const metric of query.metrics) {
    const selected = field(metric.field)
    let expression: SQL
    const count = metric.field === "_key" && !hasFanOut ? sql`count(*)` : sql`count(distinct ${selected.expression})`
    if (metric.operation === "countDistinct") expression = sql`${count}::float8`
    else {
      if (["identity", "array", "boolean"].includes(selected.type))
        return invalid("min/max requires a scalar text, date or number")
      expression = metric.operation === "min" ? sql`min(${selected.expression})` : sql`max(${selected.expression})`
    }
    if (metric.filters.length) {
      const predicate = sql.join(metric.filters.map(filter), sql` and `)
      if (metric.operation === "countDistinct") expression = sql`(${count} filter (where ${predicate}))::float8`
      else if (metric.operation === "min") expression = sql`min(${selected.expression}) filter (where ${predicate})`
      else expression = sql`max(${selected.expression}) filter (where ${predicate})`
    }
    projections.push(sql`${expression} as ${sql.identifier(metric.name)}`)
  }
  const conditions = query.filters.map(filter)
  const groupParents = query.select.map((path) => path.split(".").slice(0, -1).join("."))
  const groupParent = groupParents[0]
  const groupFilters: AnalyticsQuery["filters"] = []
  if (
    !hasOuterGrouping &&
    groupParent &&
    groupParents.every((parent) => parent === groupParent) &&
    query.metrics.length > 0 &&
    query.metrics.every((metric) => metric.field.startsWith(`${groupParent}.`))
  ) {
    groupFilters.push({ field: `${groupParent}._key`, op: "notNull", values: [] })
    conditions.push(...groupFilters.map(filter))
  }
  const onlyMetric = query.metrics.length === 1 ? query.metrics[0] : undefined
  const requiresPositiveCount =
    onlyMetric?.operation === "countDistinct" &&
    query.having.some(
      (condition) => condition.field === onlyMetric.name && ["eq", "gte"].includes(condition.op) && condition.value > 0
    )
  if (onlyMetric && (!query.select.length || requiresPositiveCount)) {
    conditions.push(...onlyMetric.filters.map(filter))
    if (requiresPositiveCount) {
      conditions.push(sql`${field(onlyMetric.field).expression} is not null`)
    }
  }
  conditions.push(...visibility(root, "root"))
  let statement = sql`select distinct ${sql.join(projections, sql`, `)} from ${root.table} ${sql.identifier("root")} ${sql.join(joins, sql` `)}`
  if (conditions.length) statement.append(sql` where ${sql.join(conditions, sql` and `)}`)
  if (query.metrics.length && groups.length) statement.append(sql` group by ${sql.join(groups, sql`, `)}`)
  if (query.metrics.length > 1) {
    const branches = query.metrics.map((metric) =>
      compileAnalyticsQuery(
        {
          ...query,
          filters: [...query.filters, ...groupFilters],
          metrics: [metric],
          rates: [],
          having: [],
          orderBy: [],
          offset: 0
        },
        true
      )
    )
    const first = branches[0]
    if (!first) return invalid("Missing aggregate branch")
    const selections = query.select.map((name) => sql`${column("metric0", name)} as ${sql.identifier(name)}`)
    query.metrics.forEach((metric, index) =>
      selections.push(sql`${column(`metric${index}`, metric.name)} as ${sql.identifier(metric.name)}`)
    )
    const branchJoins = branches.slice(1).map((branch, index) => {
      const alias = `metric${index + 1}`
      if (!query.select.length) return sql`cross join (${branch.unpaged}) ${sql.identifier(alias)}`
      const leftKey = sql`jsonb_build_array(${sql.join(
        query.select.map((name) => column("metric0", name)),
        sql`, `
      )})`
      const rightKey = sql`jsonb_build_array(${sql.join(
        query.select.map((name) => column(alias, name)),
        sql`, `
      )})`
      return sql`join (${branch.unpaged}) ${sql.identifier(alias)} on ${leftKey} = ${rightKey}`
    })
    statement = sql`select ${sql.join(selections, sql`, `)} from (${first.unpaged}) ${sql.identifier("metric0")} ${sql.join(branchJoins, sql` `)}`
  }
  const countNames = new Set(
    query.metrics.filter((metric) => metric.operation === "countDistinct").map((metric) => metric.name)
  )
  const rates = query.rates.map((rate) => {
    if (!countNames.has(rate.numerator) || !countNames.has(rate.denominator))
      return invalid("Rates require named countDistinct numerator and denominator metrics")
    const numerator = query.metrics.find((metric) => metric.name === rate.numerator)
    const denominator = query.metrics.find((metric) => metric.name === rate.denominator)
    if (numerator?.field !== denominator?.field)
      return invalid("A percentage requires the same distinct counting field for numerator and denominator")
    if (
      denominator?.filters.some(
        (condition) => !numerator?.filters.some((candidate) => JSON.stringify(candidate) === JSON.stringify(condition))
      )
    )
      return invalid("Numerator filters must include the denominator filters so the numerator is a subset")
    return sql`100.0 * ${sql.identifier(rate.numerator)} / nullif(${sql.identifier(rate.denominator)}, 0) as ${sql.identifier(rate.name)}`
  })
  if (rates.length) statement = sql`select aggregated.*, ${sql.join(rates, sql`, `)} from (${statement}) aggregated`
  const metricNames = new Set([...query.metrics.map((metric) => metric.name), ...query.rates.map((rate) => rate.name)])
  const having = query.having.map((condition) => {
    if (!metricNames.has(condition.field)) return invalid("having requires a metric or rate")
    if (condition.op === "gte") return sql`${sql.identifier(condition.field)} >= ${condition.value}`
    if (condition.op === "lte") return sql`${sql.identifier(condition.field)} <= ${condition.value}`
    return sql`${sql.identifier(condition.field)} = ${condition.value}`
  })
  statement = sql`select * from (${statement}) results`
  if (having.length) statement.append(sql` where ${sql.join(having, sql` and `)}`)
  const order = query.orderBy.map((item) => {
    if (!aliases.includes(item.field)) return invalid("Order by a selected field, metric or rate")
    return sql`${sql.identifier(item.field)} ${item.direction === "desc" ? sql`desc` : sql`asc`} nulls last`
  })
  for (const name of aliases.filter((name) => !query.orderBy.some((item) => item.field === name)))
    order.push(sql`${sql.identifier(name)} asc nulls last`)
  const unpaged = statement
  statement = sql`${unpaged} order by ${sql.join(order, sql`, `)} limit ${query.limit + 1} offset ${query.offset}`
  return { query, statement, unpaged, joinCount: joins.length }
}

export async function analyzeLegislation(database: LegislationDatabase, input: unknown, telemetry?: Telemetry) {
  const startedAt = performance.now()
  const metadata: Record<string, unknown> = { input }
  async function observe<Result>(stage: string, operation: () => Promise<Result>) {
    try {
      return telemetry ? await telemetry.observe(`analytics.${stage}`, metadata, operation) : await operation()
    } catch (error) {
      telemetry?.reportFailure?.(
        "analytics",
        { ...metadata, stage, durationMs: Math.round(performance.now() - startedAt) },
        error
      )
      throw error
    }
  }
  const { query, statement, queryHash } = await observe("compile", async () => {
    const compiled = compileAnalytics(input)
    const queryHash = createHash("sha256").update(JSON.stringify(compiled.query)).digest("hex")
    Object.assign(metadata, {
      queryHash,
      dataset: compiled.query.dataset,
      joinCount: compiled.joinCount,
      selectedFields: compiled.query.select,
      metrics: compiled.query.metrics,
      limit: compiled.query.limit,
      offset: compiled.query.offset
    })
    return { ...compiled, queryHash }
  })
  const response = await observe("execute", async () => {
    const result = await database.execute(statement)
    metadata.databaseRows = result.rows.length
    return result
  })
  return await observe("serialize", async () => {
    const rows = z
      .array(z.record(z.string(), z.json()))
      .parse(JSON.parse(JSON.stringify(response.rows.slice(0, query.limit))))
    const resultBytes = Buffer.byteLength(JSON.stringify(rows), "utf8")
    Object.assign(metadata, { rowCount: rows.length, resultBytes, hasMore: response.rows.length > query.limit })
    if (resultBytes > 150_000)
      throw new LegislationError("payload_too_large", "Select fewer fields or a smaller analytics limit")
    return {
      query,
      rows,
      receipt: {
        queryHash,
        queryId: `aq_${queryHash.slice(0, 16)}`,
        executedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - startedAt),
        population: "locally_recorded",
        upstreamCompleteness: "unknown",
        returned: rows.length,
        nextOffset: response.rows.length > query.limit ? query.offset + query.limit : null
      },
      warnings: [
        "Results cover the data collected so far. Missing records or links may affect counts and rankings.",
        "Counts use distinct selected identities, not joined row counts. Rates are percentages of the returned denominator. Equal metric values remain ties; a result limit may cut a tie.",
        "A query receipt is reproducible database evidence, not an official publisher citation. Use selected source URLs or drill into contributing records for source evidence."
      ]
    }
  })
}
