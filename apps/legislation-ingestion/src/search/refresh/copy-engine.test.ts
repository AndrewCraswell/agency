import { type ChildProcessWithoutNullStreams } from "node:child_process"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { describe, expect, it, vi } from "vitest"
import { createBulkCopyEngine } from "./copy-engine.js"

function processFixture(code = 0, output = "") {
  const child = new EventEmitter() as ChildProcessWithoutNullStreams
  const stdout = new PassThrough()
  Object.assign(child, {
    stdin: new PassThrough(),
    stdout,
    stderr: new PassThrough(),
    kill: vi.fn()
  })
  queueMicrotask(() => {
    stdout.end(output)
    child.emit("close", code)
  })
  return child
}

const request = {
  sourceEndpoint: "postgresql://source.invalid/production?sslmode=require",
  targetEndpoint: "postgresql://target.invalid/staging?sslmode=require",
  snapshot: "00000001-00000002-1",
  tables: ["bills", "bill_documents"]
} as const

describe("refresh bulk copy", () => {
  it("loads each table with transactional index and trigger restoration and reports row counts", async () => {
    const calls: { arguments_: readonly string[]; environment: NodeJS.ProcessEnv }[] = []
    const logger = vi.fn()
    const engine = createBulkCopyEngine((_command, arguments_, environment) => {
      calls.push({ arguments_, environment })
      return processFixture(0, environment.PGAPPNAME?.endsWith("-target") ? "BEGIN\nCOPY 42\nCOMMIT\n" : "")
    }, logger)
    await expect(engine.copy(request)).resolves.toEqual({
      engine: "bulk",
      tables: request.tables,
      counts: { bills: "42", bill_documents: "42" }
    })
    expect(calls).toHaveLength(4)
    const target = calls[1]?.arguments_.join("\n") ?? ""
    expect(target).toContain("begin")
    expect(target).toContain('lock table legislation."bills" in access exclusive mode')
    expect(target).toContain("not index_record.indisunique")
    expect(target).toContain("not exists(select 1 from pg_constraint")
    expect(target.indexOf("drop index")).toBeLessThan(target.indexOf("from stdin"))
    expect(target.indexOf("execute item.definition")).toBeGreaterThan(target.indexOf("from stdin"))
    expect(target).toContain("enable replica")
    expect(target).toContain("enable always")
    expect(target).toContain("commit")
    expect(calls[0]?.arguments_.join(" ")).toContain("set transaction snapshot")
    expect(calls[0]?.environment.PGOPTIONS).toBe("-c statement_timeout=3600000 -c lock_timeout=2000")
    expect(logger).toHaveBeenCalledWith("refresh.copy.start", { table: "bills", ordinal: 1, total: 2 })
    expect(logger).toHaveBeenCalledWith("refresh.copy.indexes", expect.objectContaining({ table: "bills", rows: "42" }))
    expect(logger).toHaveBeenCalledWith(
      "refresh.copy.complete",
      expect.objectContaining({ table: "bills", rows: "42" })
    )
  })

  it("kills both subprocesses and stops instead of replaying the database after failure", async () => {
    const children: ChildProcessWithoutNullStreams[] = []
    const engine = createBulkCopyEngine(() => {
      const child = processFixture(children.length === 0 ? 1 : 0)
      children.push(child)
      return child
    }, vi.fn())
    await expect(engine.copy(request)).rejects.toThrow("Bulk copy of legislation.bills failed")
    expect(children).toHaveLength(2)
    expect(children.every((child) => vi.mocked(child.kill).mock.calls.length > 0)).toBe(true)
  })

  it("does not accept a success-shaped process without a COPY count", async () => {
    const engine = createBulkCopyEngine(() => processFixture(), vi.fn())
    await expect(engine.copy(request)).rejects.toThrow("Missing COPY row count")
  })

  it("rejects duplicate tables, unsafe identifiers and the same database with different credentials", async () => {
    const engine = createBulkCopyEngine()
    await expect(engine.copy({ ...request, tables: ["bills", "bills"] })).rejects.toThrow("Invalid")
    await expect(engine.copy({ ...request, tables: ["bills; drop schema"] })).rejects.toThrow("Invalid")
    await expect(
      engine.copy({
        ...request,
        targetEndpoint: "postgresql://different-user@source.invalid:5432/production"
      })
    ).rejects.toThrow("distinct")
  })
})
