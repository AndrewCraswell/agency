import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/* The lookup happens once per process, so each case needs the module fresh. */
const load = async () => {
  vi.resetModules()
  const { previewValues } = await import("./previewValues.ts")
  return previewValues
}

const sample = { customer: { first_name: "Alex" }, name: "#1001", shop: { name: "Example Store" } }

describe("previewValues", () => {
  let folder = ""

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "preview-values-"))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const pull = async (contents: string) => {
    const file = join(folder, "order.json")
    await writeFile(file, contents, "utf8")
    vi.stubEnv("SHOPIFY_EMAILS_VALUES", file)
  }

  it("leaves the sample alone when no order has been named", async () => {
    expect(await (await load())(sample)).toBe(sample)
  })

  it("lays the pulled order over the sample, so an untouched name keeps its fixture", async () => {
    await pull(JSON.stringify({ name: "#9001", shop: { name: "Fencing Club" } }))
    expect(await (await load())(sample)).toEqual({
      customer: { first_name: "Alex" },
      name: "#9001",
      shop: { name: "Fencing Club" }
    })
  })

  it("reads the file once however many templates ask", async () => {
    await pull(JSON.stringify({ name: "#9001" }))
    const values = await load()
    expect(values(sample)).toEqual(values(sample))
  })

  it("refuses a file that holds something other than variables", async () => {
    await pull("[]")
    await expect(load().then((values) => values(sample))).rejects.toThrow("not an object of variables")
  })

  it("says so rather than quietly falling back when the named file is not there", async () => {
    vi.stubEnv("SHOPIFY_EMAILS_VALUES", join(folder, "never-written.json"))
    await expect(load().then((values) => values(sample))).rejects.toThrow("ENOENT")
  })
})
