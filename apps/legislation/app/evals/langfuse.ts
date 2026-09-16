import { LangfuseSpanProcessor } from "@langfuse/otel"
import { startActiveObservation } from "@langfuse/tracing"
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { registerTelemetry } from "ai"
import { z } from "zod"
import { assertSafeArtifact, digest, type EvalCase, type EvalScore } from "./contracts"

export function createEvalLangfuse(environment: NodeJS.ProcessEnv) {
  const publicKey = environment.LANGFUSE_PUBLIC_KEY?.trim()
  const secretKey = environment.LANGFUSE_SECRET_KEY?.trim()
  const baseUrl = environment.LANGFUSE_BASE_URL ?? "https://us.cloud.langfuse.com"
  const url = new URL(baseUrl)
  if (!publicKey || !secretKey || url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Langfuse HTTPS credentials are required.")
  }
  const headers = {
    authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`,
    "content-type": "application/json"
  }
  async function request(path: string, body?: unknown) {
    if (body !== undefined) {
      assertSafeArtifact(body)
    }
    const response = await fetch(new URL(`/api/public/${path}`, baseUrl), {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(20000)
    })
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
          expectedOutput: { reference: item.reference, expected: item.expected },
          metadata: {
            caseId: item.id,
            family: item.family,
            tags: item.tags,
            review: item.review,
            provenance: item.provenance,
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
      const processor = new LangfuseSpanProcessor({
        publicKey,
        secretKey,
        baseUrl,
        environment: "evaluation",
        mediaUploadEnabled: false
      })
      const sdk = new NodeSDK({ spanProcessors: [processor] })
      sdk.start()
      registerTelemetry(new LangfuseVercelAiSdkIntegration())
      return { shutdown: () => sdk.shutdown() }
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
