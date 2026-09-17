import * as schema from "@repo/legislation-core/database/schema/schema"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { getTableColumns, getTableName } from "drizzle-orm"
import { getTableConfig, type AnyPgTable } from "drizzle-orm/pg-core"

type Relation = { dataset: string; columns: string[]; targetColumns: string[]; many: boolean }
export type AnalyticsDataset = {
  table: AnyPgTable
  fields: Record<string, { column: string; type: string }>
  keys: string[]
  relations: Record<string, Relation>
}

function dataset(table: AnyPgTable, names: string): AnalyticsDataset {
  const columns = getTableColumns(table)
  const config = getTableConfig(table)
  const keys = [
    ...config.columns.filter((column) => column.primary),
    ...config.primaryKeys.flatMap((key) => key.columns)
  ]
  const fields: AnalyticsDataset["fields"] = {}
  for (const name of names.split(" ")) {
    const column = columns[name]
    if (!column) throw new Error(`Unknown analytics column ${getTableName(table)}.${name}`)
    fields[name] = { column: column.name, type: column.dataType }
  }
  return { table, fields, keys: keys.map((column) => column.name), relations: {} }
}

export const analyticsDatasets: Readonly<Record<string, AnalyticsDataset>> = {
  jurisdictions: dataset(schema.jurisdictions, "id name classification countryCode subdivisionCode isActive sourceUrl"),
  sessions: dataset(
    schema.legislativeSessions,
    "id jurisdictionId identifier name classification startDate endDate isActive sourceUrl"
  ),
  bills: dataset(
    schema.bills,
    "id jurisdictionId sessionId identifier title classification status subjects chamber introducedAt sourceUrl"
  ),
  sponsorships: dataset(schema.billSponsors, "id billId personId name classification isPrimary sourceUrl"),
  people: dataset(
    schema.people,
    "id jurisdictionId name givenName familyName party isActive inOfficeSinceYear sourceUrl"
  ),
  terms: dataset(
    schema.legislativeTerms,
    "id personId jurisdictionId organizationId chamber district party role officeTitle startDate endDate startYear endYear isActive sourceUrl"
  ),
  organizations: dataset(
    schema.organizations,
    "id jurisdictionId parentOrganizationId name classification chamber isActive membershipRelationsComplete childRelationsComplete sourceUrl"
  ),
  memberships: dataset(
    schema.organizationMemberships,
    "id organizationId personId legislativeSessionId role label title classification effectiveStartDate effectiveEndDate detectedStartDate detectedEndDate lastObservedDate endedReason isActive sourceUrl"
  ),
  actions: dataset(
    schema.billActions,
    "id billId ordinal description classification actionDate actionAt chamber organizationId sourceUrl"
  ),
  committeeBills: dataset(schema.billOrganizations, "billId organizationId classification sourceName"),
  amendments: dataset(
    schema.amendments,
    "id jurisdictionId sessionId billId sponsorPersonId printedIdentifier amendmentType amendmentNumber chamber status sponsorName submittedDate sourceUrl"
  ),
  amendmentActions: dataset(
    schema.amendmentActions,
    "id amendmentId ordinal description classification actionDate actionAt sourceUrl"
  ),
  amendmentRelations: dataset(schema.amendmentRelations, "amendmentId relatedAmendmentId classification"),
  votes: dataset(
    schema.votes,
    "id billId amendmentId eventId organizationId sessionId chamber classification rollCallNumber voteType question motion result heldDate heldAt yesCount noCount absentCount abstainCount notVotingCount presentCount sourceUrl timelineComplete"
  ),
  positions: dataset(schema.votePositions, "voteId personId sourceIdentity sourcePersonId sourceName option"),
  relatedBills: dataset(schema.billRelations, "billId relatedBillId classification"),
  meetings: dataset(
    schema.legislativeEvents,
    "id jurisdictionId name classification status startAt endAt publisherLocalDate isRemote canonicalFactsComplete sessionRelationsComplete organizationRelationsComplete sourceUrl"
  ),
  meetingSessions: dataset(schema.eventSessions, "eventId sessionId"),
  meetingOrganizations: dataset(schema.eventOrganizations, "eventId organizationId"),
  participants: dataset(schema.eventParticipants, "id eventId personId organizationId name role"),
  meetingBills: dataset(schema.eventBills, "eventId billId classification"),
  meetingDocuments: dataset(
    schema.eventDocuments,
    "id eventId title classification documentDate contentType sourceUrl"
  ),
  agenda: dataset(
    schema.eventAgendaItems,
    "id eventId ordinal title status classification organizationId documentId canonicalFactsComplete billRelationsComplete amendmentRelationsComplete materialRelationsComplete"
  ),
  agendaBills: dataset(schema.eventAgendaItemBills, "agendaItemId billId"),
  agendaAmendments: dataset(schema.eventAgendaItemAmendments, "agendaItemId amendmentId"),
  agendaMaterials: dataset(schema.eventAgendaItemSupportingMaterials, "agendaItemId materialId"),
  documents: dataset(
    schema.billDocuments,
    "id billId title classification versionCode documentDate sourceUrl contentType"
  ),
  materials: dataset(schema.supportingMaterials, "id jurisdictionId title classification sourceUrl"),
  materialLinks: dataset(schema.supportingMaterialLinks, "materialId billId amendmentId eventId"),
  changes: dataset(
    schema.changeEvents,
    "id recordType recordId changeType jurisdictionId organizationId personId observedAt sourceUrl"
  )
}

for (const [name, source] of Object.entries(analyticsDatasets)) {
  for (const foreignKey of getTableConfig(source.table).foreignKeys) {
    const reference = foreignKey.reference()
    const targetEntry = Object.entries(analyticsDatasets).find(
      ([, candidate]) => candidate.table === reference.foreignTable
    )
    if (!targetEntry) continue
    const [targetName, target] = targetEntry
    const lastColumn = reference.columns.at(-1)
    const property = Object.entries(getTableColumns(source.table)).find(
      ([, column]) => column.name === lastColumn?.name
    )?.[0]
    if (!property) throw new Error(`Missing relationship key for ${name}`)
    const relationName = property.replace(/Id$/, "")
    const columns = reference.columns.map((column) => column.name)
    const targetColumns = reference.foreignColumns.map((column) => column.name)
    source.relations[relationName] = { dataset: targetName, columns, targetColumns, many: false }
    const parallelKeys = getTableConfig(source.table).foreignKeys.filter(
      (key) => key.reference().foreignTable === target.table
    )
    const reverseName = parallelKeys.length > 1 ? `${name}_${relationName}` : name
    target.relations[reverseName] = { dataset: name, columns: targetColumns, targetColumns: columns, many: true }
  }
}

export function analyticsDataset(name: string) {
  if (!Object.hasOwn(analyticsDatasets, name))
    throw new LegislationError("invalid_request", `Unknown analytics dataset: ${name}`)
  const result = analyticsDatasets[name]
  if (!result) throw new LegislationError("invalid_request", "Unknown analytics dataset")
  return result
}

export const analyticsRules = [
  "Scope follows the fact named in the question, not the displayed group: 'bills with the most amendments from the 119th Congress' filters amendments.sessionId, even when selecting bill.id/title. 'Amendments linked to 119th-Congress bills' instead filters bill.sessionId. Those predicates are not interchangeable.",
  "For named sponsors, resolve the person and filter sponsorships.personId (or person.id), never sponsorships.name. Source labels can differ from the canonical person's published name. A source-name mismatch must not become a zero activity claim.",
  "A rate of distinct recorded votes uses voteId for BOTH counts, even when the denominator is described as recorded positions rather than eligibility. Use _key only when the requested unit is position records or position identities, not distinct votes.",
  "A successful empty result is not a timeout. Answer the exact requested relationship with its coverage caveat; do not replace amendment-classified documents with amendment-text supporting materials, or replace another empty relationship with a different source. A failed later diagnostic does not invalidate an earlier successful exact query.",
  "Keep null grouping values unless the question explicitly excludes unknowns. Do not add notNull filters to make results look cleaner. For rankings include zero recorded relationships unless the question requires a relationship, a positive count or a minimum threshold.",
  "Deleted meetings are already excluded on every meeting join. Do not invent status=deleted or status!=deleted. These are query receipts, not citation snapshots; never construct citation anchors from queryId or queryHash.",
  "Honor the exact requested population, columns, ordering and count grain. Canonical ID means id (bill:...), not identifier (HR 1). Include IDs when requested even if another label seems friendlier.",
  "For position-record counts use positions._key (voteId plus sourceIdentity). personId counts distinct people, voteId counts distinct votes, and neither counts position records. Never exclude unresolved people unless requested or grouping resolved people.",
  "Explicit absence means option=absent, explicit abstention means option=abstain, and not-voting means option=not-voting. Do not substitute one for another even if the requested category has zero recorded rows. Zero numerator still returns every denominator-qualified group.",
  "Paths follow relations using dots, for example sponsorships: person.name, bill.sessionId. Request dataset details before guessing paths.",
  "_key is the distinct identity of a record or composite relationship. Use countDistinct, never count joined rows. min/max ignore nulls.",
  "select fields become grouping keys when metrics are supplied; otherwise rows are distinct projections. Include canonical IDs alongside names.",
  "Filters are ANDed; in values express OR. contains means literal case-insensitive substring for strings and element membership for arrays.",
  "Metric filters affect only that count; request numerator and denominator metrics and a rate to calculate a percentage. Denominator zero yields null.",
  "All results describe locally recorded data, not complete upstream coverage. Missing links are unknown; isNull does not prove no relationship exists.",
  "Sponsorship isPrimary distinguishes primary sponsors from cosponsors. abstain, absent, not-voting and present are distinct vote options.",
  "Structured amendments and amendment documents are different grains. People.party is current recorded party, not necessarily party at a historical vote.",
  "Use explicit session/jurisdiction filters. Resolve current session and ambiguous person identity with existing discovery tools; do not infer unknown isActive.",
  "max/min dates describe recorded endpoints, not continuous service or elapsed legislative time. Observation dates are not effective dates.",
  "Ranks use the full filtered population before limiting. Equal metric values are ties even when the output limit cuts a tie. nulls sort last.",
  "No arbitrary SQL or legal/account/ingestion/search-index data is exposed. Deleted meetings are excluded. Maximum relationship depth is 4 and join count is 8."
]

export function describeAnalytics(names?: string[]) {
  return {
    rules: analyticsRules,
    datasets: Object.keys(analyticsDatasets),
    details: (names ?? Object.keys(analyticsDatasets)).map((name) => {
      const entry = analyticsDataset(name)
      return {
        name,
        fieldDescriptions: {
          ...(entry.fields.sessionId
            ? {
                sessionId: `Session of the ${name} record itself, not of a related record. An adjective on another entity must filter that entity's session instead.`
              }
            : {}),
          ...(name === "sponsorships"
            ? {
                name: "Exact published sponsor label on the sponsorship record, including any source-supplied title, party and district. Select this for published sponsor name; person.name is a different canonical profile field.",
                "person.name": "Canonical person-profile name. Not the published sponsorship label.",
                "bill.sessionId": "Session of the sponsored bill."
              }
            : {}),
          ...(name === "amendments"
            ? {
                "bill.sessionId":
                  "Session of the parent bill. Use for 119th-Congress bills and most-amended 119th-Congress bills, even when starting from amendments. Leave this record's sessionId unfiltered unless amendment session is independently requested."
              }
            : {}),
          ...(name === "bills"
            ? {
                sessionId:
                  "Session of the bill. Use for most-amended 119th-Congress bills: scope these bills, then count amendments without adding an amendment-session restriction.",
                "documents.classification":
                  "Classification of a real document record. To count documents by classification, start from documents and scope bill.sessionId; a bill with no documents is not a null-classified document."
              }
            : {})
        },
        fields: {
          _key: "identity",
          ...Object.fromEntries(Object.entries(entry.fields).map(([field, value]) => [field, value.type]))
        },
        relations: Object.fromEntries(
          Object.entries(entry.relations).map(([relation, value]) => [
            relation,
            { dataset: value.dataset, many: value.many }
          ])
        )
      }
    })
  }
}
