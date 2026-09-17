import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createDatabase, withReadOnlyDatabase } from "@repo/legislation-core/database/database"
import {
  amendments,
  billDocuments,
  legislativeEvents,
  organizations,
  people,
  supportingMaterials,
  votes
} from "@repo/legislation-core/database/schema/schema"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { createLegislationResearchTools } from "@repo/legislation-core/research/tools"
import { and, asc, eq, isNotNull, like } from "drizzle-orm"
import invariant from "tiny-invariant"
import { z } from "zod"
import { loadConfig } from "../src/modules/configuration/config"
import { redactCredentials } from "../src/modules/conversations/capture"
import {
  projectMeetingDetails,
  projectProfileDetails,
  projectVoteDetails
} from "../src/modules/conversations/recordDetails"
import { createResultStore } from "../src/modules/conversations/resultStore"
import {
  reviewDatasetSchema,
  reviewMaterialIds,
  reviewMeetingIds,
  type ReviewDataset
} from "../src/modules/conversations/stories/reviewData"
import { LegislationQueryService } from "../src/modules/legislation/query-service"

const config = loadConfig()
const connection = createDatabase({ ...config.database, maxConnections: 1 })
const store = createResultStore()
const destination = new URL("../src/modules/conversations/stories/captured.json", import.meta.url)
const detailsOnly = process.argv.includes("--details-only")
const retrievalOnly = process.argv.includes("--retrieval-only")
const dataset: ReviewDataset =
  detailsOnly || retrievalOnly
    ? reviewDatasetSchema.parse(JSON.parse(await readFile(destination, "utf8")))
    : { capturedAt: new Date().toISOString(), captures: [], details: {}, failures: [] }
const logger = createLogger({ service: "storybook-capture", level: "error" })
const billId = "bill:ca:20232024:ab:2652"
const sessionKey = crypto.randomUUID()
const outputSchema = z.object({ structuredContent: z.object({ data: z.json() }) })

async function capture(toolName: string, input: Record<string, z.infer<ReturnType<typeof z.json>>>) {
  process.stdout.write(`Fetching ${toolName}\n`)
  try {
    const result = await withReadOnlyDatabase(connection.pool, 60000, async (database) => {
      const definitions = createLegislationResearchTools(new LegislationQueryService(database), logger)
      const tool = definitions.find((definition) => definition.name === toolName)
      invariant(tool, `Unknown tool: ${toolName}`)
      return tool.execute(input)
    })
    const parsed = outputSchema.safeParse(result)
    if (!parsed.success) {
      const failure = z.object({ content: z.array(z.object({ text: z.string() })) }).safeParse(result)
      dataset.failures.push({
        toolName,
        message: failure.success
          ? (failure.data.content[0]?.text ?? "Capture failed")
          : "The live tool did not return a successful result."
      })
      return
    }
    const data = parsed.data.structuredContent.data
    const resultSet = store.create(
      sessionKey,
      toolName,
      data,
      typeof input.query === "string" ? input.query : undefined,
      async () => {
        throw new Error("Captured stories do not fetch live pages.")
      }
    )
    dataset.captures.push({ toolName, input, output: { data, resultSet } })
    if (resultSet?.items[0]) {
      const key = `${resultSet.id}/${resultSet.items[0].id}`
      if (toolName === "get_vote") {
        dataset.details[key] = projectVoteDetails(data)
      }
      if (toolName === "get_event") {
        dataset.details[key] = projectMeetingDetails(data)
      }
      if (toolName === "get_person") {
        dataset.details[key] = projectProfileDetails("person", data)
      }
      if (toolName === "get_organization") {
        dataset.details[key] = projectProfileDetails("organization", data)
      }
      if (toolName === "get_supporting_material") {
        dataset.details[key] = projectProfileDetails("material", data)
      }
    }
  } catch (error) {
    dataset.failures.push({ toolName, message: error instanceof Error ? error.name : "Capture failed" })
  }
}

try {
  if (retrievalOnly) {
    const person = dataset.captures.find((item) => item.toolName === "get_person")?.input.id
    const organization = dataset.captures.find((item) => item.toolName === "get_organization")?.input.id
    const document = dataset.captures.find((item) => item.toolName === "get_bill_text")?.input.documentId
    invariant(
      typeof person === "string" && typeof organization === "string" && typeof document === "string",
      "Missing retained capture identities"
    )
    const requests: Array<[string, Record<string, z.infer<ReturnType<typeof z.json>>>]> = [
      ["describe_analytics", { datasets: ["bills"] }],
      [
        "analyze_legislation",
        {
          dataset: "bills",
          select: ["id", "identifier"],
          filters: [{ field: "id", op: "eq", values: [billId] }],
          limit: 1
        }
      ],
      [
        "resolve_record",
        { kind: "bill", identifier: "H.R. 1", jurisdictionId: "jurisdiction:us", sessionId: "session:us:116" }
      ],
      ["list_jurisdictions", { query: "United States", limit: 2 }],
      ["list_sessions", { jurisdictionId: "jurisdiction:us", limit: 3 }],
      ["get_memberships", { personId: person, limit: 2 }],
      ["get_sponsored_bills", { id: person, limit: 2 }],
      ["get_committee_bills", { id: organization, limit: 2 }],
      ["get_document_sections", { documentId: document, limit: 1 }],
      ["read_record_collection", { collection: "document-sections", recordId: document, limit: 1 }]
    ]
    for (const [name, input] of requests) {
      if (!dataset.captures.some((item) => item.toolName === name)) {
        await capture(name, input)
      }
    }
  }
  if (!detailsOnly && !retrievalOnly) {
    const selected = await withReadOnlyDatabase(connection.pool, 60000, async (database) => {
      const person = await database
        .select({ id: people.id, name: people.name })
        .from(people)
        .where(and(isNotNull(people.sourceUrl), eq(people.isActive, true)))
        .orderBy(asc(people.id))
        .limit(1)
      const organization = await database
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(and(eq(organizations.classification, "committee"), eq(organizations.membershipRelationsComplete, true)))
        .orderBy(asc(organizations.id))
        .limit(1)
      const meeting = await database
        .select({ id: legislativeEvents.id })
        .from(legislativeEvents)
        .where(isNotNull(legislativeEvents.sourceUrl))
        .orderBy(asc(legislativeEvents.id))
        .limit(1)
      const vote = await database
        .select({ id: votes.id, billId: votes.billId })
        .from(votes)
        .where(and(isNotNull(votes.sourceUrl), isNotNull(votes.yesCount), isNotNull(votes.billId)))
        .orderBy(asc(votes.id))
        .limit(1)
      const amendment = await database
        .select({ id: amendments.id, billId: amendments.billId })
        .from(amendments)
        .where(isNotNull(amendments.sourceUrl))
        .orderBy(asc(amendments.id))
        .limit(1)
      const material = await database
        .select({ id: supportingMaterials.id })
        .from(supportingMaterials)
        .where(and(like(supportingMaterials.id, "material:%"), eq(supportingMaterials.processingStatus, "processed")))
        .orderBy(asc(supportingMaterials.id))
        .limit(1)
      const documents = await database
        .select({ id: billDocuments.id })
        .from(billDocuments)
        .where(
          and(
            eq(billDocuments.billId, billId),
            eq(billDocuments.classification, "version"),
            eq(billDocuments.processingStatus, "processed")
          )
        )
        .orderBy(asc(billDocuments.id))
        .limit(2)
      return {
        person: person[0],
        organization: organization[0],
        meeting: meeting[0],
        vote: vote[0],
        amendment: amendment[0],
        material: material[0],
        documents
      }
    })
    invariant(
      selected.person &&
        selected.organization &&
        selected.meeting &&
        selected.vote &&
        selected.amendment &&
        selected.material &&
        selected.documents[0],
      "Live database is missing a required review record kind."
    )
    const requests: [string, Record<string, z.infer<ReturnType<typeof z.json>>>][] = [
      ["get_bill", { id: billId, childLimit: 5 }],
      ["get_bill", { id: "bill:ca:20232024:sb:1047", childLimit: 5 }],
      ["search_bills", { query: "AB 2652", sessionIds: ["session:ca:20232024"], limit: 5, mode: "lexical" }],
      ["get_bills", { ids: [billId, "bill:ca:20232024:sb:1047"], childLimit: 5 }],
      ["get_bill_timeline", { id: billId, limit: 5 }],
      [
        "search_bill_text",
        {
          query: "working group",
          billId,
          documentIds: selected.documents.map((document) => document.id),
          limit: 5,
          mode: "lexical"
        }
      ],
      ["get_bill_text", { id: billId, documentId: selected.documents[0].id }],
      ["find_related_bills", { id: billId, limit: 5, mode: "lexical" }],
      ["search_people", { query: selected.person.name, limit: 5 }],
      ["get_person", { id: selected.person.id }],
      ["search_organizations", { query: selected.organization.name, limit: 5 }],
      ["get_organization", { id: selected.organization.id }],
      ["search_events", { limit: 5 }],
      ["get_event", { id: selected.meeting.id }],
      ["search_votes", { limit: 5 }],
      ["get_vote", { id: selected.vote.id }],
      ["get_votes", { ids: [selected.vote.id] }],
      ["search_amendments", { limit: 5, mode: "lexical" }],
      ["get_amendment", { id: selected.amendment.id }],
      ["get_amendments", { ids: [selected.amendment.id] }],
      ["search_supporting_materials", { limit: 5, mode: "lexical" }],
      ["get_supporting_material", { id: selected.material.id }],
      ["search_changes", { limit: 5 }]
    ]
    if (selected.vote.billId) {
      requests.push(["get_bill_votes", { billId: selected.vote.billId, limit: 2 }])
    }
    if (selected.amendment.billId) {
      requests.push(["search_amendments_for_bills", { billIds: [selected.amendment.billId], limit: 5 }])
    }
    if (selected.documents.length === 2) {
      requests.push([
        "compare_bill_versions",
        { billId, documentIds: selected.documents.map((document) => document.id) }
      ])
    }
    for (const [toolName, input] of requests) {
      await capture(toolName, input)
    }
  }
  for (const id of reviewMaterialIds) {
    if (!dataset.captures.some((item) => item.toolName === "get_supporting_material" && item.input.id === id)) {
      await capture("get_supporting_material", { id })
    }
  }
  for (const id of reviewMeetingIds) {
    if (!dataset.captures.some((item) => item.toolName === "get_event" && item.input.id === id)) {
      await capture("get_event", { id })
    }
  }
  const detailTools: Record<string, string> = {
    bill: "get_bill",
    amendment: "get_amendment",
    document: "get_bill_text",
    person: "get_person",
    organization: "get_organization",
    meeting: "get_event",
    vote: "get_vote",
    material: "get_supporting_material"
  }
  const records = new Map(
    dataset.captures.flatMap((capture) => capture.output.resultSet?.items ?? []).map((record) => [record.id, record])
  )
  for (const record of records.values()) {
    const toolName = detailTools[record.kind]
    const hasDetail = dataset.captures.some(
      (item) => item.toolName === toolName && item.output.resultSet?.items.some((item) => item.id === record.id)
    )
    if (toolName && !hasDetail) {
      if (record.kind === "document") {
        invariant(record.documentSummary?.billId, `Missing bill identity for ${record.id}`)
        await capture(toolName, { id: record.documentSummary.billId, documentId: record.id })
      } else {
        const input: Record<string, string | number> = { id: record.id }
        await capture(toolName, input)
      }
    }
  }
  const validated = reviewDatasetSchema.parse(redactCredentials(dataset))
  await mkdir(new URL(".", destination), { recursive: true })
  await writeFile(destination, `${JSON.stringify(validated, null, 2)}\n`)
  process.stdout.write(
    JSON.stringify({
      capturedAt: validated.capturedAt,
      tools: validated.captures.length,
      kinds: [
        ...new Set(
          validated.captures.flatMap((capture) => capture.output.resultSet?.items.map((record) => record.kind) ?? [])
        )
      ],
      failures: validated.failures
    }) + "\n"
  )
} finally {
  await connection.pool.end()
}
