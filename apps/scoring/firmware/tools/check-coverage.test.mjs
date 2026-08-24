import assert from "node:assert/strict"
import { normalize, resolve } from "node:path"
import test from "node:test"
import {
  COVERAGE_POLICY,
  CORE_SOURCES,
  evaluateCoverage,
  metricPercent,
  summarizeCoverageExport
} from "./check-coverage.mjs"

test("coverage policy keeps the scoring core at 100 percent", () => {
  assert.deepEqual(CORE_SOURCES, ["stm32/core/stm32_scoring_core.c"])
  assert.deepEqual(COVERAGE_POLICY.core, { branches: 100, functions: 100, lines: 100 })
  assert.deepEqual(COVERAGE_POLICY.other, { branches: 80, functions: 80, lines: 80 })
})

test("coverage parser rejects incomplete metrics", () => {
  assert.equal(metricPercent({ count: 0, covered: 0 }), 100)
  assert.throws(() => metricPercent({ count: 1 }), /missing/)
  assert.throws(() => summarizeCoverageExport({ data: [{ files: [{}] }] }), /malformed/)
})

test("coverage evaluation fails closed for missing and below-threshold sources", () => {
  const core = new URL("../stm32/core/stm32_scoring_core.c", import.meta.url).pathname
  const other = new URL("../stm32/core/stm32_transport.c", import.meta.url).pathname
  const measurements = new Map([[normalize(resolve(other)), { branches: 80, functions: 80, lines: 80 }]])
  const failures = evaluateCoverage([core, other], measurements)
  assert.equal(failures.length, 1)
  assert.match(failures[0], /missing coverage mapping/)
})
