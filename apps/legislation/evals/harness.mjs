import { readFile } from "node:fs/promises"
import { performance } from "node:perf_hooks"
import { z } from "zod"

export const PRIMARY_TOOL_NAMES = [
  "compare_bill_versions",
  "find_related_bills",
  "get_bill",
  "get_bill_text",
  "get_bill_timeline",
  "search_bill_text",
  "search_bills"
]

const failureCategorySchema = z.enum([
  "authentication",
  "client",
  "corpus",
  "evaluation",
  "normalization",
  "processing",
  "retrieval",
  "tool_contract"
])
const assertionSchema = z.object({
  call: z.number().int().nonnegative(),
  category: failureCategorySchema,
  expected: z.unknown().optional(),
  metric: z.string().min(1),
  operator: z.enum([
    "contains",
    "dates_ascending",
    "equals",
    "is_official_url",
    "length_equals",
    "non_empty",
    "safe_error"
  ]),
  path: z.string(),
  source: z.enum(["data", "error"])
})
const callSchema = z.object({
  arguments: z.record(z.string(), z.unknown()),
  expectError: z.boolean().optional(),
  name: z.string().min(1)
})
const evaluationCaseSchema = z.object({
  evidence: z.array(z.string().min(1)).min(1),
  expectedTools: z.array(z.string().min(1)).min(1),
  id: z.string().min(1),
  local: z.object({
    assertions: z.array(assertionSchema).min(1),
    calls: z.array(callSchema).min(1)
  }),
  prompt: z.string().min(1),
  scenario: z.string().min(1)
})
const evaluationCasesSchema = z
  .array(evaluationCaseSchema)
  .min(1)
  .superRefine((cases, context) => {
    const ids = new Set()
    for (const [index, evaluationCase] of cases.entries()) {
      if (ids.has(evaluationCase.id)) {
        context.addIssue({ code: "custom", message: `Duplicate case ID ${evaluationCase.id}`, path: [index, "id"] })
      }
      ids.add(evaluationCase.id)
      const calledTools = evaluationCase.local.calls.map((call) => call.name)
      if (JSON.stringify(calledTools) !== JSON.stringify(evaluationCase.expectedTools)) {
        context.addIssue({
          code: "custom",
          message: "Local calls must match expectedTools in order",
          path: [index, "local", "calls"]
        })
      }
      for (const [assertionIndex, assertion] of evaluationCase.local.assertions.entries()) {
        if (assertion.call >= evaluationCase.local.calls.length) {
          context.addIssue({
            code: "custom",
            message: `Assertion references missing call ${assertion.call}`,
            path: [index, "local", "assertions", assertionIndex, "call"]
          })
        }
      }
    }
  })

export function parseEvaluationCases(value) {
  return evaluationCasesSchema.parse(value)
}

export async function loadEvaluationCases(url) {
  return parseEvaluationCases(JSON.parse(await readFile(url, "utf8")))
}

export async function runEvaluation(client, evaluationCases, options = {}) {
  const cases = parseEvaluationCases(evaluationCases)
  const now = options.now ?? (() => performance.now())
  const generatedAt = (options.wallClock ?? (() => new Date()))().toISOString()
  const listStarted = now()
  const advertisedTools = (await client.listTools()).tools.map((tool) => tool.name).toSorted()
  const toolDiscoveryLatencyMs = milliseconds(now() - listStarted)
  const missingPrimaryTools = PRIMARY_TOOL_NAMES.filter((name) => !advertisedTools.includes(name))
  const caseResults = []

  for (const evaluationCase of cases) {
    caseResults.push(await runCase(client, evaluationCase, now))
  }

  const calls = caseResults.flatMap((evaluationCase) => evaluationCase.calls)
  const durations = calls.map((call) => call.latencyMs)
  const failures = caseResults.flatMap((evaluationCase) =>
    evaluationCase.failures.map((failure) => ({ caseId: evaluationCase.id, ...failure }))
  )
  for (const name of missingPrimaryTools) {
    failures.push({ caseId: null, category: "tool_contract", reason: `Required tool ${name} was not advertised` })
  }
  const metricResults = caseResults.flatMap((evaluationCase) => evaluationCase.assertions)
  const metrics = Object.fromEntries(
    [...new Set(metricResults.map((result) => result.metric))].toSorted().map((metric) => {
      const results = metricResults.filter((result) => result.metric === metric)
      const passed = results.filter((result) => result.passed).length
      return [metric, { passed, score: passed / results.length, total: results.length }]
    })
  )
  const passedCases = caseResults.filter((evaluationCase) => evaluationCase.passed).length

  return {
    schemaVersion: 1,
    kind: "local-fixture-mcp-contract-evaluation",
    generatedAt,
    client: {
      implementation: "@modelcontextprotocol/client",
      name: options.clientName ?? "legislation-local-evaluation"
    },
    environment: {
      authentication: "disabled",
      corpus: "deterministic-fixture",
      externalCredentialsUsed: false,
      liveInfrastructureChanged: false
    },
    toolDiscovery: {
      advertisedTools,
      latencyMs: toolDiscoveryLatencyMs,
      missingPrimaryTools
    },
    summary: {
      allPrimaryToolsCalled: PRIMARY_TOOL_NAMES.every((name) => calls.some((call) => call.name === name)),
      failedCases: caseResults.length - passedCases,
      failures: failures.length,
      p50LatencyMs: percentile(durations, 0.5),
      p95LatencyMs: percentile(durations, 0.95),
      passedCases,
      toolCalls: calls.length,
      totalCases: caseResults.length
    },
    scores: {
      metrics,
      taskCompletion: caseResults.length === 0 ? 0 : passedCases / caseResults.length,
      unsupportedClaims: {
        status: "not_scored",
        reason: "The local contract evaluation does not generate or judge client-authored final answers."
      }
    },
    failures,
    cases: caseResults,
    limitations: [
      "This artifact is local fixture-backed contract evidence, not live corpus evidence.",
      "Authentication is disabled, so this artifact does not satisfy authenticated-client gates.",
      "One MCP SDK implementation is used, so this artifact does not prove two-client compatibility.",
      "Human source review and unsupported-claim scoring remain separate release gates."
    ]
  }
}

async function runCase(client, evaluationCase, now) {
  const calls = []
  const failures = []
  for (const plannedCall of evaluationCase.local.calls) {
    const started = now()
    try {
      const result = await client.callTool({ arguments: plannedCall.arguments, name: plannedCall.name })
      const response = normalizeResponse(result)
      calls.push({
        arguments: plannedCall.arguments,
        expectedError: plannedCall.expectError ?? false,
        latencyMs: milliseconds(now() - started),
        name: plannedCall.name,
        response
      })
      if (response.isError !== (plannedCall.expectError ?? false)) {
        failures.push({
          category: "tool_contract",
          reason: `${plannedCall.name} ${response.isError ? "returned an unexpected error" : "did not return the expected error"}`
        })
      }
    } catch (error) {
      calls.push({
        arguments: plannedCall.arguments,
        expectedError: plannedCall.expectError ?? false,
        latencyMs: milliseconds(now() - started),
        name: plannedCall.name,
        response: { data: null, error: null, isError: true, text: errorMessage(error), transportError: true }
      })
      failures.push({ category: classifyThrownError(error), reason: `${plannedCall.name}: ${errorMessage(error)}` })
    }
  }

  const assertions = evaluationCase.local.assertions.map((assertion) => {
    const call = calls[assertion.call]
    const value = call === undefined ? undefined : valueAt(call.response[assertion.source], assertion.path)
    const passed = evaluateAssertion(value, assertion)
    if (!passed) {
      failures.push({
        category: assertion.category,
        reason: `${assertion.metric} assertion failed for ${evaluationCase.local.calls[assertion.call]?.name ?? "missing call"} at ${assertion.source}.${assertion.path}`
      })
    }
    return {
      call: assertion.call,
      category: assertion.category,
      metric: assertion.metric,
      operator: assertion.operator,
      passed,
      path: assertion.path,
      source: assertion.source
    }
  })

  return {
    assertions,
    calls,
    citations: [...new Set(calls.flatMap((call) => collectOfficialUrls(call.response.data)))].toSorted(),
    expectedEvidence: evaluationCase.evidence,
    expectedTools: evaluationCase.expectedTools,
    failures,
    id: evaluationCase.id,
    passed: failures.length === 0,
    prompt: evaluationCase.prompt,
    scenario: evaluationCase.scenario
  }
}

function normalizeResponse(result) {
  const text = result.content
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join(" ")
  const isError = result.isError === true
  return {
    data: isError ? null : (result.structuredContent?.data ?? null),
    error: isError ? parseJson(text) : null,
    isError,
    text
  }
}

function evaluateAssertion(value, assertion) {
  if (assertion.operator === "equals") {
    return JSON.stringify(value) === JSON.stringify(assertion.expected)
  }
  if (assertion.operator === "contains") {
    return typeof value === "string" && typeof assertion.expected === "string" && value.includes(assertion.expected)
  }
  if (assertion.operator === "non_empty") {
    return (typeof value === "string" || Array.isArray(value)) && value.length > 0
  }
  if (assertion.operator === "length_equals") {
    return (typeof value === "string" || Array.isArray(value)) && value.length === assertion.expected
  }
  if (assertion.operator === "dates_ascending") {
    return areDatesAscending(value)
  }
  if (assertion.operator === "is_official_url") {
    return isOfficialUrl(value)
  }
  return isSafeError(value)
}

function areDatesAscending(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return false
  }
  const dates = value.map((item) => (isRecord(item) && typeof item.date === "string" ? item.date : undefined))
  return (
    dates.every((date) => date !== undefined) && dates.every((date, index) => index === 0 || date >= dates[index - 1])
  )
}

function isOfficialUrl(value) {
  if (typeof value !== "string") {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" && ["app.leg.wa.gov", "congress.gov", "www.congress.gov"].includes(url.hostname)
  } catch {
    return false
  }
}

function collectOfficialUrls(value) {
  if (Array.isArray(value)) {
    return value.flatMap(collectOfficialUrls)
  }
  if (!isRecord(value)) {
    return []
  }
  return Object.values(value).flatMap((item) =>
    typeof item === "string" && isOfficialUrl(item) ? [item] : collectOfficialUrls(item)
  )
}

function isSafeError(value) {
  if (!isRecord(value) || typeof value.error !== "string" || typeof value.message !== "string") {
    return false
  }
  const serialized = JSON.stringify(value).toLowerCase()
  return (
    ["invalid_request", "not_found", "unsupported"].includes(value.error) &&
    !["database", "password", "postgres", "secret", "stack", "token"].some((term) => serialized.includes(term))
  )
}

function valueAt(value, path) {
  if (path === "") {
    return value
  }
  let current = value
  for (const segment of path.split(".")) {
    if (!isRecord(current) && !Array.isArray(current)) {
      return undefined
    }
    current = current[segment]
  }
  return current
}

function parseJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return {
      error: value.startsWith("Input validation error:") ? "invalid_request" : "client",
      message: value
    }
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null
}

function classifyThrownError(error) {
  const message = errorMessage(error).toLowerCase()
  return ["401", "403", "auth", "oauth", "token"].some((term) => message.includes(term)) ? "authentication" : "client"
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return null
  }
  const sorted = values.toSorted((left, right) => left - right)
  return sorted[Math.min(Math.ceil(percentileValue * sorted.length) - 1, sorted.length - 1)]
}

function milliseconds(value) {
  return Math.round(value * 1000) / 1000
}
