import type { Client } from "@modelcontextprotocol/client"
import { researchResultFragmentSchema } from "@repo/legislation-core/research/result-pages"
import { expect } from "vitest"
import { z } from "zod"

export async function readFragmentedResult(
  client: Client,
  name: string,
  input: Record<string, unknown>
): Promise<z.infer<ReturnType<typeof z.json>>> {
  let cursor: string | undefined
  let text = ""
  let count = 0
  do {
    const result = await client.callTool({ name, arguments: { ...input, ...(cursor ? { cursor } : {}) } })
    expect(result.isError, `Fragment ${count}: ${JSON.stringify(result.content)}`).not.toBe(true)
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(900_000)
    const { data: page } = z.object({ data: researchResultFragmentSchema }).parse(result.structuredContent)
    expect(page.partialResult.textOffset).toBe(text.length)
    text += page.partialResult.text
    count += 1
    cursor = page.nextCursor ?? undefined
    expect(count).toBeLessThan(200)
  } while (cursor)
  expect(count).toBeGreaterThan(1)
  return z.json().parse(JSON.parse(text))
}
