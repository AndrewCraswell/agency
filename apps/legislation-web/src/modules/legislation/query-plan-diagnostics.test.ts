import { expect, it, vi } from "vitest"
import {
  parseQueryPlanDiagnosticInput,
  runQueryPlanDiagnostic,
  type QueryPlanDiagnosticClient
} from "./query-plan-diagnostics"

it("rejects unknown query names, fixtures, and unsafe timeouts", () => {
  expect(
    parseQueryPlanDiagnosticInput({
      query: "bill.search.lexical",
      fixture: "school-vouchers-federal",
      timeoutMs: 20000
    })
  ).toMatchObject({ fixture: "school-vouchers-federal" })
  expect(
    parseQueryPlanDiagnosticInput({
      query: "bill.search.lexical",
      fixture: "career-technical-california",
      timeoutMs: 20000
    })
  ).toMatchObject({ query: "bill.search.lexical" })
  expect(() =>
    parseQueryPlanDiagnosticInput({ query: "bill.search.lexical", fixture: "student-data", timeoutMs: 20000 })
  ).toThrow("Fixture does not belong")
  expect(() =>
    parseQueryPlanDiagnosticInput({
      fixture: "student-data",
      query: "arbitrary.sql",
      timeoutMs: 10_000
    })
  ).toThrow(/Invalid/u)
  expect(() =>
    parseQueryPlanDiagnosticInput({
      fixture: "customer-input",
      query: "supporting_material.search.lexical",
      timeoutMs: 10_000
    })
  ).toThrow(/Invalid/u)
  expect(() =>
    parseQueryPlanDiagnosticInput({
      fixture: "student-data",
      query: "supporting_material.search.lexical",
      timeoutMs: 60_000
    })
  ).toThrow(/Too big/u)
})

it("runs only the registered query in a read-only transaction and returns a sanitized report", async () => {
  const query = vi.fn<QueryPlanDiagnosticClient["query"]>(async (text) => {
    if (text.startsWith("explain")) {
      return {
        rows: [
          {
            "QUERY PLAN": [
              {
                "Execution Time": 5123.4,
                Plan: {
                  "Actual Loops": 1,
                  "Actual Rows": 0,
                  "Actual Total Time": 5120,
                  "Node Type": "Limit",
                  Plans: [
                    {
                      "Actual Loops": 1,
                      "Actual Rows": 1001,
                      "Actual Total Time": 5100,
                      "Node Type": "Bitmap Heap Scan",
                      "Relation Name": "supporting_material_sections",
                      "Rows Removed by Filter": 24,
                      "Shared Hit Blocks": 2500,
                      "Shared Read Blocks": 500,
                      "Temp Written Blocks": 42
                    }
                  ]
                },
                "Planning Time": 12.5,
                Settings: {
                  search_path: "private",
                  statement_timeout: "20000",
                  work_mem: "4MB"
                }
              }
            ]
          }
        ]
      }
    }
    if (text.trimStart().startsWith("with")) {
      return { rows: [{ id: "material:fixture", snippet: "private fixture output" }] }
    }
    return { rows: [] }
  })

  const report = await runQueryPlanDiagnostic(
    { query },
    {
      fixture: "student-data",
      query: "supporting_material.search.lexical",
      timeoutMs: 20_000
    }
  )

  expect(query.mock.calls.map(([text]) => text)).toEqual([
    "begin read only",
    "select set_config('statement_timeout', $1, true), set_config('lock_timeout', $2, true)",
    expect.stringMatching(/^explain \(analyze, buffers, wal, settings, format json\)/u),
    expect.stringMatching(/^\s*with/u),
    "rollback"
  ])
  expect(report).toMatchObject({
    query: {
      database: "canonical",
      fixture: "student-data",
      name: "supporting_material.search.lexical",
      observedQueryIds: ["1328274108816803535"],
      revision: 1
    },
    safeguards: {
      analyzeEnabled: true,
      parametersIncluded: false,
      queryTextIncluded: false,
      transactionReadOnly: true
    },
    result: {
      orderedDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      rowCount: 1
    },
    plan: {
      executionTimeMs: 5123.4,
      nodes: [
        { depth: 0, nodeType: "Limit", path: "0" },
        {
          depth: 1,
          nodeType: "Bitmap Heap Scan",
          parentPath: "0",
          path: "0.0",
          relationName: "supporting_material_sections",
          sharedBlocksRead: 500,
          temporaryBlocksWritten: 42
        }
      ],
      planningTimeMs: 12.5,
      settings: { statement_timeout: "20000", work_mem: "4MB" }
    }
  })
  const serialized = JSON.stringify(report)
  expect(serialized).not.toContain("private fixture output")
  expect(serialized).not.toContain("student data education technology vendor privacy")
  expect(serialized).not.toContain("search_path")
})

it("rolls back when the registered query times out", async () => {
  const timeout = Object.assign(new Error("statement timeout"), { code: "57014" })
  const query = vi.fn<QueryPlanDiagnosticClient["query"]>(async (text) => {
    if (text.startsWith("explain")) {
      throw timeout
    }
    return { rows: [] }
  })

  await expect(
    runQueryPlanDiagnostic(
      { query },
      {
        fixture: "student-data",
        query: "supporting_material.search.lexical",
        timeoutMs: 1_000
      }
    )
  ).rejects.toBe(timeout)
  expect(query.mock.calls.some(([text]) => text.trimStart().startsWith("with"))).toBe(false)
  expect(query.mock.calls.at(-1)?.[0]).toBe("rollback")
})
