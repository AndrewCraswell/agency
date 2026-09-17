import { analyticsDataset } from "@repo/legislation-core/research/analytics-catalog"
import type { AnalyticsQuery } from "@repo/legislation-core/research/analytics-contract"

type MetricFilter = AnalyticsQuery["metrics"][number]["filters"][number]
export type AnalyticsMetricBinding = { name: string; grain: string; filters: MetricFilter[] }
export type AnalyticsHelperMetric = { grain: string; filters: MetricFilter[] }

function analyticsMetricGrain(datasetName: string, path: string) {
  const parts = path.split(".")
  let currentName = datasetName
  let dataset = analyticsDataset(currentName)
  for (const relationName of parts.slice(0, -1)) {
    const relation = dataset.relations[relationName]
    if (!relation) {
      throw new Error("Unknown metric relationship")
    }
    currentName = relation.dataset
    dataset = analyticsDataset(currentName)
  }
  let name = parts.at(-1) ?? ""
  if (name === "_key" && dataset.keys.length === 1) {
    name = Object.entries(dataset.fields).find(([, field]) => field.column === dataset.keys[0])?.[0] ?? name
  }
  const field = dataset.fields[name]
  const relation = Object.values(dataset.relations).find(
    (candidate) => !candidate.many && candidate.columns.at(-1) === field?.column
  )
  if (relation) {
    const target = analyticsDataset(relation.dataset)
    const targetField = Object.entries(target.fields).find(
      ([, value]) => value.column === relation.targetColumns.at(-1)
    )?.[0]
    if (targetField) {
      return `${relation.dataset}.${targetField}`
    }
  }
  return `${currentName}.${name}`
}

export function analyticsMetricProjection(
  query: AnalyticsQuery,
  bindings: readonly AnalyticsMetricBinding[] = [],
  helpers: readonly AnalyticsHelperMetric[] = []
) {
  const signature = (condition: MetricFilter) =>
    JSON.stringify({
      field: analyticsMetricGrain(query.dataset, condition.field),
      op: condition.op,
      values: [...condition.values].sort((left, right) => String(left).localeCompare(String(right)))
    })
  const referenceSignature = (condition: MetricFilter) =>
    JSON.stringify({
      ...condition,
      values: [...condition.values].sort((left, right) => String(left).localeCompare(String(right)))
    })
  const topFilters = new Set(query.filters.map(signature))
  const metricFilters = query.metrics.map((metric) =>
    metric.filters.map(signature).filter((value) => !topFilters.has(value))
  )
  const commonFilters = new Set(
    metricFilters[0]?.filter((value) => metricFilters.every((filters) => filters.includes(value))) ?? []
  )
  const normalizedFilters = metricFilters.map((filters) => filters.filter((value) => !commonFilters.has(value)).sort())
  const grain = (metric: AnalyticsQuery["metrics"][number]) =>
    `${metric.operation}:${analyticsMetricGrain(query.dataset, metric.field)}`
  const aliases = new Map<string, string>()
  let hasValidBindings = true
  for (const binding of bindings) {
    const expected = JSON.stringify(binding.filters.map(referenceSignature).sort())
    const candidates = query.metrics.filter(
      (metric, index) => grain(metric) === binding.grain && JSON.stringify(normalizedFilters[index]) === expected
    )
    const candidate = candidates[0]
    if (candidates.length !== 1 || !candidate || aliases.has(candidate.name)) {
      hasValidBindings = false
      continue
    }
    aliases.set(candidate.name, binding.name)
  }
  const hidden = new Set<string>()
  for (const helper of helpers) {
    const expected = JSON.stringify(helper.filters.map(referenceSignature).sort())
    const candidates = query.metrics.filter((metric, index) => {
      if (
        aliases.has(metric.name) ||
        grain(metric) !== helper.grain ||
        JSON.stringify(normalizedFilters[index]) !== expected
      ) {
        return false
      }
      const constraints = query.having.filter((condition) => condition.field === metric.name)
      return (
        constraints.length === 1 &&
        constraints[0]?.op === "gte" &&
        constraints[0].value === 1 &&
        !query.orderBy.some((order) => order.field === metric.name) &&
        !query.rates.some((rate) => rate.numerator === metric.name || rate.denominator === metric.name)
      )
    })
    if (candidates.length === 1 && candidates[0]) {
      hidden.add(candidates[0].name)
    }
  }
  const canonicalNames = [
    ...query.select,
    ...query.metrics
      .filter((metric) => !hidden.has(metric.name))
      .map((metric) => aliases.get(metric.name) ?? metric.name),
    ...query.rates.map((rate) => rate.name)
  ]
  hasValidBindings &&= new Set(canonicalNames).size === canonicalNames.length
  return {
    hasValidBindings,
    actualMetrics: query.metrics.filter((metric) => !hidden.has(metric.name)).map(grain),
    acceptedAliases: Object.fromEntries(aliases),
    helperMetrics: [...hidden],
    project(rows: Record<string, unknown>[]) {
      return rows.map((row) =>
        Object.fromEntries(
          Object.entries(row)
            .filter(([key]) => !hidden.has(key))
            .map(([key, value]) => [aliases.get(key) ?? key, value])
        )
      )
    }
  }
}
