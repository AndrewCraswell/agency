import { dynamicTool, type ToolSet } from "ai"
import { z } from "zod"
import { createLegislationResearchTools, type LegislationQueryApi } from "../../src/mcp/tools"
import { createLogger } from "../../src/observability/logger"
import { getResearchRuntime } from "../../src/server/next/research-runtime"
import { getNextLegislationApplication } from "../../src/server/next/runtime"
import { projectResearchEvidence } from "../lib/evidence"
import { ResearchFailure, researchFailureCode } from "../lib/researchFailure"
import { isResearchTool, researchToolLabels } from "../lib/researchTools"
import { researchAgentLimits } from "./agent"
import { resultStore } from "./resultStore"
import { createToolFailureReporter } from "./toolFailures"

const resultSchema = z.object({ structuredContent: z.object({ data: z.json() }) })
const cursorInputSchema = z.object({ cursor: z.string().optional() })
const failureSchema = z.object({ error: z.string(), message: z.string().optional() })

function modelInputSchema(schema: z.ZodType) {
  if (!(schema instanceof z.ZodObject)) {
    throw new Error("Research tools require object inputs")
  }
  const fields: Record<string, z.ZodType> = {}
  for (const [name, field] of Object.entries(schema.shape)) {
    if (!(field instanceof z.ZodType)) {
      throw new Error("Research field schema is invalid")
    }
    fields[name] = field.isOptional()
      ? field
          .nonoptional()
          .nullable()
          .describe(
            `${field.description ?? "Optional filter or setting."} Use null when not needed. Do not invent placeholder values.`
          )
      : field
  }
  return z
    .strictObject(fields)
    .transform((input) => schema.parse(Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null))))
}

function collectCursors(value: unknown, cursors: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectCursors(item, cursors)
    }
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "nextCursor" && typeof item === "string" && item.length > 0) {
        cursors.add(item)
      } else {
        collectCursors(item, cursors)
      }
    }
  }
}

export function createResearchTools(
  environment: NodeJS.ProcessEnv,
  signal: AbortSignal,
  canResearch = () => true,
  reportFailure = createToolFailureReporter(crypto.randomUUID()),
  sessionKey?: string,
  queryServiceOverride?: LegislationQueryApi
) {
  if (environment.NODE_ENV !== "development") {
    throw new Error("Direct demo research is only available in development.")
  }
  signal.throwIfAborted()
  const queryService = queryServiceOverride ?? getNextLegislationApplication().queryService
  const logger = createLogger({ service: "legislation-chat", level: "warn" })
  const definitions = createLegislationResearchTools(queryService, logger)
  async function execute(name: string, input: unknown) {
    if (queryServiceOverride) {
      const definition = definitions.find((candidate) => candidate.name === name)
      if (!definition) {
        throw new Error("Research tool is unavailable")
      }
      return definition.execute(input)
    }
    return getResearchRuntime().run(async (service) => {
      signal.throwIfAborted()
      const definition = createLegislationResearchTools(service, logger).find((candidate) => candidate.name === name)
      if (!definition) {
        throw new Error("Research tool is unavailable")
      }
      return definition.execute(input)
    })
  }
  const tools: ToolSet = {}
  const cursors = new Set<string>()
  let calls = 0
  for (const definition of definitions) {
    const { name } = definition
    if (!isResearchTool(name)) {
      continue
    }
    tools[name] = dynamicTool({
      description: definition.description ?? researchToolLabels[name],
      inputSchema: modelInputSchema(definition.inputSchema),
      execute: async (input, { toolCallId }) => {
        const reference = crypto.randomUUID()
        const startedAt = performance.now()
        let resultBytes: number | undefined
        try {
          signal.throwIfAborted()
          if (!canResearch()) {
            throw new ResearchFailure("interrupted", reference)
          }
          calls++
          if (calls > researchAgentLimits.calls) {
            throw new ResearchFailure("step_limit", reference)
          }
          const pagination = cursorInputSchema.parse(input)
          if (pagination.cursor !== undefined && !cursors.has(pagination.cursor)) {
            throw new ResearchFailure("invalid_cursor", reference)
          }
          const result = await execute(name, input)
          signal.throwIfAborted()
          if ("isError" in result && result.isError) {
            const content = result.content[0]
            const failure = content?.type === "text" ? failureSchema.safeParse(JSON.parse(content.text)) : undefined
            let code = researchFailureCode(failure?.success ? failure.data.error : undefined)
            if (failure?.success && /timed out/i.test(failure.data.message ?? "")) {
              code = "timeout"
            }
            throw new ResearchFailure(code, reference)
          }
          const parsed = resultSchema.safeParse(result)
          if (!parsed.success) {
            throw new ResearchFailure("invalid_response", reference)
          }
          resultBytes = Buffer.byteLength(JSON.stringify(parsed.data.structuredContent), "utf8")
          if (resultBytes > 180000) {
            throw new ResearchFailure("result_limit", reference)
          }
          collectCursors(parsed.data.structuredContent, cursors)
          const pageInput = z.record(z.string(), z.unknown()).parse(input)
          const resultSet = sessionKey
            ? resultStore.create(
                sessionKey,
                name,
                parsed.data.structuredContent.data,
                typeof pageInput.query === "string" ? pageInput.query : undefined,
                async (cursor, pageSignal) => {
                  const nextResult = await getResearchRuntime().run(async (service) => {
                    pageSignal.throwIfAborted()
                    const nextTool = createLegislationResearchTools(service, logger).find(
                      (candidate) => candidate.name === name
                    )
                    if (!nextTool) {
                      throw new ResearchFailure("not_found", crypto.randomUUID())
                    }
                    return nextTool.execute({ ...pageInput, cursor, limit: 5 })
                  })
                  pageSignal.throwIfAborted()
                  if ("isError" in nextResult && nextResult.isError) {
                    throw new ResearchFailure("dependency_unavailable", crypto.randomUUID())
                  }
                  const page = resultSchema.parse(nextResult)
                  if (Buffer.byteLength(JSON.stringify(page.structuredContent), "utf8") > 180000) {
                    throw new ResearchFailure("result_limit", crypto.randomUUID())
                  }
                  return page.structuredContent.data
                }
              )
            : undefined
          return {
            ...parsed.data.structuredContent,
            evidence: projectResearchEvidence(parsed.data.structuredContent.data, () => crypto.randomUUID()),
            resultSet
          }
        } catch (error) {
          let failure = error instanceof ResearchFailure ? error : new ResearchFailure("internal", reference)
          if (signal.aborted) {
            const isTimeout = signal.reason instanceof Error && signal.reason.name === "TimeoutError"
            failure = new ResearchFailure(isTimeout ? "timeout" : "interrupted", reference)
          } else if (error instanceof z.ZodError) {
            failure = new ResearchFailure("invalid_request", reference)
          }
          reportFailure({
            toolCallId,
            toolName: name,
            error: failure,
            durationMs: Math.round(performance.now() - startedAt),
            resultBytes
          })
          logger.warn("Research tool failed", {
            tool: name,
            category: failure.code,
            reference,
            resultBytes,
            durationMs: Math.round(performance.now() - startedAt)
          })
          throw failure
        }
      }
    })
  }
  return tools
}
