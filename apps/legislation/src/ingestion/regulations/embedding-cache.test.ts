import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { z } from "zod"
import { EMBEDDING_ROUTES } from "../../models/embedding-routing.js"
import { OpenRouterEmbeddingClient } from "../../models/openrouter-embeddings.js"
import { embedCachedRegulatoryInputs } from "./embedding-cache.js"

const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "regulatory-vector-cache-"))
  directories.push(directory)
  const route = EMBEDDING_ROUTES["document-section"]
  let calls = 0
  const client = new OpenRouterEmbeddingClient({
    apiKey: "fixture",
    route,
    fetch: async (_url, init) => {
      calls++
      const request = z.object({ input: z.array(z.string()) }).parse(JSON.parse(String(init?.body)))
      return Response.json({
        model: route.model,
        usage: { total_tokens: request.input.length },
        data: request.input.map((text, index) => ({
          index,
          embedding: Array.from({ length: route.dimensions }, (_, dimension) => Number(dimension === text.length % 10))
        }))
      })
    }
  })
  return { directory, route, client, calls: () => calls }
}
describe("persistent diagnostic embedding reuse", () => {
  it("rejects a client configured for another model before persisting a vector", async () => {
    const setup = await fixture()
    await expect(
      embedCachedRegulatoryInputs({
        ...setup,
        route: { ...setup.route, model: "voyageai/voyage-4" },
        texts: ["a"],
        inputType: "document"
      })
    ).rejects.toThrow("model_mismatch")
    expect(await readdir(setup.directory)).toEqual([])
  })
  it("deduplicates inputs, preserves order, and isolates query mode and input contract", async () => {
    const setup = await fixture()
    const input = { ...setup, texts: ["a", "bb", "a"], inputType: "document" as const }
    const first = await embedCachedRegulatoryInputs(input)
    expect(first.deduplicatedInputs).toBe(1)
    expect(first.totalTokens).toBe(2)
    expect(first.embeddings[0]).toEqual(first.embeddings[2])
    const replay = await embedCachedRegulatoryInputs({ ...input, texts: ["bb", "a"] })
    expect(replay).toMatchObject({ cacheHits: 2, totalTokens: 0 })
    expect(replay.embeddings).toEqual([first.embeddings[1], first.embeddings[0]])
    expect(setup.calls()).toBe(1)
    await embedCachedRegulatoryInputs({ ...input, inputType: "query" })
    await embedCachedRegulatoryInputs({
      ...input,
      route: { ...setup.route, embeddingInputContract: "different-input-contract" }
    })
    expect(setup.calls()).toBe(3)
  })
  it.each(["key", "vector", "numeric-value"])("rejects corrupt cached %s without paid fallback", async (field) => {
    const setup = await fixture()
    const input = { ...setup, texts: ["a"], inputType: "document" as const }
    await embedCachedRegulatoryInputs(input)
    const name = (await readdir(setup.directory))[0]
    expect(name).toBeDefined()
    const path = join(setup.directory, z.string().parse(name))
    const entry = JSON.parse(await readFile(path, "utf8"))
    if (field === "numeric-value") {
      entry.vector[0] = 0.125
    } else {
      entry[field] = field === "key" ? "0".repeat(64) : []
    }
    await writeFile(path, JSON.stringify(entry))
    await expect(embedCachedRegulatoryInputs(input)).rejects.toThrow(
      field === "key" ? "key_mismatch" : "checksum_mismatch"
    )
    expect(setup.calls()).toBe(1)
  })
})
