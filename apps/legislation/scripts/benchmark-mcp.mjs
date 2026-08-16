import { performance } from "node:perf_hooks"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"

const url = process.env.LEGISLATION_BENCHMARK_URL
if (url === undefined) {
  throw new Error("LEGISLATION_BENCHMARK_URL is required")
}
const iterations = Number(process.env.LEGISLATION_BENCHMARK_ITERATIONS ?? "30")
const concurrency = Number(process.env.LEGISLATION_BENCHMARK_CONCURRENCY ?? "5")
const p95TargetMs = Number(process.env.LEGISLATION_BENCHMARK_P95_TARGET_MS ?? "2000")
if (!Number.isSafeInteger(iterations) || iterations < 1 || !Number.isSafeInteger(concurrency) || concurrency < 1) {
  throw new Error("Benchmark iterations and concurrency must be positive integers")
}
const token = process.env.LEGISLATION_BENCHMARK_TOKEN
const transport = new StreamableHTTPClientTransport(new URL(url), {
  authProvider: token === undefined ? undefined : { token: async () => token }
})
const client = new Client({ name: "legislation-benchmark", version: "1.0.0" })
await client.connect(transport)
const calls = [
  { arguments: { limit: 5, mode: "lexical", query: "government information" }, name: "search_bills" },
  { arguments: { limit: 100, mode: "lexical", query: "effective date" }, name: "search_bill_text" },
  { arguments: { limit: 100, mode: "lexical", query: "the" }, name: "search_bills" }
]
const durations = []
try {
  for (let offset = 0; offset < iterations; offset += concurrency) {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, iterations - offset) }, async (_unused, batchIndex) => {
        const call = calls[(offset + batchIndex) % calls.length]
        const started = performance.now()
        const result = await client.callTool(call)
        durations.push({ durationMs: performance.now() - started, name: call.name })
        if (result.isError === true) {
          throw new Error(`Benchmark tool call ${call.name} failed`)
        }
      })
    )
  }
} finally {
  await transport.close()
}
const percentile = (values, percentileValue) => {
  const sorted = values.toSorted((left, right) => left - right)
  return sorted[Math.min(Math.ceil(percentileValue * sorted.length) - 1, sorted.length - 1)]
}
const allDurations = durations.map((item) => item.durationMs)
const result = {
  byTool: Object.fromEntries(
    [...new Set(durations.map((item) => item.name))].map((name) => {
      const values = durations.filter((item) => item.name === name).map((item) => item.durationMs)
      return [name, { calls: values.length, p95Ms: percentile(values, 0.95) }]
    })
  ),
  concurrency,
  iterations,
  p50Ms: percentile(allDurations, 0.5),
  p95Ms: percentile(allDurations, 0.95),
  p95TargetMs,
  p99Ms: percentile(allDurations, 0.99)
}
process.stdout.write(`${JSON.stringify(result)}\n`)
if ((result.p95Ms ?? Number.POSITIVE_INFINITY) > p95TargetMs) {
  throw new Error(`Benchmark p95 exceeded ${p95TargetMs} ms`)
}
