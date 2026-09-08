import { access, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { createCliClient, type CommandRunner } from "./client.ts"

afterEach(() => vi.unstubAllEnvs())

describe("authenticated CLI transport", () => {
  it("passes data through files, strips inherited CLI flags and removes temporary files", async () => {
    vi.stubEnv("SHOPIFY_FLAG_ALLOW_MUTATIONS", "1")
    let outputPath = ""
    const execute = vi.fn<CommandRunner>(async (_file, args) => {
      outputPath = z.string().parse(args[args.indexOf("--output-file") + 1])
      const variablesPath = z.string().parse(args[args.indexOf("--variable-file") + 1])
      const queryPath = z.string().parse(args[args.indexOf("--query-file") + 1])
      expect(JSON.parse(await readFile(variablesPath, "utf8"))).toEqual({ text: 'quotes " and $(shell)' })
      expect(await readFile(queryPath, "utf8")).toBe("query Example { shop { name } }")
      await writeFile(outputPath, JSON.stringify({ data: { shop: { name: "Test" } } }))
    })
    const client = createCliClient("test.myshopify.com", false, execute)
    expect(await client("query Example { shop { name } }", { text: 'quotes " and $(shell)' })).toEqual({
      shop: { name: "Test" }
    })
    expect(execute.mock.calls[0]?.[1]).not.toContain("--allow-mutations")
    expect(execute.mock.calls[0]?.[2].env).not.toHaveProperty("SHOPIFY_FLAG_ALLOW_MUTATIONS")
    expect(execute.mock.calls[0]?.[1]).toContain("test.myshopify.com")
    await expect(access(dirname(outputPath))).rejects.toThrow("ENOENT")
  })

  it("adds mutation permission only for an explicitly writable client and operation", async () => {
    const execute = vi.fn<CommandRunner>(async (_file, args) => {
      const output = z.string().parse(args[args.indexOf("--output-file") + 1])
      await writeFile(output, JSON.stringify({ result: "ok" }))
    })
    const client = createCliClient("test.myshopify.com", true, execute)
    expect(await client("mutation Write { example }", {}, true)).toEqual({ result: "ok" })
    expect(execute.mock.calls[0]?.[1]).toContain("--allow-mutations")
    await expect(client("mutation Write { example }")).rejects.toThrow("read/write mode")
    await expect(client("query Read { example }", {}, true)).rejects.toThrow("read/write mode")
    await expect(client("{ example }")).rejects.toThrow("read/write mode")
  })

  it("reports failures without retrying a potentially completed mutation", async () => {
    let outputPath = ""
    const execute = vi.fn<CommandRunner>(async (_file, args) => {
      outputPath = z.string().parse(args[args.indexOf("--output-file") + 1])
      throw new Error("Timed out after submission")
    })
    await expect(
      createCliClient("test.myshopify.com", true, execute)("mutation Write { example }", {}, true)
    ).rejects.toThrow("plan again")
    expect(execute).toHaveBeenCalledOnce()
    await expect(access(dirname(outputPath))).rejects.toThrow("ENOENT")
  })
})
