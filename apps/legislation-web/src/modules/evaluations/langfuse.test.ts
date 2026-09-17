import { afterEach, describe, expect, it, vi } from "vitest"
import { digest } from "./contracts"
import { createEvalLangfuse } from "./langfuse"
import { smokeDataset } from "./smoke"

afterEach(() => vi.unstubAllGlobals())

describe("hosted evaluation datasets", () => {
  const environment = {
    LANGFUSE_PUBLIC_KEY: "public",
    LANGFUSE_SECRET_KEY: "secret",
    LANGFUSE_BASE_URL: "https://example.test"
  }
  const item = smokeDataset.cases[0]
  if (!item) {
    throw new Error("Missing smoke case")
  }
  const stored = {
    id: "item-1",
    input: { messages: item.messages, followUps: item.followUps },
    expectedOutput: { reference: item.reference, expected: item.expected },
    metadata: {
      caseId: item.id,
      family: item.family,
      tags: item.tags,
      review: item.review,
      provenance: item.provenance,
      fixturesJson: JSON.stringify(item.fixtures),
      caseHash: digest(item)
    }
  }

  it("loads the exact hosted contract and pins a dataset version", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [stored], meta: { totalPages: 1 } }))
    vi.stubGlobal("fetch", fetcher)
    const result = await createEvalLangfuse(environment).loadDataset(smokeDataset.name)
    expect(result.dataset.cases).toEqual([item])
    expect(result.synced.ids).toEqual({ [item.id]: "item-1" })
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("version=")
  })

  it("rejects modified evidence rather than trusting stale hashes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          data: [{ ...stored, expectedOutput: { ...stored.expectedOutput, reference: "Changed" } }],
          meta: { totalPages: 1 }
        })
      )
    )
    await expect(createEvalLangfuse(environment).loadDataset(smokeDataset.name)).rejects.toThrow("hash mismatch")
  })

  it("uploads replay fixtures and turn criteria with the case", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json({ data: [], meta: { totalPages: 0 } }))
      .mockResolvedValueOnce(Response.json({}))
    vi.stubGlobal("fetch", fetcher)
    await createEvalLangfuse(environment).syncDataset(smokeDataset.name, [
      { ...item, turnCriteria: [{ turn: 0, criteria: ["Greet briefly"] }] }
    ])
    const body = JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))
    expect(JSON.parse(body.metadata.fixturesJson)).toEqual(item.fixtures)
    expect(body.expectedOutput.turnCriteria).toEqual([{ turn: 0, criteria: ["Greet briefly"] }])
  })
  it("preserves numeric precision and source whitespace in serialized fixtures", async () => {
    const fixtures = [
      { method: "searchVotes", input: {}, output: { score: Number("0.12345678901234567"), text: "source\n" } }
    ]
    const preciseItem = { ...item, fixtures }
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          data: [
            {
              ...stored,
              metadata: { ...stored.metadata, fixturesJson: JSON.stringify(fixtures), caseHash: digest(preciseItem) }
            }
          ],
          meta: { totalPages: 1 }
        })
      )
    )
    const result = await createEvalLangfuse(environment).loadDataset(smokeDataset.name)
    expect(result.dataset.cases[0]?.fixtures).toEqual(fixtures)
  })
})
