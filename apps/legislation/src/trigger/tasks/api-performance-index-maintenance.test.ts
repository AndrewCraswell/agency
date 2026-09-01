import { getTableConfig, IndexedColumn } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import { billDocuments, bills } from "../../db/schema/schema.js"
import { apiPerformanceIndexMaintenanceStatements } from "./api-performance-index-maintenance.js"

describe("API performance index maintenance", () => {
  it("creates only the two ordered browse indexes", () => {
    expect(apiPerformanceIndexMaintenanceStatements([])).toEqual([
      "create index concurrently if not exists bills_global_introduced_idx on legislation.bills (introduced_at desc nulls first, id asc)",
      "create index concurrently if not exists bill_documents_amendment_date_idx on legislation.bill_documents (classification asc, (document_date is null) asc, document_date desc nulls first, id asc)"
    ])
  })

  it("drops only a known invalid index before recreating it", () => {
    const statements = apiPerformanceIndexMaintenanceStatements([
      "bill_documents_amendment_date_idx",
      "unrelated_index"
    ])

    expect(statements).toContain("drop index concurrently if exists legislation.bill_documents_amendment_date_idx")
    expect(statements).not.toContain("drop index concurrently if exists legislation.bills_global_introduced_idx")
    expect(statements.join("\n")).not.toContain("unrelated_index")
  })

  it("keeps both ordered indexes in the canonical schema", () => {
    const billIndex = getTableConfig(bills).indexes.find(({ config }) => config.name === "bills_global_introduced_idx")
    const amendmentIndex = getTableConfig(billDocuments).indexes.find(
      ({ config }) => config.name === "bill_documents_amendment_date_idx"
    )

    expect(
      billIndex?.config.columns.map((column) =>
        column instanceof IndexedColumn ? column.indexConfig.order : undefined
      )
    ).toEqual(["desc", "asc"])
    expect(
      billIndex?.config.columns.map((column) =>
        column instanceof IndexedColumn ? column.indexConfig.nulls : undefined
      )
    ).toEqual(["first", "last"])
    expect(
      amendmentIndex?.config.columns.map((column) =>
        column instanceof IndexedColumn ? column.indexConfig.order : undefined
      )
    ).toEqual(["asc", undefined, "desc", "asc"])
  })
})
