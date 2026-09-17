import type { ExperimentParams } from "@langfuse/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { digest } from "./contracts"
import { createEvalLangfuse } from "./langfuse"
import { smokeDataset } from "./smoke"

const { getDataset, runExperiment } = vi.hoisted(() => ({
  getDataset:
    vi.fn<
      (
        name: string,
        options: { version: string }
      ) => Promise<{ items: { id: string; input: unknown; expectedOutput: unknown; metadata: unknown }[] }>
    >(),
  runExperiment:
    vi.fn<(options: ExperimentParams) => Promise<{ itemResults: { datasetRunId?: string; traceId?: string }[] }>>()
}))

vi.mock("@langfuse/client", () => ({
  LangfuseClient: class {
    dataset = { get: getDataset }
    experiment = { run: runExperiment }
  }
}))

vi.mock("@langfuse/tracing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@langfuse/tracing")>()),
  getActiveSpanId: () => "publication-observation"
}))

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

describe("frozen experiment publication", () => {
  const environment = {
    LANGFUSE_PUBLIC_KEY: "public",
    LANGFUSE_SECRET_KEY: "secret",
    LANGFUSE_BASE_URL: "https://example.test"
  }
  const item = { id: "item-one", input: { question: "Hello" }, expectedOutput: "Hello", metadata: {} }
  const upload = {
    runName: "frozen-run",
    datasetName: "frozen-dataset",
    datasetItemId: item.id,
    datasetVersion: "2026-09-17T00:00:00.000Z",
    traceId: "source-trace",
    observationId: "source-observation",
    output: { answer: "Saved answer" },
    metadata: { releaseApproved: false },
    scores: [
      { name: "correctness", value: 1, detail: "Saved score" },
      { name: "ungradable", value: null, detail: "Not scored" }
    ]
  }

  beforeEach(() => {
    getDataset.mockReset().mockResolvedValue({ items: [item] })
    runExperiment.mockReset().mockImplementation(async (options) => {
      await options.task(item)
      return { itemResults: [{ datasetRunId: "experiment", traceId: "publication-trace" }] }
    })
  })

  it("publishes frozen output using a versioned SDK experiment and synchronous score writes", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "score" }))
    vi.stubGlobal("fetch", fetcher)
    await createEvalLangfuse(environment).publishResult(upload)
    const experiment = runExperiment.mock.calls[0]?.[0]
    expect(await experiment?.task(item)).toEqual(upload.output)
    expect(getDataset).toHaveBeenCalledWith(upload.datasetName, { version: upload.datasetVersion })
    expect(runExperiment).toHaveBeenCalledWith(
      expect.objectContaining({
        name: upload.runName,
        runName: upload.runName,
        datasetVersion: upload.datasetVersion,
        data: [item],
        metadata: expect.objectContaining({
          sourceTraceId: upload.traceId,
          sourceObservationId: upload.observationId,
          publicationOnly: true
        })
      })
    )
    expect(fetcher).toHaveBeenCalledOnce()
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("https://example.test/api/public/scores")
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      id: digest({ traceId: upload.traceId, name: "correctness" }),
      traceId: "publication-trace",
      observationId: "publication-observation",
      name: "correctness",
      value: 1
    })
  })

  it("rejects missing frozen items before starting an experiment", async () => {
    getDataset.mockResolvedValue({ items: [] })
    await expect(createEvalLangfuse(environment).publishResult(upload)).rejects.toThrow("Frozen dataset item")
    expect(runExperiment).not.toHaveBeenCalled()
  })

  it.each([{ itemResults: [] }, { itemResults: [{ traceId: "unlinked-trace" }] }])(
    "surfaces SDK-skipped items or failed dataset links",
    async ({ itemResults }) => {
      runExperiment.mockResolvedValue({ itemResults })
      await expect(createEvalLangfuse(environment).publishResult(upload)).rejects.toThrow("retry the saved upload")
    }
  )

  it("surfaces score rejection so the saved upload remains retryable", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })))
    await expect(createEvalLangfuse(environment).publishResult(upload)).rejects.toThrow("HTTP 503")
  })
})
