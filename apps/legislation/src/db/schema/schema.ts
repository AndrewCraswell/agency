import { sql } from "drizzle-orm"
import {
  boolean,
  type AnyPgColumn,
  char,
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector
} from "drizzle-orm/pg-core"

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector"
})

export const legislationSchema = pgSchema("legislation")

export const jurisdictions = legislationSchema.table(
  "jurisdictions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    classification: text("classification").notNull(),
    countryCode: char("country_code", { length: 2 }).notNull(),
    subdivisionCode: text("subdivision_code"),
    /** Source-declared IANA zone. Null remains an explicit unknown, never a geographic guess. */
    timezone: text("timezone"),
    /** Null means no authoritative source has stated the jurisdiction's active state. */
    isActive: boolean("is_active"),
    sourceUrl: text("source_url"),
    sourceProvider: text("source_provider"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }),
    sourceIsOfficial: boolean("source_is_official"),
    provenanceComplete: boolean("provenance_complete").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("jurisdictions_id_check", sql`length(${table.id}) > 0`),
    check("jurisdictions_name_check", sql`length(${table.name}) > 0`),
    check(
      "jurisdictions_classification_check",
      sql`${table.classification} in ('country', 'state', 'district', 'territory')`
    ),
    check("jurisdictions_country_code_check", sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
    check("jurisdictions_timezone_check", sql`${table.timezone} is null or length(${table.timezone}) > 0`),
    check(
      "jurisdictions_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} ~ '^https://' and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    uniqueIndex("jurisdictions_subdivision_uidx")
      .on(table.countryCode, table.subdivisionCode)
      .where(sql`${table.subdivisionCode} is not null`),
    index("jurisdictions_foundation_incomplete_idx")
      .on(table.id)
      .where(sql`not ${table.provenanceComplete}`)
  ]
)

export const legislativeSessions = legislationSchema.table(
  "legislative_sessions",
  {
    id: text("id").primaryKey(),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id, { onDelete: "restrict" }),
    identifier: text("identifier").notNull(),
    name: text("name").notNull(),
    /** Publisher session classification. Null means the source has not supplied one. */
    classification: text("classification"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    /** Null means the source has not supplied a session active state. */
    isActive: boolean("is_active"),
    sourceUrl: text("source_url"),
    sourceProvider: text("source_provider"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }),
    sourceIsOfficial: boolean("source_is_official"),
    provenanceComplete: boolean("provenance_complete").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("legislative_sessions_id_check", sql`length(${table.id}) > 0`),
    check("legislative_sessions_identifier_check", sql`length(${table.identifier}) > 0`),
    check(
      "legislative_sessions_classification_check",
      sql`${table.classification} is null or length(${table.classification}) > 0`
    ),
    check(
      "legislative_sessions_dates_check",
      sql`${table.startDate} is null or ${table.endDate} is null or ${table.startDate} <= ${table.endDate}`
    ),
    check(
      "legislative_sessions_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} ~ '^https://' and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    uniqueIndex("legislative_sessions_identifier_uidx").on(table.jurisdictionId, table.identifier),
    uniqueIndex("legislative_sessions_jurisdiction_id_uidx").on(table.jurisdictionId, table.id),
    index("legislative_sessions_foundation_incomplete_idx")
      .on(table.id)
      .where(sql`not ${table.provenanceComplete}`)
  ]
)

export const bills = legislationSchema.table(
  "bills",
  {
    id: text("id").primaryKey(),
    jurisdictionId: text("jurisdiction_id").notNull(),
    sessionId: text("session_id").notNull(),
    identifier: text("identifier").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    classification: text("classification")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: text("status"),
    committees: text("committees")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    subjects: text("subjects")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    chamber: text("chamber"),
    introducedAt: date("introduced_at"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceUrl: text("source_url").notNull(),
    upstreamIds: jsonb("upstream_ids").$type<Record<string, string>>().notNull().default({}),
    searchVector: tsvector("search_vector"),
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingInputHash: char("embedding_input_hash", { length: 64 }),
    embeddingModel: text("embedding_model"),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("bills_embedding_shard_idx").on(sql`(((hashtextextended(${table.id}, 0) % 200) + 200) % 200)`, table.id),
    foreignKey({
      columns: [table.jurisdictionId, table.sessionId],
      foreignColumns: [legislativeSessions.jurisdictionId, legislativeSessions.id],
      name: "bills_session_fk"
    }).onDelete("restrict"),
    check("bills_id_check", sql`${table.id} ~ '^bill:[a-z0-9-]+:[^:]+:[a-z0-9-]+:[a-z0-9-]+$'`),
    check("bills_identifier_check", sql`length(${table.identifier}) > 0`),
    check("bills_title_check", sql`length(${table.title}) > 0`),
    uniqueIndex("bills_identifier_uidx").on(table.jurisdictionId, table.sessionId, table.identifier),
    index("bills_status_idx").on(table.jurisdictionId, table.sessionId, table.status),
    index("bills_introduced_idx").on(table.jurisdictionId, table.introducedAt),
    index("bills_classification_gin_idx").using("gin", table.classification),
    index("bills_subjects_gin_idx").using("gin", table.subjects),
    index("bills_search_vector_gin_idx").using("gin", table.searchVector),
    index("bills_embedding_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ]
)

export const billActions = legislationSchema.table(
  "bill_actions",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    description: text("description").notNull(),
    classification: text("classification")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    actionDate: date("action_date"),
    actionAt: timestamp("action_at", { withTimezone: true }),
    chamber: text("chamber"),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    sourceOrganizationId: text("source_organization_id"),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("bill_actions_ordinal_check", sql`${table.ordinal} >= 0`),
    check("bill_actions_description_check", sql`length(${table.description}) > 0`),
    uniqueIndex("bill_actions_ordinal_uidx").on(table.billId, table.ordinal),
    index("bill_actions_timeline_idx").on(table.billId, table.actionDate, table.ordinal),
    index("bill_actions_organization_idx").on(table.organizationId, table.actionDate)
  ]
)

export const people = legislationSchema.table(
  "people",
  {
    id: text("id").primaryKey(),
    jurisdictionId: text("jurisdiction_id").references(() => jurisdictions.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    givenName: text("given_name"),
    familyName: text("family_name"),
    party: text("party"),
    sourceId: text("source_id"),
    sourceUrl: text("source_url"),
    sourceProvider: text("source_provider"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }),
    sourceIsOfficial: boolean("source_is_official"),
    provenanceComplete: boolean("provenance_complete").notNull().default(false),
    isActive: boolean("is_active"),
    upstreamIds: jsonb("upstream_ids").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("people_name_check", sql`length(${table.name}) > 0`),
    check("people_source_id_check", sql`${table.sourceId} is null or length(${table.sourceId}) > 0`),
    check(
      "people_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    uniqueIndex("people_jurisdiction_source_uidx")
      .on(table.jurisdictionId, table.sourceId)
      .where(sql`${table.jurisdictionId} is not null and ${table.sourceId} is not null`)
  ]
)

export const organizations = legislationSchema.table(
  "organizations",
  {
    id: text("id").primaryKey(),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id, { onDelete: "restrict" }),
    parentOrganizationId: text("parent_organization_id").references((): AnyPgColumn => organizations.id, {
      onDelete: "restrict"
    }),
    sourceId: text("source_id").notNull(),
    name: text("name").notNull(),
    /** Null remains an explicit source classification gap; no local category is invented. */
    classification: text("classification"),
    /** Canonical chamber vocabulary. Null means the provider value was not safely mappable. */
    chamber: text("chamber"),
    isActive: boolean("is_active"),
    sourceUrl: text("source_url"),
    sourceProvider: text("source_provider"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }),
    sourceIsOfficial: boolean("source_is_official"),
    provenanceComplete: boolean("provenance_complete").notNull().default(false),
    upstreamIds: jsonb("upstream_ids").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("organizations_id_check", sql`length(${table.id}) > 0`),
    check("organizations_source_id_check", sql`length(${table.sourceId}) > 0`),
    check("organizations_name_check", sql`length(${table.name}) > 0`),
    check(
      "organizations_classification_check",
      sql`${table.classification} is null or ${table.classification} in ('legislature', 'chamber', 'committee', 'subcommittee', 'commission', 'agency', 'other')`
    ),
    check(
      "organizations_chamber_check",
      sql`${table.chamber} is null or ${table.chamber} in ('lower', 'upper', 'unicameral', 'legislature')`
    ),
    check(
      "organizations_parent_check",
      sql`${table.parentOrganizationId} is null or ${table.parentOrganizationId} <> ${table.id}`
    ),
    check(
      "organizations_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    uniqueIndex("organizations_jurisdiction_source_uidx").on(table.jurisdictionId, table.sourceId),
    index("organizations_parent_idx").on(table.parentOrganizationId),
    index("organizations_jurisdiction_classification_idx").on(table.jurisdictionId, table.classification, table.chamber)
  ]
)

export const legislativeTerms = legislationSchema.table(
  "legislative_terms",
  {
    id: text("id").primaryKey(),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id, { onDelete: "restrict" }),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
    sourceId: text("source_id"),
    /** Null remains an explicit unknown when a provider chamber cannot be mapped safely. */
    chamber: text("chamber"),
    district: text("district"),
    party: text("party"),
    role: text("role"),
    /** Authoritative office title. Legacy role strings are not substituted for this fact. */
    officeTitle: text("office_title"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    isActive: boolean("is_active"),
    sourceUrl: text("source_url"),
    sourceProvider: text("source_provider"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }),
    sourceIsOfficial: boolean("source_is_official"),
    provenanceComplete: boolean("provenance_complete").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("legislative_terms_id_check", sql`length(${table.id}) > 0`),
    check("legislative_terms_chamber_check", sql`length(${table.chamber}) > 0`),
    check(
      "legislative_terms_dates_check",
      sql`${table.startDate} is null or ${table.endDate} is null or ${table.startDate} <= ${table.endDate}`
    ),
    check(
      "legislative_terms_chamber_vocabulary_check",
      sql`${table.chamber} is null or ${table.chamber} in ('lower', 'upper', 'unicameral', 'legislature')`
    ),
    check(
      "legislative_terms_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    uniqueIndex("legislative_terms_person_source_uidx")
      .on(table.personId, table.sourceId)
      .where(sql`${table.sourceId} is not null`),
    index("legislative_terms_person_dates_idx").on(table.personId, table.startDate, table.endDate),
    index("legislative_terms_jurisdiction_chamber_idx").on(table.jurisdictionId, table.chamber, table.district)
  ]
)

export const organizationMemberships = legislationSchema.table(
  "organization_memberships",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    sourceId: text("source_id"),
    /** Canonical membership role. Null is incomplete, not a fallback to legacy fields. */
    role: text("role"),
    /** Source-supplied public label, kept distinct from the canonical role. */
    label: text("label"),
    title: text("title"),
    rank: text("rank"),
    classification: text("classification"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    isActive: boolean("is_active"),
    sourceUrl: text("source_url"),
    sourceProvider: text("source_provider"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }),
    sourceIsOfficial: boolean("source_is_official"),
    provenanceComplete: boolean("provenance_complete").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("organization_memberships_id_check", sql`length(${table.id}) > 0`),
    check(
      "organization_memberships_dates_check",
      sql`${table.startDate} is null or ${table.endDate} is null or ${table.startDate} <= ${table.endDate}`
    ),
    check(
      "organization_memberships_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    uniqueIndex("organization_memberships_source_uidx")
      .on(table.organizationId, table.sourceId)
      .where(sql`${table.sourceId} is not null`),
    index("organization_memberships_person_idx").on(table.personId, table.startDate, table.endDate),
    index("organization_memberships_organization_idx").on(table.organizationId, table.isActive)
  ]
)

export const legislativeEvents = legislationSchema.table(
  "legislative_events",
  {
    id: text("id").primaryKey(),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id, { onDelete: "restrict" }),
    sourceId: text("source_id").notNull(),
    name: text("name").notNull(),
    classification: text("classification"),
    status: text("status").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    timezone: text("timezone"),
    allDay: boolean("all_day").notNull().default(false),
    location: jsonb("location").$type<Record<string, unknown>>(),
    virtualAccess: jsonb("virtual_access").$type<Record<string, unknown>>(),
    description: text("description"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    sourceUrl: text("source_url"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    upstreamIds: jsonb("upstream_ids").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("legislative_events_id_check", sql`length(${table.id}) > 0`),
    check("legislative_events_source_id_check", sql`length(${table.sourceId}) > 0`),
    check("legislative_events_name_check", sql`length(${table.name}) > 0`),
    check("legislative_events_status_check", sql`length(${table.status}) > 0`),
    check("legislative_events_dates_check", sql`${table.endAt} is null or ${table.startAt} <= ${table.endAt}`),
    uniqueIndex("legislative_events_jurisdiction_source_uidx").on(table.jurisdictionId, table.sourceId),
    index("legislative_events_schedule_idx").on(table.jurisdictionId, table.startAt, table.status),
    index("legislative_events_deleted_idx").on(table.jurisdictionId, table.isDeleted, table.startAt)
  ]
)

export const eventParticipants = legislationSchema.table(
  "event_participants",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => legislativeEvents.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => people.id, { onDelete: "restrict" }),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("event_participants_name_check", sql`length(${table.name}) > 0`),
    check(
      "event_participants_target_check",
      sql`${table.personId} is not null or ${table.organizationId} is not null or length(${table.name}) > 0`
    ),
    index("event_participants_event_idx").on(table.eventId, table.role),
    index("event_participants_person_idx").on(table.personId, table.eventId),
    index("event_participants_organization_idx").on(table.organizationId, table.eventId)
  ]
)

export const eventBills = legislationSchema.table(
  "event_bills",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => legislativeEvents.id, { onDelete: "cascade" }),
    billId: text("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    classification: text("classification").notNull().default("related")
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.billId, table.classification] }),
    index("event_bills_bill_idx").on(table.billId, table.eventId)
  ]
)

export const eventDocuments = legislationSchema.table(
  "event_documents",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => legislativeEvents.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    classification: text("classification"),
    sourceUrl: text("source_url").notNull(),
    documentDate: date("document_date"),
    contentType: text("content_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("event_documents_title_check", sql`length(${table.title}) > 0`),
    check("event_documents_source_url_check", sql`length(${table.sourceUrl}) > 0`),
    uniqueIndex("event_documents_source_uidx").on(table.eventId, table.sourceUrl)
  ]
)

export const eventAgendaItems = legislationSchema.table(
  "event_agenda_items",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => legislativeEvents.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    description: text("description").notNull(),
    classification: text("classification"),
    billId: text("bill_id").references(() => bills.id, { onDelete: "restrict" }),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
    documentId: text("document_id").references(() => eventDocuments.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("event_agenda_items_ordinal_check", sql`${table.ordinal} >= 0`),
    check("event_agenda_items_description_check", sql`length(${table.description}) > 0`),
    uniqueIndex("event_agenda_items_ordinal_uidx").on(table.eventId, table.ordinal),
    index("event_agenda_items_bill_idx").on(table.billId, table.eventId)
  ]
)

export const eventContinuations = legislationSchema.table(
  "event_continuations",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => legislativeEvents.id, { onDelete: "cascade" }),
    continuationEventId: text("continuation_event_id").references((): AnyPgColumn => legislativeEvents.id, {
      onDelete: "set null"
    }),
    continuationAt: timestamp("continuation_at", { withTimezone: true }),
    sourceId: text("source_id").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.sourceId] }),
    check("event_continuations_source_id_check", sql`length(${table.sourceId}) > 0`),
    check(
      "event_continuations_distinct_check",
      sql`${table.continuationEventId} is null or ${table.eventId} <> ${table.continuationEventId}`
    )
  ]
)

export const calendarEntries = legislationSchema.table(
  "calendar_entries",
  {
    id: text("id").primaryKey(),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id, { onDelete: "restrict" }),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
    sessionId: text("session_id").references(() => legislativeSessions.id, { onDelete: "restrict" }),
    sourceId: text("source_id").notNull(),
    title: text("title").notNull(),
    classification: text("classification"),
    status: text("status"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    timezone: text("timezone"),
    description: text("description"),
    sourceUrl: text("source_url"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("calendar_entries_source_id_check", sql`length(${table.sourceId}) > 0`),
    check("calendar_entries_title_check", sql`length(${table.title}) > 0`),
    check("calendar_entries_dates_check", sql`${table.endAt} is null or ${table.startAt} <= ${table.endAt}`),
    uniqueIndex("calendar_entries_jurisdiction_source_uidx").on(table.jurisdictionId, table.sourceId),
    index("calendar_entries_schedule_idx").on(table.jurisdictionId, table.startAt, table.organizationId)
  ]
)

export const billSponsors = legislationSchema.table(
  "bill_sponsors",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => people.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    classification: text("classification").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("bill_sponsors_name_check", sql`length(${table.name}) > 0`),
    uniqueIndex("bill_sponsors_person_uidx")
      .on(table.billId, table.personId, table.classification)
      .where(sql`${table.personId} is not null`),
    index("bill_sponsors_bill_idx").on(table.billId, table.isPrimary)
  ]
)

export const billOrganizations = legislationSchema.table(
  "bill_organizations",
  {
    billId: text("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    classification: text("classification").notNull(),
    sourceName: text("source_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.billId, table.organizationId, table.classification] }),
    check("bill_organizations_classification_check", sql`length(${table.classification}) > 0`),
    index("bill_organizations_organization_idx").on(table.organizationId, table.billId)
  ]
)

export const amendments = legislationSchema.table(
  "amendments",
  {
    id: text("id").primaryKey(),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id, { onDelete: "restrict" }),
    sessionId: text("session_id").references(() => legislativeSessions.id, { onDelete: "restrict" }),
    billId: text("bill_id").references(() => bills.id, { onDelete: "set null" }),
    sponsorPersonId: text("sponsor_person_id").references(() => people.id, { onDelete: "restrict" }),
    sourceId: text("source_id").notNull(),
    printedIdentifier: text("printed_identifier").notNull(),
    amendmentType: text("amendment_type").notNull(),
    amendmentNumber: text("amendment_number").notNull(),
    chamber: text("chamber"),
    purpose: text("purpose"),
    description: text("description"),
    status: text("status"),
    sponsorName: text("sponsor_name"),
    sponsorSourceId: text("sponsor_source_id"),
    submittedDate: date("submitted_date"),
    sourceUrl: text("source_url").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    upstreamIds: jsonb("upstream_ids").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("amendments_embedding_shard_idx").on(sql`(((hashtextextended(${table.id}, 0) % 200) + 200) % 200)`, table.id),
    check("amendments_id_check", sql`length(${table.id}) > 0`),
    check("amendments_source_id_check", sql`length(${table.sourceId}) > 0`),
    check("amendments_identifier_check", sql`length(${table.printedIdentifier}) > 0`),
    check("amendments_type_check", sql`length(${table.amendmentType}) > 0`),
    check("amendments_number_check", sql`length(${table.amendmentNumber}) > 0`),
    uniqueIndex("amendments_jurisdiction_source_uidx").on(table.jurisdictionId, table.sourceId),
    index("amendments_bill_idx").on(table.billId, table.submittedDate),
    index("amendments_sponsor_idx").on(table.sponsorPersonId, table.submittedDate),
    index("amendments_session_idx").on(table.sessionId, table.chamber, table.submittedDate)
  ]
)

export const amendmentActions = legislationSchema.table(
  "amendment_actions",
  {
    id: text("id").primaryKey(),
    amendmentId: text("amendment_id")
      .notNull()
      .references(() => amendments.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    description: text("description").notNull(),
    classification: text("classification")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    actionDate: date("action_date"),
    actionAt: timestamp("action_at", { withTimezone: true }),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("amendment_actions_ordinal_check", sql`${table.ordinal} >= 0`),
    check("amendment_actions_description_check", sql`length(${table.description}) > 0`),
    uniqueIndex("amendment_actions_ordinal_uidx").on(table.amendmentId, table.ordinal)
  ]
)

export const amendmentRelations = legislationSchema.table(
  "amendment_relations",
  {
    amendmentId: text("amendment_id")
      .notNull()
      .references(() => amendments.id, { onDelete: "cascade" }),
    relatedAmendmentId: text("related_amendment_id")
      .notNull()
      .references((): AnyPgColumn => amendments.id, { onDelete: "cascade" }),
    classification: text("classification").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.amendmentId, table.relatedAmendmentId, table.classification] }),
    check("amendment_relations_distinct_check", sql`${table.amendmentId} <> ${table.relatedAmendmentId}`),
    index("amendment_relations_related_idx").on(table.relatedAmendmentId, table.classification)
  ]
)

export const supportingMaterials = legislationSchema.table(
  "supporting_materials",
  {
    id: text("id").primaryKey(),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id, { onDelete: "restrict" }),
    sourceId: text("source_id").notNull(),
    classification: text("classification").notNull(),
    title: text("title").notNull(),
    documentDate: date("document_date"),
    sourceUrl: text("source_url").notNull(),
    contentType: text("content_type"),
    blobPath: text("blob_path"),
    text: text("text"),
    contentHash: char("content_hash", { length: 64 }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    processingStatus: text("processing_status").notNull().default("pending"),
    processingAttempts: integer("processing_attempts").notNull().default(0),
    processingError: text("processing_error"),
    processingErrorCategory: text("processing_error_category"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("supporting_materials_source_id_check", sql`length(${table.sourceId}) > 0`),
    check("supporting_materials_classification_check", sql`length(${table.classification}) > 0`),
    check("supporting_materials_title_check", sql`length(${table.title}) > 0`),
    check(
      "supporting_materials_hash_check",
      sql`${table.contentHash} is null or ${table.contentHash} ~ '^[0-9a-f]{64}$'`
    ),
    check("supporting_materials_attempts_check", sql`${table.processingAttempts} >= 0`),
    check(
      "supporting_materials_error_category_check",
      sql`${table.processingErrorCategory} is null or ${table.processingErrorCategory} in ('download-permanent', 'download-transient', 'malformed-document', 'not-found', 'ocr-required', 'oversized', 'processing-transient', 'source-inaccessible', 'unsafe-url', 'unsupported-format')`
    ),
    check(
      "supporting_materials_processing_status_check",
      sql`${table.processingStatus} in ('pending', 'processing', 'processed', 'unsupported', 'failed')`
    ),
    uniqueIndex("supporting_materials_jurisdiction_source_uidx").on(table.jurisdictionId, table.sourceId),
    index("supporting_materials_processing_idx").on(table.processingStatus, table.updatedAt),
    index("supporting_materials_failed_retry_idx")
      .on(table.processingErrorCategory, table.nextAttemptAt, table.id)
      .where(sql`${table.processingStatus} = 'failed'`),
    index("supporting_materials_classification_idx").on(table.jurisdictionId, table.classification, table.documentDate)
  ]
)

export const supportingMaterialSections = legislationSchema.table(
  "supporting_material_sections",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => supportingMaterials.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    sectionIdentifier: text("section_identifier"),
    heading: text("heading"),
    sourceStartOffset: integer("source_start_offset").notNull(),
    sourceEndOffset: integer("source_end_offset").notNull(),
    text: text("text").notNull(),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    searchVector: tsvector("search_vector"),
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingInputHash: char("embedding_input_hash", { length: 64 }),
    embeddingModel: text("embedding_model"),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("supporting_material_sections_embedding_shard_idx").on(
      sql`(((hashtextextended(${table.id}, 0) % 200) + 200) % 200)`,
      table.id
    ),
    check("supporting_material_sections_ordinal_check", sql`${table.ordinal} >= 0`),
    check(
      "supporting_material_sections_offsets_check",
      sql`${table.sourceStartOffset} >= 0 and ${table.sourceEndOffset} >= ${table.sourceStartOffset}`
    ),
    check("supporting_material_sections_text_check", sql`length(${table.text}) > 0`),
    check("supporting_material_sections_hash_check", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    uniqueIndex("supporting_material_sections_ordinal_uidx").on(table.materialId, table.ordinal),
    index("supporting_material_sections_identifier_idx").on(table.materialId, table.sectionIdentifier),
    index("supporting_material_sections_search_vector_gin_idx").using("gin", table.searchVector),
    index("supporting_material_sections_embedding_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ]
)

export const supportingMaterialLinks = legislationSchema.table(
  "supporting_material_links",
  {
    materialId: text("material_id")
      .notNull()
      .references(() => supportingMaterials.id, { onDelete: "cascade" }),
    billId: text("bill_id").references(() => bills.id, { onDelete: "cascade" }),
    amendmentId: text("amendment_id").references(() => amendments.id, { onDelete: "cascade" }),
    eventId: text("event_id").references(() => legislativeEvents.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    classification: text("classification").notNull().default("related"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check(
      "supporting_material_links_target_check",
      sql`${table.billId} is not null or ${table.amendmentId} is not null or ${table.eventId} is not null or ${table.organizationId} is not null`
    ),
    uniqueIndex("supporting_material_links_identity_uidx").on(
      table.materialId,
      table.billId,
      table.amendmentId,
      table.eventId,
      table.organizationId,
      table.classification
    ),
    index("supporting_material_links_bill_idx").on(table.billId, table.materialId),
    index("supporting_material_links_amendment_idx").on(table.amendmentId, table.materialId),
    index("supporting_material_links_event_idx").on(table.eventId, table.materialId)
  ]
)

export const votes = legislationSchema.table(
  "votes",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id").references(() => bills.id, { onDelete: "cascade" }),
    amendmentId: text("amendment_id").references(() => amendments.id, { onDelete: "set null" }),
    eventId: text("event_id").references(() => legislativeEvents.id, { onDelete: "set null" }),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
    sessionId: text("session_id").references(() => legislativeSessions.id, { onDelete: "restrict" }),
    chamber: text("chamber"),
    classification: text("classification"),
    sourceId: text("source_id"),
    rollCallNumber: text("roll_call_number"),
    voteType: text("vote_type"),
    question: text("question"),
    requirement: text("requirement"),
    motion: text("motion").notNull(),
    result: text("result"),
    heldAt: timestamp("held_at", { withTimezone: true }),
    yesCount: integer("yes_count"),
    noCount: integer("no_count"),
    otherCount: integer("other_count"),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("votes_motion_check", sql`length(${table.motion}) > 0`),
    check(
      "votes_target_check",
      sql`${table.billId} is not null or ${table.amendmentId} is not null or ${table.eventId} is not null or ${table.organizationId} is not null or ${table.chamber} is not null`
    ),
    check("votes_yes_count_check", sql`${table.yesCount} is null or ${table.yesCount} >= 0`),
    check("votes_no_count_check", sql`${table.noCount} is null or ${table.noCount} >= 0`),
    check("votes_other_count_check", sql`${table.otherCount} is null or ${table.otherCount} >= 0`),
    index("votes_bill_idx").on(table.billId, table.heldAt),
    index("votes_amendment_idx").on(table.amendmentId, table.heldAt),
    index("votes_event_idx").on(table.eventId, table.heldAt),
    index("votes_organization_idx").on(table.organizationId, table.heldAt),
    uniqueIndex("votes_source_uidx")
      .on(table.sourceId)
      .where(sql`${table.sourceId} is not null`)
  ]
)

export const votePositions = legislationSchema.table(
  "vote_positions",
  {
    voteId: text("vote_id")
      .notNull()
      .references(() => votes.id, { onDelete: "cascade" }),
    sourceIdentity: text("source_identity").notNull(),
    personId: text("person_id").references(() => people.id, { onDelete: "restrict" }),
    sourcePersonId: text("source_person_id"),
    sourceName: text("source_name"),
    option: text("option").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.voteId, table.sourceIdentity] }),
    check("vote_positions_source_identity_check", sql`length(${table.sourceIdentity}) > 0`),
    check("vote_positions_option_check", sql`length(${table.option}) > 0`),
    check(
      "vote_positions_normalized_option_check",
      sql`${table.option} in ('yes', 'no', 'absent', 'abstain', 'not-voting', 'present', 'proxy', 'paired', 'other')`
    ),
    index("vote_positions_person_idx").on(table.personId, table.option),
    index("vote_positions_source_person_idx").on(table.sourcePersonId, table.option)
  ]
)

export const billRelations = legislationSchema.table(
  "bill_relations",
  {
    billId: text("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    relatedBillId: text("related_bill_id").notNull(),
    classification: text("classification").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.billId, table.relatedBillId, table.classification] }),
    check("bill_relations_distinct_check", sql`${table.billId} <> ${table.relatedBillId}`),
    index("bill_relations_related_idx").on(table.relatedBillId, table.classification)
  ]
)

export const eventOutcomeLinks = legislationSchema.table(
  "event_outcome_links",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => legislativeEvents.id, { onDelete: "cascade" }),
    actionId: text("action_id").references(() => billActions.id, { onDelete: "cascade" }),
    voteId: text("vote_id").references(() => votes.id, { onDelete: "cascade" }),
    linkMethod: text("link_method").notNull(),
    sourceReference: text("source_reference").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check(
      "event_outcome_links_target_check",
      sql`(${table.actionId} is not null and ${table.voteId} is null) or (${table.actionId} is null and ${table.voteId} is not null)`
    ),
    check("event_outcome_links_method_check", sql`${table.linkMethod} in ('explicit', 'deterministic-id')`),
    check("event_outcome_links_reference_check", sql`length(${table.sourceReference}) > 0`),
    uniqueIndex("event_outcome_links_action_uidx")
      .on(table.eventId, table.actionId)
      .where(sql`${table.actionId} is not null`),
    uniqueIndex("event_outcome_links_vote_uidx")
      .on(table.eventId, table.voteId)
      .where(sql`${table.voteId} is not null`),
    index("event_outcome_links_event_idx").on(table.eventId, table.createdAt)
  ]
)

export const billDocuments = legislationSchema.table(
  "bill_documents",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    classification: text("classification").notNull(),
    versionCode: text("version_code"),
    title: text("title").notNull(),
    documentDate: date("document_date"),
    sourceUrl: text("source_url").notNull(),
    contentType: text("content_type"),
    blobPath: text("blob_path"),
    text: text("text"),
    contentHash: char("content_hash", { length: 64 }),
    ocrStatus: text("ocr_status"),
    ocrProvider: text("ocr_provider"),
    ocrCompletedAt: timestamp("ocr_completed_at", { withTimezone: true }),
    ocrPageCount: integer("ocr_page_count"),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    processingAttempts: integer("processing_attempts").notNull().default(0),
    processingError: text("processing_error"),
    processingErrorCategory: text("processing_error_category"),
    processingStatus: text("processing_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("bill_documents_title_check", sql`length(${table.title}) > 0`),
    check("bill_documents_hash_check", sql`${table.contentHash} is null or ${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "bill_documents_ocr_status_check",
      sql`${table.ocrStatus} is null or ${table.ocrStatus} in ('not-required', 'pending', 'processing', 'processed', 'failed', 'unsupported')`
    ),
    check(
      "bill_documents_ocr_provider_check",
      sql`${table.ocrProvider} is null or length(btrim(${table.ocrProvider})) > 0`
    ),
    check("bill_documents_ocr_page_count_check", sql`${table.ocrPageCount} is null or ${table.ocrPageCount} > 0`),
    check(
      "bill_documents_ocr_success_check",
      sql`${table.ocrStatus} <> 'processed' or (${table.ocrProvider} is not null and length(btrim(${table.ocrProvider})) > 0 and ${table.ocrCompletedAt} is not null)`
    ),
    check(
      "bill_documents_ocr_metadata_status_check",
      sql`(${table.ocrProvider} is null and ${table.ocrCompletedAt} is null and ${table.ocrPageCount} is null) or ${table.ocrStatus} is not distinct from 'processed'`
    ),
    check("bill_documents_attempts_check", sql`${table.processingAttempts} >= 0`),
    check(
      "bill_documents_error_category_check",
      sql`${table.processingErrorCategory} is null or ${table.processingErrorCategory} in ('download-permanent', 'download-transient', 'malformed-document', 'not-found', 'ocr-required', 'oversized', 'processing-transient', 'source-inaccessible', 'unsafe-url', 'unsupported-format')`
    ),
    check(
      "bill_documents_processing_status_check",
      sql`${table.processingStatus} in ('pending', 'processing', 'processed', 'unsupported', 'failed')`
    ),
    uniqueIndex("bill_documents_source_uidx").on(table.billId, table.sourceUrl),
    index("bill_documents_processing_idx").on(table.processingStatus, table.updatedAt),
    index("bill_documents_pending_claim_idx")
      .on(table.id)
      .where(sql`${table.processingStatus} = 'pending'`),
    index("bill_documents_failed_retry_idx")
      .on(table.processingErrorCategory, table.nextAttemptAt, table.id)
      .where(sql`${table.processingStatus} = 'failed'`)
  ]
)

/**
 * Globally shared publisher slots for document-derived workers. A slot is
 * claimed for one HTTP download and expires if the Trigger worker disappears.
 */
export const documentDownloadLeases = legislationSchema.table(
  "document_download_leases",
  {
    host: text("host").notNull(),
    slot: integer("slot").notNull(),
    ownerId: uuid("owner_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.host, table.slot] }),
    check(
      "document_download_leases_host_check",
      sql`length(${table.host}) > 0 and ${table.host} = lower(${table.host})`
    ),
    check("document_download_leases_slot_check", sql`${table.slot} > 0`),
    index("document_download_leases_expiry_idx").on(table.expiresAt)
  ]
)

export const documentSections = legislationSchema.table(
  "document_sections",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => billDocuments.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    sectionIdentifier: text("section_identifier"),
    heading: text("heading"),
    sourceStartOffset: integer("source_start_offset").notNull(),
    sourceEndOffset: integer("source_end_offset").notNull(),
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    text: text("text").notNull(),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    searchVector: tsvector("search_vector"),
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingInputHash: char("embedding_input_hash", { length: 64 }),
    embeddingModel: text("embedding_model"),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("document_sections_embedding_shard_idx").on(
      sql`(((hashtextextended(${table.id}, 0) % 200) + 200) % 200)`,
      table.id
    ),
    check("document_sections_ordinal_check", sql`${table.ordinal} >= 0`),
    check(
      "document_sections_offsets_check",
      sql`${table.sourceStartOffset} >= 0 and ${table.sourceEndOffset} >= ${table.sourceStartOffset}`
    ),
    check(
      "document_sections_page_range_check",
      sql`(${table.pageStart} is null and ${table.pageEnd} is null) or (${table.pageStart} > 0 and ${table.pageEnd} >= ${table.pageStart})`
    ),
    check("document_sections_text_check", sql`length(${table.text}) > 0`),
    check("document_sections_hash_check", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    uniqueIndex("document_sections_ordinal_uidx").on(table.documentId, table.ordinal),
    index("document_sections_identifier_idx").on(table.documentId, table.sectionIdentifier),
    index("document_sections_search_vector_gin_idx").using("gin", table.searchVector),
    index("document_sections_embedding_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ]
)

export const billEmbeddings = legislationSchema.table(
  "bill_embeddings",
  {
    billId: text("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull(),
    inputContract: text("input_contract").notNull(),
    inputHash: char("input_hash", { length: 64 }).notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    rolloutId: text("rollout_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.billId, table.model, table.inputContract] }),
    check("bill_embeddings_dimensions_check", sql`${table.dimensions} = 1024`),
    check("bill_embeddings_hash_check", sql`${table.inputHash} ~ '^[0-9a-f]{64}$'`),
    check("bill_embeddings_model_check", sql`length(${table.model}) > 0`),
    check("bill_embeddings_contract_check", sql`length(${table.inputContract}) > 0`),
    check("bill_embeddings_rollout_check", sql`length(${table.rolloutId}) > 0`),
    index("bill_embeddings_lookup_idx").on(table.model, table.inputContract, table.billId),
    index("bill_embeddings_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ]
)

export const documentSectionEmbeddings = legislationSchema.table(
  "document_section_embeddings",
  {
    sectionId: text("section_id")
      .notNull()
      .references(() => documentSections.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull(),
    inputContract: text("input_contract").notNull(),
    inputHash: char("input_hash", { length: 64 }).notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    rolloutId: text("rollout_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.sectionId, table.model, table.inputContract] }),
    check("document_section_embeddings_dimensions_check", sql`${table.dimensions} = 1536`),
    check("document_section_embeddings_hash_check", sql`${table.inputHash} ~ '^[0-9a-f]{64}$'`),
    check("document_section_embeddings_model_check", sql`length(${table.model}) > 0`),
    check("document_section_embeddings_contract_check", sql`length(${table.inputContract}) > 0`),
    check("document_section_embeddings_rollout_check", sql`length(${table.rolloutId}) > 0`),
    index("document_section_embeddings_lookup_idx").on(table.model, table.inputContract, table.sectionId),
    index("document_section_embeddings_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ]
)

export const amendmentEmbeddings = legislationSchema.table(
  "amendment_embeddings",
  {
    amendmentId: text("amendment_id")
      .notNull()
      .references(() => amendments.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull(),
    inputContract: text("input_contract").notNull(),
    inputHash: char("input_hash", { length: 64 }).notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    rolloutId: text("rollout_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.amendmentId, table.model, table.inputContract] }),
    check("amendment_embeddings_dimensions_check", sql`${table.dimensions} = 1536`),
    check("amendment_embeddings_hash_check", sql`${table.inputHash} ~ '^[0-9a-f]{64}$'`),
    check("amendment_embeddings_model_check", sql`length(${table.model}) > 0`),
    check("amendment_embeddings_contract_check", sql`length(${table.inputContract}) > 0`),
    check("amendment_embeddings_rollout_check", sql`length(${table.rolloutId}) > 0`),
    index("amendment_embeddings_lookup_idx").on(table.model, table.inputContract, table.amendmentId),
    index("amendment_embeddings_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ]
)

export const supportingMaterialSectionEmbeddings = legislationSchema.table(
  "supporting_material_section_embeddings",
  {
    sectionId: text("section_id")
      .notNull()
      .references(() => supportingMaterialSections.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull(),
    inputContract: text("input_contract").notNull(),
    inputHash: char("input_hash", { length: 64 }).notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    rolloutId: text("rollout_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.sectionId, table.model, table.inputContract] }),
    check("supporting_material_section_embeddings_dimensions_check", sql`${table.dimensions} = 1024`),
    check("supporting_material_section_embeddings_hash_check", sql`${table.inputHash} ~ '^[0-9a-f]{64}$'`),
    check("supporting_material_section_embeddings_model_check", sql`length(${table.model}) > 0`),
    check("supporting_material_section_embeddings_contract_check", sql`length(${table.inputContract}) > 0`),
    check("supporting_material_section_embeddings_rollout_check", sql`length(${table.rolloutId}) > 0`),
    index("supporting_material_section_embeddings_lookup_idx").on(table.model, table.inputContract, table.sectionId),
    index("supporting_material_section_embeddings_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ]
)

export const ingestionRuns = legislationSchema.table(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correlationId: text("correlation_id")
      .notNull()
      .default(sql`gen_random_uuid()::text`),
    workflowExecutionId: text("workflow_execution_id"),
    source: text("source").notNull(),
    operation: text("operation").notNull(),
    status: text("status").notNull().default("running"),
    scope: jsonb("scope").$type<Record<string, unknown>>().notNull().default({}),
    counts: jsonb("counts").$type<Record<string, number>>().notNull().default({}),
    errorSummary: text("error_summary"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [
    check("ingestion_runs_source_check", sql`length(${table.source}) > 0`),
    check("ingestion_runs_operation_check", sql`length(${table.operation}) > 0`),
    check("ingestion_runs_correlation_id_check", sql`length(${table.correlationId}) > 0`),
    check(
      "ingestion_runs_status_check",
      sql`${table.status} in ('running', 'succeeded', 'partial', 'failed', 'deferred')`
    ),
    check(
      "ingestion_runs_completion_check",
      sql`(${table.status} = 'running' and ${table.completedAt} is null) or (${table.status} <> 'running' and ${table.completedAt} is not null)`
    ),
    index("ingestion_runs_source_idx").on(table.source, table.operation, table.startedAt),
    index("ingestion_runs_correlation_idx").on(table.correlationId),
    index("ingestion_runs_workflow_execution_idx").on(table.workflowExecutionId)
  ]
)

export const canonicalRecordFingerprints = legislationSchema.table(
  "canonical_record_fingerprints",
  {
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    fingerprint: char("fingerprint", { length: 64 }).notNull(),
    fields: jsonb("fields").$type<Record<string, unknown>>().notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.recordType, table.recordId] }),
    check("canonical_record_fingerprints_type_check", sql`length(${table.recordType}) > 0`),
    check("canonical_record_fingerprints_id_check", sql`length(${table.recordId}) > 0`),
    check("canonical_record_fingerprints_hash_check", sql`${table.fingerprint} ~ '^[0-9a-f]{64}$'`),
    index("canonical_record_fingerprints_observed_idx").on(table.observedAt)
  ]
)

export const changeEvents = legislationSchema.table(
  "change_events",
  {
    id: text("id").primaryKey(),
    ingestionRunId: uuid("ingestion_run_id")
      .notNull()
      .references(() => ingestionRuns.id, { onDelete: "restrict" }),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    changeType: text("change_type").notNull(),
    jurisdictionId: text("jurisdiction_id").references(() => jurisdictions.id, { onDelete: "restrict" }),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    personId: text("person_id").references(() => people.id, { onDelete: "set null" }),
    changedFields: text("changed_fields")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("change_events_id_check", sql`length(${table.id}) > 0`),
    check("change_events_record_type_check", sql`length(${table.recordType}) > 0`),
    check("change_events_record_id_check", sql`length(${table.recordId}) > 0`),
    check(
      "change_events_change_type_check",
      sql`${table.changeType} in ('create', 'update', 'delete', 'cancel', 'reschedule', 'relationship-change')`
    ),
    index("change_events_record_idx").on(table.recordType, table.recordId, table.observedAt),
    index("change_events_jurisdiction_idx").on(table.jurisdictionId, table.observedAt),
    index("change_events_organization_idx").on(table.organizationId, table.observedAt),
    index("change_events_person_idx").on(table.personId, table.observedAt),
    index("change_events_run_idx").on(table.ingestionRunId, table.observedAt)
  ]
)

export const ingestionLocks = legislationSchema.table(
  "ingestion_locks",
  {
    source: text("source").notNull(),
    operation: text("operation").notNull(),
    scopeKey: text("scope_key").notNull(),
    ownerId: uuid("owner_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.source, table.operation, table.scopeKey] }),
    check("ingestion_locks_source_check", sql`length(${table.source}) > 0`),
    check("ingestion_locks_operation_check", sql`length(${table.operation}) > 0`),
    check("ingestion_locks_scope_key_check", sql`length(${table.scopeKey}) > 0`),
    index("ingestion_locks_expiry_idx").on(table.expiresAt)
  ]
)

export const syncCheckpoints = legislationSchema.table(
  "sync_checkpoints",
  {
    source: text("source").notNull(),
    stream: text("stream").notNull(),
    cursor: jsonb("cursor").$type<Record<string, unknown>>().notNull().default({}),
    watermark: timestamp("watermark", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.source, table.stream] }),
    check("sync_checkpoints_source_check", sql`length(${table.source}) > 0`),
    check("sync_checkpoints_stream_check", sql`length(${table.stream}) > 0`)
  ]
)

/**
 * User-owned notification rules are deliberately isolated from ingested civic
 * records. Their opaque owner fields map to the authenticated WorkOS subject
 * and optional organization rather than to a legislative person.
 */
export const subscriptions = legislationSchema.table(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    ownerOrganizationId: text("owner_organization_id"),
    name: text("name").notNull(),
    target: jsonb("target").$type<Record<string, unknown>>().notNull(),
    targetFingerprint: char("target_fingerprint", { length: 64 }).notNull(),
    eventTypes: text("event_types").array().notNull(),
    delivery: jsonb("delivery").$type<readonly Record<string, unknown>[]>().notNull(),
    frequency: text("frequency").notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull().default("active"),
    revision: uuid("revision").notNull().defaultRandom(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("subscriptions_name_check", sql`length(${table.name}) between 1 and 120`),
    check("subscriptions_owner_user_check", sql`length(${table.ownerUserId}) > 0`),
    check(
      "subscriptions_owner_organization_check",
      sql`${table.ownerOrganizationId} is null or length(${table.ownerOrganizationId}) > 0`
    ),
    check("subscriptions_frequency_check", sql`${table.frequency} in ('immediate', 'hourly', 'daily')`),
    check("subscriptions_status_check", sql`${table.status} in ('active', 'paused', 'cancelled')`),
    check(
      "subscriptions_cancelled_at_check",
      sql`(${table.status} = 'cancelled' and ${table.cancelledAt} is not null) or (${table.status} <> 'cancelled' and ${table.cancelledAt} is null)`
    ),
    index("subscriptions_owner_updated_idx").on(table.ownerOrganizationId, table.ownerUserId, table.updatedAt),
    uniqueIndex("subscriptions_exact_active_uidx")
      .on(sql`coalesce(${table.ownerOrganizationId}, '')`, table.ownerUserId, table.targetFingerprint)
      .where(sql`${table.status} <> 'cancelled'`)
  ]
)

export const subscriptionEvents = legislationSchema.table(
  "subscription_events",
  {
    id: text("id").primaryKey(),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    changeEventId: text("change_event_id").references(() => changeEvents.id, { onDelete: "set null" }),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    sourceUrls: text("source_urls").array().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    matchedAt: timestamp("matched_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("subscription_events_event_type_check", sql`length(${table.eventType}) > 0`),
    check("subscription_events_record_check", sql`length(${table.recordType}) > 0 and length(${table.recordId}) > 0`),
    index("subscription_events_subscription_matched_idx").on(table.subscriptionId, table.matchedAt, table.id)
  ]
)

export const webhooks = legislationSchema.table(
  "webhooks",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    ownerOrganizationId: text("owner_organization_id"),
    name: text("name").notNull(),
    url: text("url").notNull(),
    eventTypes: text("event_types").array().notNull(),
    status: text("status").notNull().default("pending-verification"),
    revision: uuid("revision").notNull().defaultRandom(),
    secretLastFour: char("secret_last_four", { length: 4 }).notNull(),
    overlapEndsAt: timestamp("overlap_ends_at", { withTimezone: true }),
    lastSucceededAt: timestamp("last_succeeded_at", { withTimezone: true }),
    lastFailedAt: timestamp("last_failed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("webhooks_name_check", sql`length(${table.name}) between 1 and 120`),
    check("webhooks_url_check", sql`${table.url} ~ '^https://'`),
    check("webhooks_status_check", sql`${table.status} in ('pending-verification', 'active', 'paused', 'cancelled')`),
    check(
      "webhooks_cancelled_at_check",
      sql`(${table.status} = 'cancelled' and ${table.cancelledAt} is not null) or (${table.status} <> 'cancelled' and ${table.cancelledAt} is null)`
    ),
    index("webhooks_owner_updated_idx").on(table.ownerOrganizationId, table.ownerUserId, table.updatedAt)
  ]
)

/** Keys use application/KMS encryption. Never persist raw signing secrets. */
export const webhookSigningKeys = legislationSchema.table(
  "webhook_signing_keys",
  {
    id: text("id").primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    secretCiphertext: text("secret_ciphertext").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("webhook_signing_keys_ciphertext_check", sql`length(${table.secretCiphertext}) > 0`),
    index("webhook_signing_keys_active_idx").on(table.webhookId, table.isActive, table.expiresAt)
  ]
)

export const subscriptionDeliveries = legislationSchema.table(
  "subscription_deliveries",
  {
    id: text("id").primaryKey(),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    subscriptionEventIds: text("subscription_event_ids").array().notNull(),
    channel: text("channel").notNull(),
    destinationId: text("destination_id"),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failureCategory: text("failure_category"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("subscription_deliveries_channel_check", sql`${table.channel} in ('email', 'webhook', 'in-app')`),
    check(
      "subscription_deliveries_status_check",
      sql`${table.status} in ('pending', 'processing', 'delivered', 'failed', 'suppressed')`
    ),
    check("subscription_deliveries_attempts_check", sql`${table.attemptCount} >= 0 and ${table.attemptCount} <= 5`),
    index("subscription_deliveries_subscription_created_idx").on(table.subscriptionId, table.createdAt, table.id)
  ]
)

/**
 * Durable mutation replay records. `responseCiphertext` protects create and
 * rotate responses that may contain a one-time webhook signing secret.
 */
export const apiIdempotencyRecords = legislationSchema.table(
  "api_idempotency_records",
  {
    principalScope: char("principal_scope", { length: 64 }).notNull(),
    method: text("method").notNull(),
    canonicalPath: text("canonical_path").notNull(),
    key: text("key").notNull(),
    requestHash: char("request_hash", { length: 64 }).notNull(),
    statusCode: integer("status_code").notNull(),
    responseHeaders: jsonb("response_headers").$type<Record<string, string>>().notNull().default({}),
    responseCiphertext: text("response_ciphertext").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.principalScope, table.method, table.canonicalPath, table.key] }),
    check("api_idempotency_records_scope_check", sql`${table.principalScope} ~ '^[0-9a-f]{64}$'`),
    check("api_idempotency_records_key_check", sql`length(${table.key}) between 8 and 128`),
    check("api_idempotency_records_hash_check", sql`${table.requestHash} ~ '^[0-9a-f]{64}$'`),
    check("api_idempotency_records_status_check", sql`${table.statusCode} between 200 and 599`),
    index("api_idempotency_records_expiry_idx").on(table.expiresAt)
  ]
)
