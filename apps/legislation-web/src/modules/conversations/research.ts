import { createLogger } from "@repo/legislation-core/observability/logger"
import { researchResultByteLimit } from "@repo/legislation-core/research/result-pages"
import { createLegislationResearchTools, type LegislationQueryApi } from "@repo/legislation-core/research/tools"
import { dynamicTool, type ToolSet } from "ai"
import { z } from "zod"
import { getNextLegislationApplication } from "../legislation/runtime/runtime"
import { getResearchRuntime } from "../search/research-runtime"
import { researchAgentLimits } from "./agent"
import { chatIsAvailable } from "./chatRequest"
import { recordMentionHref } from "./composition"
import { entityPageSchema, type EntityPage } from "./entityResults"
import { evidenceSnapshotSchema } from "./evidence"
import { createResearchEvidenceProjector } from "./evidenceSource.server"
import { contentOptions, projectPresentationContents, type PresentationContent } from "./presentationContent"
import { ResearchFailure, researchFailureCode } from "./researchFailure"
import { isResearchTool, researchToolLabels } from "./researchTools"
import { resultStore } from "./resultStore"
import { createToolFailureReporter } from "./toolFailures"

const resultSchema = z.object({ structuredContent: z.object({ data: z.json() }) })
const cursorInputSchema = z.object({ cursor: z.string().optional() })
const failureSchema = z.object({ error: z.string(), message: z.string().optional() })
const modelResultSchema = z.looseObject({
  evidence: z.array(evidenceSnapshotSchema.required({ citationRef: true })).max(40)
})

export function researchModelOutput({ output }: { output: unknown }) {
  const result = modelResultSchema.parse(output)
  const page = entityPageSchema.safeParse(result.resultSet)
  const recordLinks = page.success
    ? page.data.items.map((record) => ({
        recordId: record.id,
        label: record.title,
        href: recordMentionHref({ resultId: page.data.id, recordId: record.id })
      }))
    : []
  return {
    type: "text" as const,
    value: JSON.stringify({
      ...result,
      ...(page.success && typeof result.resultHandle === "string"
        ? { resultSet: { ...page.data, id: result.resultHandle } }
        : {}),
      ...(recordLinks.length > 0 ? { recordLinks } : {}),
      evidence: result.evidence.map(({ citationRef, ...source }, index) => ({
        ...source,
        id: citationRef,
        citation: `[${index + 1}](#citation-${citationRef})`
      }))
    })
  }
}

export function modelInputSchema(schema: z.ZodType) {
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
      if ((key === "nextCursor" || key === "nextChildCursor") && typeof item === "string" && item.length > 0) {
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
  reportFailure?: ReturnType<typeof createToolFailureReporter>,
  sessionKey?: string,
  queryServiceOverride?: LegislationQueryApi,
  runId: string = crypto.randomUUID(),
  onResultSet?: (page: EntityPage) => string | void,
  previousCitationReferences: readonly string[] = [],
  onContents?: (contents: PresentationContent[]) => void
) {
  if (environment.NODE_ENV !== "development" && !chatIsAvailable(environment)) {
    throw new Error("Research is unavailable in this environment.")
  }
  signal.throwIfAborted()
  const queryService = queryServiceOverride ?? getNextLegislationApplication().queryService
  const logger = createLogger({ service: "legislation-chat", level: "warn" })
  const projectEvidence = createResearchEvidenceProjector(logger, runId, previousCitationReferences)
  const failureReporter = reportFailure ?? createToolFailureReporter(runId)
  const definitions = createLegislationResearchTools(queryService, logger)
  async function execute(name: string, input: unknown, executionSignal = signal) {
    executionSignal.throwIfAborted()
    if (queryServiceOverride) {
      const definition = definitions.find((candidate) => candidate.name === name)
      if (!definition) {
        throw new Error("Research tool is unavailable")
      }
      return definition.execute(input)
    }
    return getResearchRuntime().run(async (service) => {
      executionSignal.throwIfAborted()
      const definition = createLegislationResearchTools(service, logger).find(
        (candidate) => candidate.name === name
      )
      if (!definition) {
        throw new Error("Research tool is unavailable")
      }
      return definition.execute(input)
    }, executionSignal)
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
      toModelOutput: researchModelOutput,
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
          const childPagination = z.object({ childCursor: z.string().optional() }).parse(input)
          if (childPagination.childCursor !== undefined && !cursors.has(childPagination.childCursor)) {
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
          if (resultBytes > researchResultByteLimit) {
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
                  const nextResult = await execute(name, { ...pageInput, cursor }, pageSignal)
                  pageSignal.throwIfAborted()
                  if ("isError" in nextResult && nextResult.isError) {
                    throw new ResearchFailure("dependency_unavailable", crypto.randomUUID())
                  }
                  const page = resultSchema.parse(nextResult)
                  if (Buffer.byteLength(JSON.stringify(page.structuredContent), "utf8") > researchResultByteLimit) {
                    throw new ResearchFailure("result_limit", crypto.randomUUID())
                  }
                  return page.structuredContent.data
                },
                pageInput
              )
            : undefined
          let resultHandle: string | void = undefined
          if (resultSet) {
            await resultStore.persist(resultSet.id)
            resultHandle = onResultSet?.(resultSet)
          }
          const evidence = projectEvidence(parsed.data.structuredContent.data)
          const contents = onContents
            ? projectPresentationContents(name, parsed.data.structuredContent.data, evidence, resultSet)
            : []
          onContents?.(contents)
          return {
            ...parsed.data.structuredContent,
            ...(typeof resultHandle === "string" ? { resultHandle } : {}),
            evidence,
            ...(onContents ? { presentationOptions: contents.map(contentOptions) } : {}),
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
          failureReporter({
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
