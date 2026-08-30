import { spawn } from "node:child_process"
import { EventEmitter } from "node:events"
import { access, rm } from "node:fs/promises"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetValues, startPreview } from "./preview.ts"

vi.mock("node:child_process", () => ({ spawn: vi.fn<(...args: never[]) => void>() }))
vi.mock("node:fs/promises", () => ({
  access: vi.fn<(...args: never[]) => void>(),
  rm: vi.fn<(...args: never[]) => void>()
}))

const spawned = vi.mocked(spawn)
const accessed = vi.mocked(access)
const removed = vi.mocked(rm)
let written = ""

const childThat = (event: "close" | "error", value: number | null | Error) => {
  const child = new EventEmitter()
  spawned.mockImplementation(() => {
    queueMicrotask(() => child.emit(event, value))
    return child as never
  })
  return child
}

beforeEach(() => {
  vi.resetAllMocks()
  written = ""
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    written += String(chunk)
    return true
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("startPreview", () => {
  it("passes an existing values file to a dev server that exits normally", async () => {
    accessed.mockResolvedValue()
    childThat("close", 0)

    await startPreview({ dir: "src/emails", values: ".fixtures/order.json" })

    expect(written).toContain("Previewing against")
    const invocation = spawned.mock.calls[0]!
    const options = (typeof invocation[1] === "object" ? invocation[1] : invocation[2]) as {
      env: NodeJS.ProcessEnv
    }
    expect(options.env.SHOPIFY_EMAILS_VALUES).toMatch(/\.fixtures[\\/]order\.json$/)
  })

  it("starts from samples when the values file is absent and accepts a signal close", async () => {
    accessed.mockRejectedValue(new Error("ENOENT"))
    childThat("close", null)

    await startPreview({ dir: "templates", values: "missing.json" })

    expect(written).toContain("the samples answer")
    const invocation = spawned.mock.calls[0]!
    const options = (typeof invocation[1] === "object" ? invocation[1] : invocation[2]) as {
      env: NodeJS.ProcessEnv
    }
    expect(options.env).toBe(process.env)
  })

  it("turns a spawn error into installation guidance", async () => {
    accessed.mockResolvedValue()
    childThat("error", new Error("ENOENT"))

    await expect(startPreview({ dir: "src", values: "order.json" })).rejects.toThrow(
      /dev server is not on PATH.*pnpm dev/s
    )
  })

  it("reports a nonzero dev-server exit", async () => {
    accessed.mockResolvedValue()
    childThat("close", 2)

    await expect(startPreview({ dir: "src", values: "order.json" })).rejects.toThrow("The dev server exited with 2")
  })
})

describe("resetValues", () => {
  it("removes a pulled fixture when one exists", async () => {
    accessed.mockResolvedValue()
    removed.mockResolvedValue()

    await resetValues(".fixtures/order.json")

    expect(removed).toHaveBeenCalledOnce()
    expect(written).toContain("The samples answer again")
  })

  it("leaves the filesystem alone when samples already answer", async () => {
    accessed.mockRejectedValue(new Error("ENOENT"))

    await resetValues(".fixtures/order.json")

    expect(removed).not.toHaveBeenCalled()
    expect(written).toContain("No .fixtures")
  })
})
