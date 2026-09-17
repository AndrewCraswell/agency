import { and, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm"
import type { LegislationDatabase } from "../database/database"
import {
  amendments,
  billDocuments,
  bills,
  legislativeEvents,
  organizations,
  people,
  personAliases,
  supportingMaterials,
  votes
} from "../database/schema/schema"
import { LegislationError } from "../domain/errors"
import { recordResolutionSchema, type RecordResolutionInput } from "./record-contracts"

export function normalizedRecordIdentifier(value: string): string {
  return value
    .normalize("NFKC")
    .replaceAll(/[.\s-]/g, "")
    .toUpperCase()
}

export function publishedNameMatches(column: SQLWrapper, value: string): SQL<boolean> {
  const tokens = (value.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? []).sort()
  if (tokens.length === 0) return sql`false`
  return sql`array(select token from regexp_split_to_table(lower(${column}), '[^[:alnum:]]+') as token where token <> '' order by token) = ${sql.param(tokens)}::text[]`
}

export async function resolveRecord(database: LegislationDatabase, value: RecordResolutionInput) {
  const input = recordResolutionSchema.parse(value)
  const descriptors = {
    bill: {
      table: bills,
      id: bills.id,
      title: bills.title,
      sourceUrl: bills.sourceUrl,
      jurisdiction: bills.jurisdictionId,
      session: bills.sessionId,
      identifier: bills.identifier
    },
    amendment: {
      table: amendments,
      id: amendments.id,
      title: amendments.purpose,
      sourceUrl: amendments.sourceUrl,
      jurisdiction: amendments.jurisdictionId,
      session: amendments.sessionId,
      identifier: amendments.printedIdentifier
    },
    person: {
      table: people,
      id: people.id,
      title: people.name,
      sourceUrl: people.sourceUrl,
      jurisdiction: people.jurisdictionId
    },
    organization: {
      table: organizations,
      id: organizations.id,
      title: organizations.name,
      sourceUrl: organizations.sourceUrl,
      jurisdiction: organizations.jurisdictionId
    },
    meeting: {
      table: legislativeEvents,
      id: legislativeEvents.id,
      title: legislativeEvents.name,
      sourceUrl: legislativeEvents.sourceUrl,
      jurisdiction: legislativeEvents.jurisdictionId
    },
    vote: {
      table: votes,
      id: votes.id,
      title: votes.motion,
      sourceUrl: votes.sourceUrl,
      session: votes.sessionId,
      identifier: votes.rollCallNumber
    },
    document: {
      table: billDocuments,
      id: billDocuments.id,
      title: billDocuments.title,
      sourceUrl: billDocuments.sourceUrl
    },
    material: {
      table: supportingMaterials,
      id: supportingMaterials.id,
      title: supportingMaterials.title,
      sourceUrl: supportingMaterials.sourceUrl,
      jurisdiction: supportingMaterials.jurisdictionId
    }
  }
  const descriptor = descriptors[input.kind]
  const filters: SQL[] = []
  if (input.id) filters.push(eq(descriptor.id, input.id))
  if (input.name) {
    const nameMatch = publishedNameMatches(descriptor.title, input.name)
    if (input.kind === "person") {
      filters.push(
        sql`(${nameMatch} or exists (select 1 from ${personAliases} where ${personAliases.personId} = ${people.id} and ${personAliases.provenanceComplete} = true and ${publishedNameMatches(personAliases.name, input.name)}))`
      )
    } else filters.push(nameMatch)
  }
  if (input.kind === "organization") {
    filters.push(
      sql`case when ${organizations.jurisdictionId} = 'jurisdiction:us' and ${organizations.classification} in ('committee', 'subcommittee') then ${organizations.sourceProvider} = 'govinfo' else true end`
    )
  }
  if (input.sourceUrl) filters.push(eq(descriptor.sourceUrl, input.sourceUrl))
  if (input.jurisdictionId && "jurisdiction" in descriptor)
    filters.push(eq(descriptor.jurisdiction, input.jurisdictionId))
  if (input.sessionId && "session" in descriptor) filters.push(eq(descriptor.session, input.sessionId))
  if (input.organizationId) filters.push(eq(votes.organizationId, input.organizationId))
  if (input.chamber) filters.push(eq(votes.chamber, input.chamber))
  if (input.identifier && "identifier" in descriptor) {
    const identifier = normalizedRecordIdentifier(input.identifier)
    if (!/^[A-Z]*\d+[A-Z]?$/.test(identifier)) {
      throw new LegislationError(
        "invalid_request",
        "Use only the record type and number as identifier; select jurisdiction and session separately."
      )
    }
    const billNumber = /^([A-Z]+)(\d+[A-Z]?)$/.exec(identifier)
    if ((input.kind === "bill" || input.kind === "amendment") && input.sessionId && billNumber) {
      filters.push(
        eq(
          descriptor.id,
          `${input.kind}:${input.sessionId.slice("session:".length)}:${billNumber[1]!.toLowerCase()}:${billNumber[2]!.toLowerCase().replace(/^0+(?=\d)/, "")}`
        )
      )
    } else {
      filters.push(sql`regexp_replace(upper(${descriptor.identifier}), '[.[:space:]-]', '', 'g') = ${identifier}`)
    }
  }
  const rows = await database
    .select({
      id: descriptor.id,
      name: descriptor.title,
      sourceUrl: descriptor.sourceUrl,
      jurisdictionId: "jurisdiction" in descriptor ? descriptor.jurisdiction : sql<string | null>`null`,
      sessionId: "session" in descriptor ? descriptor.session : sql<string | null>`null`
    })
    .from(descriptor.table)
    .where(and(...filters))
    .orderBy(descriptor.id)
    .limit(11)
  let status: "resolved" | "ambiguous" | "not-found" = "not-found"
  if (rows.length === 1) status = "resolved"
  else if (rows.length > 1) status = "ambiguous"
  return { status, kind: input.kind, matches: rows.slice(0, 10), truncated: rows.length > 10 }
}
