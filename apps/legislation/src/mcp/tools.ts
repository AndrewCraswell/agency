import { toNodeHandler } from "@modelcontextprotocol/node"
import { createMcpHandler, McpServer, type JSONValue } from "@modelcontextprotocol/server"
import { z } from "zod"
import { getRequestContext } from "../auth/request-context.js"
import { LegislationError } from "../legislation/errors.js"
import type { LegislationQueryService } from "../legislation/query-service.js"
import { errorContext, type Logger } from "../observability/logger.js"
import type { Telemetry } from "../observability/telemetry.js"

const canonicalBillId = z.string().regex(/^bill:[a-z0-9-]+:[^:]+:[a-z0-9-]+:[a-z0-9-]+$/)
const canonicalId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}:[a-z0-9-]+(?::[^:]+)*$`))
const entityLookupSchema = (prefix: string) =>
  z.object({
    cursor: z.string().optional(),
    id: canonicalId(prefix),
    limit: z.number().int().min(1).max(100).optional()
  })
const pageSchema = {
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional()
}
const optionalDateTime = z.iso
  .datetime()
  .transform((value) => new Date(value))
  .optional()
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
const MAXIMUM_BATCH_LOOKUPS = 25

export type LegislationQueryApi = Readonly<{
  compareBillVersions: (input: Parameters<LegislationQueryService["compareBillVersions"]>[0]) => Promise<unknown>
  findRelatedBills: (input: Parameters<LegislationQueryService["findRelatedBills"]>[0]) => Promise<unknown>
  getAmendment: (input: Parameters<LegislationQueryService["getAmendment"]>[0]) => Promise<unknown>
  getBill: (input: Parameters<LegislationQueryService["getBill"]>[0]) => Promise<unknown>
  getBillVotes: (input: Parameters<LegislationQueryService["getBillVotes"]>[0]) => Promise<unknown>
  getBillText: (input: Parameters<LegislationQueryService["getBillText"]>[0]) => Promise<unknown>
  getBillTimeline: (input: Parameters<LegislationQueryService["getBillTimeline"]>[0]) => Promise<unknown>
  getCalendar: (input: Parameters<LegislationQueryService["getCalendar"]>[0]) => Promise<unknown>
  getEvent: (input: Parameters<LegislationQueryService["getEvent"]>[0]) => Promise<unknown>
  getOrganization: (input: Parameters<LegislationQueryService["getOrganization"]>[0]) => Promise<unknown>
  getPerson: (input: Parameters<LegislationQueryService["getPerson"]>[0]) => Promise<unknown>
  getSupportingMaterial: (input: Parameters<LegislationQueryService["getSupportingMaterial"]>[0]) => Promise<unknown>
  getVote: (input: Parameters<LegislationQueryService["getVote"]>[0]) => Promise<unknown>
  searchAmendments: (input: Parameters<LegislationQueryService["searchAmendments"]>[0]) => Promise<unknown>
  searchBills: (input: Parameters<LegislationQueryService["searchBills"]>[0]) => Promise<unknown>
  searchBillText: (input: Parameters<LegislationQueryService["searchBillText"]>[0]) => Promise<unknown>
  searchChanges: (input: Parameters<LegislationQueryService["searchChanges"]>[0]) => Promise<unknown>
  searchEvents: (input: Parameters<LegislationQueryService["searchEvents"]>[0]) => Promise<unknown>
  searchOrganizations: (input: Parameters<LegislationQueryService["searchOrganizations"]>[0]) => Promise<unknown>
  searchPeople: (input: Parameters<LegislationQueryService["searchPeople"]>[0]) => Promise<unknown>
  searchSupportingMaterials: (
    input: Parameters<LegislationQueryService["searchSupportingMaterials"]>[0]
  ) => Promise<unknown>
  searchVotes: (input: Parameters<LegislationQueryService["searchVotes"]>[0]) => Promise<unknown>
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

async function batchLookup<T>(ids: readonly string[], operation: (id: string) => Promise<T>) {
  const uniqueIds = [...new Set(ids)]
  const items = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        return { data: await operation(id), id }
      } catch (error) {
        if (error instanceof LegislationError) {
          return { error: { category: error.category, message: error.message }, id }
        }
        throw error
      }
    })
  )
  return { items }
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
          description:
            "Get bounded canonical bill details with sponsors, actions, votes, documents, relations, and structured or document-backed amendments.",
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
        "get_bills",
        {
          description:
            "Get multiple canonical bills, including bounded sponsors, actions, votes, documents, relations, organizations, and amendments, in one tool call.",
          inputSchema: z.object({
            childLimit: z.number().int().min(1).max(25).optional(),
            ids: z.array(canonicalBillId).min(1).max(MAXIMUM_BATCH_LOOKUPS)
          }),
          outputSchema
        },
        (input) =>
          tool(
            "get_bills",
            input,
            () => batchLookup(input.ids, (id) => service.getBill({ childLimit: input.childLimit, id })),
            logger,
            telemetry
          )
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
          inputSchema: z.object({ billId: canonicalBillId, documentIds: z.array(z.string()).length(2) }),
          outputSchema
        },
        (input) =>
          tool(
            "compare_bill_versions",
            input,
            () => {
              const leftDocumentId = input.documentIds[0]
              const rightDocumentId = input.documentIds[1]
              if (leftDocumentId === undefined || rightDocumentId === undefined) {
                throw new LegislationError("invalid_request", "Exactly two document IDs are required")
              }
              return service.compareBillVersions({
                billId: input.billId,
                documentIds: [leftDocumentId, rightDocumentId]
              })
            },
            logger,
            telemetry
          )
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
      server.registerTool(
        "search_people",
        {
          description: "Discover canonical legislators by name, party, jurisdiction, committee, or active status.",
          inputSchema: z.object({
            ...pageSchema,
            isActive: z.boolean().optional(),
            jurisdictionId: canonicalId("jurisdiction").optional(),
            organizationId: canonicalId("organization").optional(),
            query: z.string().trim().min(1).max(200).optional()
          }),
          outputSchema
        },
        (input) => tool("search_people", input, () => service.searchPeople(input), logger, telemetry)
      )
      server.registerTool(
        "get_person",
        {
          description: "Get a canonical legislator with terms, memberships, and sponsored bills.",
          inputSchema: entityLookupSchema("person"),
          outputSchema
        },
        (input) => tool("get_person", input, () => service.getPerson(input), logger, telemetry)
      )
      server.registerTool(
        "search_organizations",
        {
          description: "Discover canonical legislatures, chambers, committees, and subcommittees.",
          inputSchema: z.object({
            ...pageSchema,
            classification: z.enum(["legislature", "chamber", "committee", "subcommittee"]).optional(),
            isActive: z.boolean().optional(),
            jurisdictionId: canonicalId("jurisdiction").optional(),
            parentOrganizationId: canonicalId("organization").optional(),
            query: z.string().trim().min(1).max(200).optional()
          }),
          outputSchema
        },
        (input) => tool("search_organizations", input, () => service.searchOrganizations(input), logger, telemetry)
      )
      server.registerTool(
        "get_organization",
        {
          description:
            "Get a canonical legislature, chamber, committee, or subcommittee with membership and bill activity.",
          inputSchema: entityLookupSchema("organization"),
          outputSchema
        },
        (input) => tool("get_organization", input, () => service.getOrganization(input), logger, telemetry)
      )
      server.registerTool(
        "search_events",
        {
          description: "Search available legislative meetings and hearings in a bounded date range.",
          inputSchema: z.object({
            ...pageSchema,
            from: optionalDateTime,
            jurisdictionId: canonicalId("jurisdiction").optional(),
            organizationId: canonicalId("organization").optional(),
            to: optionalDateTime
          }),
          outputSchema
        },
        (input) => tool("search_events", input, () => service.searchEvents(input), logger, telemetry)
      )
      server.registerTool(
        "get_event",
        {
          description: "Get a legislative event with agenda, participants, documents, and related bills.",
          inputSchema: entityLookupSchema("event"),
          outputSchema
        },
        (input) => tool("get_event", input, () => service.getEvent(input), logger, telemetry)
      )
      server.registerTool(
        "get_calendar",
        {
          description: "Get available chamber calendar entries for a jurisdiction and date range.",
          inputSchema: z.object({
            ...pageSchema,
            from: optionalDateTime,
            jurisdictionId: canonicalId("jurisdiction").optional(),
            organizationId: canonicalId("organization").optional(),
            to: optionalDateTime
          }),
          outputSchema
        },
        (input) => tool("get_calendar", input, () => service.getCalendar(input), logger, telemetry)
      )
      server.registerTool(
        "search_votes",
        {
          description: "Search roll calls by bill, member, organization, or observation window.",
          inputSchema: z.object({
            ...pageSchema,
            billId: canonicalBillId.optional(),
            from: optionalDateTime,
            organizationId: canonicalId("organization").optional(),
            personId: canonicalId("person").optional()
          }),
          outputSchema
        },
        (input) => tool("search_votes", input, () => service.searchVotes(input), logger, telemetry)
      )
      server.registerTool(
        "get_bill_votes",
        {
          description:
            "Get a bill's roll calls and normalized member positions in one bounded call, including a continuation cursor when more roll calls exist.",
          inputSchema: z.object({
            billId: canonicalBillId,
            cursor: z.string().optional(),
            limit: z.number().int().min(1).max(MAXIMUM_BATCH_LOOKUPS).optional()
          }),
          outputSchema
        },
        (input) => tool("get_bill_votes", input, () => service.getBillVotes(input), logger, telemetry)
      )
      server.registerTool(
        "get_vote",
        {
          description: "Get a roll call with normalized member positions.",
          inputSchema: entityLookupSchema("vote"),
          outputSchema
        },
        (input) => tool("get_vote", input, () => service.getVote(input), logger, telemetry)
      )
      server.registerTool(
        "get_votes",
        {
          description: "Get multiple roll calls and their normalized member positions in one call.",
          inputSchema: z.object({ ids: z.array(canonicalId("vote")).min(1).max(MAXIMUM_BATCH_LOOKUPS) }),
          outputSchema
        },
        (input) =>
          tool("get_votes", input, () => batchLookup(input.ids, (id) => service.getVote({ id })), logger, telemetry)
      )
      server.registerTool(
        "search_amendments",
        {
          description:
            "Search amendments by text, bill, jurisdiction, or sponsor. Results include structured federal amendments and explicitly labeled state amendment documents.",
          inputSchema: z.object({
            ...pageSchema,
            billId: canonicalBillId.optional(),
            jurisdictionId: canonicalId("jurisdiction").optional(),
            mode: z.enum(["lexical", "semantic", "hybrid"]).default("lexical"),
            query: z.string().trim().min(1).max(500).optional(),
            sponsorPersonId: canonicalId("person").optional()
          }),
          outputSchema
        },
        (input) => tool("search_amendments", input, () => service.searchAmendments(input), logger, telemetry)
      )
      server.registerTool(
        "get_amendment",
        {
          description:
            "Get a structured amendment with actions, votes, and supporting material, or a document-backed state amendment with its published file metadata.",
          inputSchema: entityLookupSchema("amendment"),
          outputSchema
        },
        (input) => tool("get_amendment", input, () => service.getAmendment(input), logger, telemetry)
      )
      server.registerTool(
        "get_amendments",
        {
          description:
            "Get multiple structured or document-backed amendments in one call. Structured records include actions, votes, and supporting material when available.",
          inputSchema: z.object({ ids: z.array(canonicalId("amendment")).min(1).max(MAXIMUM_BATCH_LOOKUPS) }),
          outputSchema
        },
        (input) =>
          tool(
            "get_amendments",
            input,
            () => batchLookup(input.ids, (id) => service.getAmendment({ id })),
            logger,
            telemetry
          )
      )
      server.registerTool(
        "search_amendments_for_bills",
        {
          description:
            "Return structured and document-backed amendments for each of several canonical bill IDs in one call.",
          inputSchema: z.object({
            billIds: z.array(canonicalBillId).min(1).max(MAXIMUM_BATCH_LOOKUPS),
            jurisdictionId: canonicalId("jurisdiction").optional(),
            limit: z.number().int().min(1).max(25).optional(),
            query: z.string().trim().min(1).max(500).optional(),
            sponsorPersonId: canonicalId("person").optional()
          }),
          outputSchema
        },
        (input) =>
          tool(
            "search_amendments_for_bills",
            input,
            () =>
              batchLookup(input.billIds, (billId) =>
                service.searchAmendments({
                  billId,
                  jurisdictionId: input.jurisdictionId,
                  limit: input.limit,
                  query: input.query,
                  sponsorPersonId: input.sponsorPersonId
                })
              ),
            logger,
            telemetry
          )
      )
      server.registerTool(
        "search_supporting_materials",
        {
          description: "Search reports, hearings, fiscal notes, analyses, testimony, and other supporting material.",
          inputSchema: z.object({
            ...pageSchema,
            amendmentId: canonicalId("amendment").optional(),
            billId: canonicalBillId.optional(),
            classification: z.string().trim().min(1).optional(),
            eventId: canonicalId("event").optional(),
            jurisdictionId: canonicalId("jurisdiction").optional(),
            mode: z.enum(["lexical", "semantic", "hybrid"]).default("lexical"),
            query: z.string().trim().min(1).max(500).optional()
          }),
          outputSchema
        },
        (input) =>
          tool("search_supporting_materials", input, () => service.searchSupportingMaterials(input), logger, telemetry)
      )
      server.registerTool(
        "get_supporting_material",
        {
          description: "Get one supporting material record, canonical links, and paginated extracted sections.",
          inputSchema: entityLookupSchema("material"),
          outputSchema
        },
        (input) => tool("get_supporting_material", input, () => service.getSupportingMaterial(input), logger, telemetry)
      )
      server.registerTool(
        "search_changes",
        {
          description: "Search observed canonical record changes by record, jurisdiction, committee, or person.",
          inputSchema: z.object({
            ...pageSchema,
            jurisdictionId: canonicalId("jurisdiction").optional(),
            organizationId: canonicalId("organization").optional(),
            personId: canonicalId("person").optional(),
            recordId: z.string().trim().min(1).optional(),
            recordType: z.string().trim().min(1).max(100).optional()
          }),
          outputSchema
        },
        (input) => tool("search_changes", input, () => service.searchChanges(input), logger, telemetry)
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
