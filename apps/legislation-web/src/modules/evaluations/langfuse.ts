import { startActiveObservation } from "@langfuse/tracing"
import { z } from "zod"
import { createLangfuseClient, langfuseSettings, type LangfuseEnvironment } from "../../services/langfuse/client"
import { startLangfuseTelemetry } from "../../services/langfuse/telemetry"
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
                  fixtures: z.unknown(),
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
                fixtures: stored.metadata.fixtures
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
        const metadata = z.object({ caseHash: z.string() }).safeParse(matches[0]?.metadata)
        if (metadata.success && metadata.data.caseHash === digest(item)) {
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
            fixtures: item.fixtures,
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
      datasetItemId: string
      datasetVersion: string
      traceId: string
      observationId: string
      metadata: unknown
      scores: EvalScore[]
    }) {
      await request("dataset-run-items", {
        runName: options.runName,
        datasetItemId: options.datasetItemId,
        datasetVersion: options.datasetVersion,
        traceId: options.traceId,
        observationId: options.observationId,
        metadata: options.metadata
      })
      const batch = options.scores
        .filter((score) => score.value !== null)
        .map((score) => ({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          type: "score-create",
          body: {
            id: digest({ traceId: options.traceId, name: score.name }),
            traceId: options.traceId,
            observationId: options.observationId,
            name: score.name,
            value: score.value,
            dataType: "NUMERIC",
            comment: score.detail,
            environment: "evaluation",
            metadata: { releaseApproved: false }
          }
        }))
      if (batch.length) {
        const response = z.object({ errors: z.array(z.unknown()) }).parse(await request("ingestion", { batch }))
        if (response.errors.length) {
          throw new Error("Langfuse rejected part of the score batch; retry the saved upload.")
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
      const telemetry = startLangfuseTelemetry({
        ...langfuseSettings(environment),
        environment: "evaluation",
        mediaUploadEnabled: false
      })
      return { shutdown: telemetry.shutdown }
    }
  }
}

export async function observeEval<T>(input: unknown, metadata: Record<string, unknown>, operation: () => Promise<T>) {
  assertSafeArtifact({ input, metadata })
  return startActiveObservation(
    "legislative-research-evaluation",
    async (observation) => {
      observation.update({ input, metadata })
      const result = await operation()
      assertSafeArtifact(result)
      observation.update({ output: result })
      return { result, traceId: observation.traceId, observationId: observation.id }
    },
    { asType: "agent" }
  )
}
