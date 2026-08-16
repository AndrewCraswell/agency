import { toNodeHandler } from "@modelcontextprotocol/node"
import { createMcpHandler, McpServer, type JSONValue } from "@modelcontextprotocol/server"
import { z } from "zod"
import { getRequestContext } from "../auth/request-context.js"
import { LegislationError } from "../legislation/errors.js"
import type { LegislationQueryService } from "../legislation/query-service.js"
import { errorContext, type Logger } from "../observability/logger.js"
import type { Telemetry } from "../observability/telemetry.js"

const canonicalBillId = z.string().regex(/^bill:[a-z0-9-]+:[^:]+:[a-z0-9-]+:[a-z0-9-]+$/)
const searchFilters = {
  classifications: z.array(z.string()).optional(),
  cursor: z.string().optional(),
  introducedFrom: z.string().optional(),
  introducedTo: z.string().optional(),
  jurisdictionIds: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  query: z.string().trim().min(1).max(500),
  sessionIds: z.array(z.string()).optional(),
  sponsorIds: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  subjects: z.array(z.string()).optional()
}
const outputSchema = z.object({ data: z.json() })
const MAXIMUM_RESPONSE_BYTES = 900_000
const TOOL_TIMEOUT_MILLISECONDS = 30_000

export type LegislationQueryApi = Readonly<{
  compareBillVersions: (input: Parameters<LegislationQueryService["compareBillVersions"]>[0]) => Promise<unknown>
  findRelatedBills: (input: Parameters<LegislationQueryService["findRelatedBills"]>[0]) => Promise<unknown>
  getBill: (input: Parameters<LegislationQueryService["getBill"]>[0]) => Promise<unknown>
  getBillText: (input: Parameters<LegislationQueryService["getBillText"]>[0]) => Promise<unknown>
  getBillTimeline: (input: Parameters<LegislationQueryService["getBillTimeline"]>[0]) => Promise<unknown>
  searchBills: (input: Parameters<LegislationQueryService["searchBills"]>[0]) => Promise<unknown>
  searchBillText: (input: Parameters<LegislationQueryService["searchBillText"]>[0]) => Promise<unknown>
}>

function success(value: unknown) {
  const data = toJsonValue(value)
  const serialized = JSON.stringify(data)
  if (Buffer.byteLength(serialized, "utf8") > MAXIMUM_RESPONSE_BYTES) {
    return {
      content: [
        {
          text: JSON.stringify({ error: "result_limit", message: "The result exceeds the response size limit" }),
          type: "text" as const
        }
      ],
      isError: true
    }
  }
  return {
    content: [{ text: serialized, type: "text" as const }],
    structuredContent: { data }
  }
}

function toJsonValue(value: unknown): JSONValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    return value.map(toJsonValue)
  }
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonValue(item)]))
  }
  return null
}

function failure(error: unknown, logger: Logger) {
  if (error instanceof LegislationError) {
    return {
      content: [{ text: JSON.stringify({ error: error.category, message: error.message }), type: "text" as const }],
      isError: true
    }
  }
  logger.error("MCP tool failed", errorContext(error))
  return {
    content: [
      {
        text: JSON.stringify({ error: "internal", message: "The request could not be completed" }),
        type: "text" as const
      }
    ],
    isError: true
  }
}

async function tool<T>(
  name: string,
  input: Readonly<Record<string, unknown>>,
  operation: () => Promise<T>,
  logger: Logger,
  telemetry?: Telemetry
) {
  const context = getRequestContext()
  const metadata = {
    ...input,
    correlationId: context?.correlationId,
    organizationId: context?.identity?.organizationId,
    userId: context?.identity?.userId
  }
  const execute = telemetry === undefined ? operation : () => telemetry.observe(`mcp.${name}`, metadata, operation)
  let timeout: NodeJS.Timeout | undefined
  try {
    const value = await Promise.race([
      execute(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new LegislationError("dependency_unavailable", "The tool execution timed out")),
          TOOL_TIMEOUT_MILLISECONDS
        )
        timeout.unref()
      })
    ])
    return success(value)
  } catch (error) {
    return failure(error, logger)
  } finally {
    clearTimeout(timeout)
  }
}

export function createLegislationMcpHandler(service: LegislationQueryApi, logger: Logger, telemetry?: Telemetry) {
  const handler = createMcpHandler(
    () => {
      const server = new McpServer({ name: "legislation", version: "0.1.0" }, { capabilities: { tools: {} } })

      server.registerTool(
        "search_bills",
        {
          description: "Search state and federal bills using structured, lexical, semantic, or hybrid retrieval.",
          inputSchema: z.object({
            ...searchFilters,
            mode: z.enum(["lexical", "semantic", "hybrid"]).default("lexical")
          }),
          outputSchema
        },
        (input) => tool("search_bills", input, () => service.searchBills(input), logger, telemetry)
      )
      server.registerTool(
        "get_bill",
        {
          description: "Get bounded canonical bill details with sponsors, actions, votes, documents, and relations.",
          inputSchema: z.object({
            childCursor: z.string().optional(),
            childLimit: z.number().int().min(1).max(100).optional(),
            id: canonicalBillId
          }),
          outputSchema
        },
        (input) => tool("get_bill", input, () => service.getBill(input), logger, telemetry)
      )
      server.registerTool(
        "get_bill_timeline",
        {
          description: "Get a deterministically ordered bill action and vote timeline.",
          inputSchema: z.object({
            childCursor: z.string().optional(),
            childLimit: z.number().int().min(1).max(100).optional(),
            id: canonicalBillId
          }),
          outputSchema
        },
        (input) => tool("get_bill_timeline", input, () => service.getBillTimeline(input), logger, telemetry)
      )
      server.registerTool(
        "search_bill_text",
        {
          description: "Search processed legislative passages with optional bill and document filters.",
          inputSchema: z.object({
            ...searchFilters,
            billId: canonicalBillId.optional(),
            documentIds: z.array(z.string()).optional(),
            mode: z.enum(["lexical", "semantic", "hybrid"]).default("lexical")
          }),
          outputSchema
        },
        (input) => tool("search_bill_text", input, () => service.searchBillText(input), logger, telemetry)
      )
      server.registerTool(
        "get_bill_text",
        {
          description: "Get one processed bill version through bounded section pages.",
          inputSchema: z.object({
            cursor: z.string().optional(),
            documentId: z.string().optional(),
            id: canonicalBillId,
            versionCode: z.string().optional()
          }),
          outputSchema
        },
        (input) => tool("get_bill_text", input, () => service.getBillText(input), logger, telemetry)
      )
      server.registerTool(
        "compare_bill_versions",
        {
          description: "Compare two processed versions of the same canonical bill by legal section.",
          inputSchema: z.object({ billId: canonicalBillId, documentIds: z.tuple([z.string(), z.string()]) }),
          outputSchema
        },
        (input) => tool("compare_bill_versions", input, () => service.compareBillVersions(input), logger, telemetry)
      )
      server.registerTool(
        "find_related_bills",
        {
          description: "Find explicitly related canonical bills without duplicates.",
          inputSchema: z.object({
            id: canonicalBillId,
            includeSemantic: z.boolean().optional(),
            limit: z.number().int().min(1).max(100).optional()
          }),
          outputSchema
        },
        (input) => tool("find_related_bills", input, () => service.findRelatedBills(input), logger, telemetry)
      )
      return server
    },
    {
      legacy: "stateless",
      onerror: (error) => logger.error("MCP protocol error", errorContext(error)),
      responseMode: "auto"
    }
  )

  return { close: handler.close, fetch: handler.fetch, nodeHandler: toNodeHandler(handler) }
}
