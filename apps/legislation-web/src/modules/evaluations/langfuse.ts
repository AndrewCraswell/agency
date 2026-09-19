import { LangfuseClient } from "@langfuse/client"
import { getActiveSpanId, propagateAttributes, startActiveObservation } from "@langfuse/tracing"
import { z } from "zod"
import { createLangfuseClient, langfuseSettings, type LangfuseEnvironment } from "../../services/langfuse/client"
import { startNodeTelemetry } from "../../services/sentry/nodeTelemetry"
import { redactCredentials } from "../conversations/redactCredentials"
import { assertSafeArtifact, datasetSchema, digest, type EvalCase, type EvalScore } from "./contracts"

export function createEvalLangfuse(environment: LangfuseEnvironment) {
  const client = createLangfuseClient(environment)
  async function request(path: string, body?: unknown) {
    if (body !== undefined) {
      assertSafeArtifact(body)
    }
    const response = await client.request(path, { body, timeoutMs: 20000 })
    if (!response.ok) {
      throw new Error(`Langfuse evaluation request failed: HTTP ${response.status}.`)
    }
    return response.json()
  }
  return {
    async verifyProject() {
      const projects = z.object({ data: z.array(z.object({ id: z.string() })) }).parse(await request("projects"))
      if (!projects.data.some((project) => project.id === "cmsw50z9p00dfad0i5wkf01jy")) {
        throw new Error("Langfuse keys do not belong to the legislation project.")
      }
    },
    async loadDataset(name: string) {
      const items: EvalCase[] = []
      const ids: Record<string, string> = {}
      const version = new Date().toISOString()
      for (let page = 1; ; page++) {
        const listing = z
          .object({
            data: z.array(
              z.object({
                id: z.string(),
                input: z.object({ messages: z.unknown(), followUps: z.unknown() }),
                expectedOutput: z.object({
                  reference: z.string(),
                  expected: z.unknown(),
                  turnCriteria: z.unknown().optional()
                }),
                metadata: z.object({
                  caseId: z.string(),
                  family: z.string(),
                  tags: z.array(z.string()),
                  review: z.string(),
                  provenance: z.string(),
                  fixturesJson: z.string(),
                  caseHash: z.string()
                })
              })
            ),
            meta: z.object({ totalPages: z.number().int().nonnegative() })
          })
          .parse(
            await request(
              `dataset-items?datasetName=${encodeURIComponent(name)}&version=${encodeURIComponent(version)}&limit=100&page=${page}`
            )
          )
        for (const stored of listing.data) {
          const item = datasetSchema.parse({
            name,
            cases: [
              {
                id: stored.metadata.caseId,
                family: stored.metadata.family,
                tags: stored.metadata.tags,
                review: stored.metadata.review,
                provenance: stored.metadata.provenance,
                ...stored.input,
                ...stored.expectedOutput,
                fixtures: JSON.parse(stored.metadata.fixturesJson)
              }
            ]
          }).cases[0]
          if (!item || digest(item) !== stored.metadata.caseHash || ids[item.id]) {
            throw new Error("Hosted dataset identity or content hash mismatch.")
          }
          items.push(item)
          ids[item.id] = stored.id
        }
        if (page >= listing.meta.totalPages) {
          break
        }
      }
      return { dataset: datasetSchema.parse({ name, cases: items }), synced: { ids, timestamp: version } }
    },
    async syncDataset(name: string, items: EvalCase[]) {
      await request("v2/datasets", {
        name,
        description: "Frozen-world legislative agent cases. Draft synthetic cases are diagnostic only.",
        metadata: { purpose: "agent-evaluation" }
      })
      const existing: { id: string; metadata: unknown }[] = []
      for (let page = 1; ; page++) {
        const listing = z
          .object({
            data: z.array(z.object({ id: z.string(), metadata: z.unknown() })),
            meta: z.object({ totalPages: z.number().int().nonnegative() })
          })
          .parse(await request(`dataset-items?datasetName=${encodeURIComponent(name)}&limit=100&page=${page}`))
        existing.push(...listing.data)
        if (page >= listing.meta.totalPages) {
          break
        }
      }
      const ids: Record<string, string> = {}
      for (const item of items) {
        const matches = existing.filter((entry) => {
          const metadata = z.object({ caseId: z.string() }).safeParse(entry.metadata)
          return metadata.success && metadata.data.caseId === item.id
        })
        if (matches.length > 1) {
          throw new Error("Duplicate Langfuse case identity; reconcile the dataset before executing.")
        }
        const id = matches[0]?.id ?? digest({ name, caseId: item.id })
        const metadata = z.object({ caseHash: z.string(), fixturesJson: z.string() }).safeParse(matches[0]?.metadata)
        if (
          metadata.success &&
          metadata.data.caseHash === digest(item) &&
          metadata.data.fixturesJson === JSON.stringify(item.fixtures)
        ) {
          ids[item.id] = id
          continue
        }
        await request("dataset-items", {
          id,
          datasetName: name,
          input: { messages: item.messages, followUps: item.followUps },
          expectedOutput: { reference: item.reference, expected: item.expected, turnCriteria: item.turnCriteria },
          metadata: {
            caseId: item.id,
            family: item.family,
            tags: item.tags,
            review: item.review,
            provenance: item.provenance,
            fixturesJson: JSON.stringify(item.fixtures),
            caseHash: digest(item),
            fixtureHash: digest(item.fixtures)
          }
        })
        ids[item.id] = id
      }
      return { ids, timestamp: new Date().toISOString() }
    },
    async publishResult(options: {
      runName: string
      datasetName: string
      datasetItemId: string
      datasetVersion: string
      traceId: string
      observationId: string
      output: unknown
      metadata: Record<string, unknown>
      scores: EvalScore[]
    }) {
      assertSafeArtifact(options)
      const sdk = new LangfuseClient({ ...langfuseSettings(environment), timeout: 20 })
      const dataset = await sdk.dataset.get(options.datasetName, { version: options.datasetVersion })
      const item = dataset.items.find((entry) => entry.id === options.datasetItemId)
      if (!item) {
        throw new Error("Frozen dataset item is unavailable; publication was not attempted.")
      }
      assertSafeArtifact(item.input)
      assertSafeArtifact(item.expectedOutput)
      assertSafeArtifact(item.metadata)
      let observationId: string | undefined
      const published = await sdk.experiment.run({
        name: options.runName,
        runName: options.runName,
        datasetVersion: options.datasetVersion,
        data: [item],
        maxConcurrency: 1,
        metadata: {
          ...options.metadata,
          sourceTraceId: options.traceId,
          sourceObservationId: options.observationId,
          publicationOnly: true
        },
        task: async () => {
          observationId = getActiveSpanId()
          return redactCredentials(options.output)
        }
      })
      const result = published.itemResults[0]
      if (published.itemResults.length !== 1 || !result?.datasetRunId || !result.traceId || !observationId) {
        throw new Error("Langfuse experiment publication failed; retry the saved upload.")
      }
      for (const score of options.scores) {
        if (score.value !== null) {
          await request("scores", {
            id: digest({ traceId: options.traceId, name: score.name }),
            traceId: result.traceId,
            observationId,
            name: score.name,
            value: score.value,
            dataType: "NUMERIC",
            comment: score.detail,
            environment: "evaluation",
            metadata: { releaseApproved: false }
          })
        }
      }
    },
    async publishEvaluatorPrompts(prompts: Record<string, string>) {
      for (const [name, prompt] of Object.entries(prompts)) {
        const existing = await request(`v2/prompts?name=${encodeURIComponent(name)}`)
        const listing = z.object({ data: z.array(z.object({ name: z.string() })) }).parse(existing)
        if (listing.data.some((entry) => entry.name === name)) {
          continue
        }
        await request("v2/prompts", {
          name,
          type: "text",
          prompt,
          labels: ["evaluation"],
          tags: ["evaluation"],
          commitMessage: "Uncalibrated screening evaluator; not a release approval mechanism."
        })
      }
    },
    async getEvaluatorPrompts() {
      const schema = z.object({
        name: z.string(),
        type: z.literal("text"),
        version: z.number().int().positive(),
        prompt: z.string().min(1),
        labels: z.array(z.string())
      })
      async function get(name: string) {
        const prompt = schema.parse(await request(`v2/prompts/${name}?label=evaluation`))
        if (prompt.name !== name || !prompt.labels.includes("evaluation")) {
          throw new Error("Evaluator prompt selection mismatch.")
        }
        return prompt
      }
      return { judge: await get("legislative-research-judge"), critic: await get("legislative-research-critic") }
    },
    startTracing() {
      const telemetry = startNodeTelemetry({
        langfuse: {
          ...langfuseSettings(environment),
          environment: "evaluation",
          mediaUploadEnabled: false
        }
      })
      return { shutdown: telemetry.shutdown }
    }
  }
}

export async function observeEval<T>(
  input: unknown,
  metadata: Record<string, unknown>,
  operation: (sessionId: string) => Promise<T>
) {
  assertSafeArtifact({ input, metadata })
  const sessionId = crypto.randomUUID()
  const correlation = Object.fromEntries(
    Object.entries(metadata).flatMap(([key, value]) => {
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        return []
      }
      const serialized = String(value)
      return serialized.length <= 200 ? [[key, serialized]] : []
    })
  )
  return propagateAttributes({ sessionId, traceName: "legislative-research-evaluation", metadata: correlation }, () =>
    startActiveObservation(
      "legislative-research-evaluation",
      async (observation) => {
        observation.update({ input, metadata })
        const result = await operation(sessionId)
        assertSafeArtifact(result)
        observation.update({ output: result })
        return { result, traceId: observation.traceId, observationId: observation.id }
      },
      { asType: "agent" }
    )
  )
}
