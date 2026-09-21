import { type ChildProcessWithoutNullStreams } from "node:child_process"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { describe, expect, it, vi } from "vitest"
import {
  createDirectCopyEngine,
  createFallbackCopyEngine,
  createPgDumpCopyEngine,
  type CopyEngine
} from "./copy-engine.js"

function processFixture(code = 0) {
  const child = new EventEmitter() as ChildProcessWithoutNullStreams
  Object.assign(child, { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() })
  queueMicrotask(() => child.emit("close", code))
  return child
}

const request = {
  sourceEndpoint: "postgresql://refresh:source-secret@source.invalid/production?sslmode=require",
  targetEndpoint: "postgresql://refresh:target-secret@target.invalid/staging?sslmode=require",
  snapshot: "00000001-00000002-1",
  tables: ["bills", "bill_documents"]
} as const

describe("refresh copy engines", () => {
  it("streams deterministic binary table copies without a dump file", async () => {
    const calls: { command: string; arguments_: readonly string[]; environment: NodeJS.ProcessEnv }[] = []
    const engine = createDirectCopyEngine((command, arguments_, environment) => {
      calls.push({ command, arguments_, environment })
      return processFixture()
    })
    await expect(engine.copy(request)).resolves.toEqual({ engine: "direct", tables: request.tables })
    expect(calls).toHaveLength(4)
    expect(calls.map((call) => call.command)).toEqual(["psql", "psql", "psql", "psql"])
    expect(calls[0]?.arguments_.join(" ")).toContain("set transaction snapshot")
    expect(calls[0]?.arguments_.join(" ")).toContain("copy legislation.bills to stdout with (format binary)")
    expect(calls.flatMap((call) => call.arguments_)).not.toContain("--file")
    expect(calls.flatMap((call) => call.arguments_).join(" ")).not.toContain("secret")
    expect(calls[0]?.environment.PGPASSWORD).toBe("source-secret")
    expect(calls[1]?.environment.PGPASSWORD).toBe("target-secret")
  })

  it("keeps the streaming pg_dump and pg_restore fallback tested", async () => {
    const calls: { command: string; arguments_: readonly string[] }[] = []
    const engine = createPgDumpCopyEngine((command, arguments_) => {
      calls.push({ command, arguments_ })
      return processFixture()
    })
    await expect(engine.copy(request)).resolves.toMatchObject({ engine: "pg-dump" })
    expect(calls.map((call) => call.command)).toEqual(["pg_dump", "pg_restore"])
    expect(calls[0]?.arguments_).toContain("--format=custom")
    expect(calls[1]?.arguments_).toContain("--disable-triggers")
    expect(calls[1]?.arguments_).toContain("staging")
  })

  it("uses fallback only after an explicit primary failure", async () => {
    const primary: CopyEngine = { copy: async () => Promise.reject(new Error("unsupported copy")) }
    const fallback: CopyEngine = {
      copy: async (copyRequest) => ({ engine: "pg-dump", tables: copyRequest.tables })
    }
    const reset = vi.fn(async () => undefined)
    await expect(createFallbackCopyEngine(primary, fallback, reset).copy(request)).resolves.toMatchObject({
      engine: "pg-dump"
    })
    expect(reset).toHaveBeenCalledOnce()
  })

  it("rejects same endpoints and unsafe table identifiers", async () => {
    const engine = createDirectCopyEngine()
    await expect(engine.copy({ ...request, targetEndpoint: request.sourceEndpoint })).rejects.toThrow("distinct")
    await expect(engine.copy({ ...request, tables: ["bills; drop schema"] })).rejects.toThrow("Invalid")
  })
})
