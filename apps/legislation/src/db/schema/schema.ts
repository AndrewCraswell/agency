import { sql } from "drizzle-orm"
import {
  boolean,
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
    sourceUrl: text("source_url"),
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
    uniqueIndex("jurisdictions_subdivision_uidx")
      .on(table.countryCode, table.subdivisionCode)
      .where(sql`${table.subdivisionCode} is not null`)
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
    startDate: date("start_date"),
    endDate: date("end_date"),
    isActive: boolean("is_active").notNull().default(false),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("legislative_sessions_id_check", sql`length(${table.id}) > 0`),
    check("legislative_sessions_identifier_check", sql`length(${table.identifier}) > 0`),
    check(
      "legislative_sessions_dates_check",
      sql`${table.startDate} is null or ${table.endDate} is null or ${table.startDate} <= ${table.endDate}`
    ),
    uniqueIndex("legislative_sessions_identifier_uidx").on(table.jurisdictionId, table.identifier),
    uniqueIndex("legislative_sessions_jurisdiction_id_uidx").on(table.jurisdictionId, table.id)
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
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("bill_actions_ordinal_check", sql`${table.ordinal} >= 0`),
    check("bill_actions_description_check", sql`length(${table.description}) > 0`),
    uniqueIndex("bill_actions_ordinal_uidx").on(table.billId, table.ordinal),
    index("bill_actions_timeline_idx").on(table.billId, table.actionDate, table.ordinal)
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
    sourceUrl: text("source_url"),
    upstreamIds: jsonb("upstream_ids").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [check("people_name_check", sql`length(${table.name}) > 0`)]
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

export const votes = legislationSchema.table(
  "votes",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    chamber: text("chamber"),
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
    check("votes_yes_count_check", sql`${table.yesCount} is null or ${table.yesCount} >= 0`),
    check("votes_no_count_check", sql`${table.noCount} is null or ${table.noCount} >= 0`),
    check("votes_other_count_check", sql`${table.otherCount} is null or ${table.otherCount} >= 0`),
    index("votes_bill_idx").on(table.billId, table.heldAt)
  ]
)

export const votePositions = legislationSchema.table(
  "vote_positions",
  {
    voteId: text("vote_id")
      .notNull()
      .references(() => votes.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    option: text("option").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.voteId, table.personId] }),
    check("vote_positions_option_check", sql`length(${table.option}) > 0`),
    index("vote_positions_person_idx").on(table.personId, table.option)
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
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    processingAttempts: integer("processing_attempts").notNull().default(0),
    processingError: text("processing_error"),
    processingStatus: text("processing_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("bill_documents_title_check", sql`length(${table.title}) > 0`),
    check("bill_documents_hash_check", sql`${table.contentHash} is null or ${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check("bill_documents_attempts_check", sql`${table.processingAttempts} >= 0`),
    check(
      "bill_documents_processing_status_check",
      sql`${table.processingStatus} in ('pending', 'processing', 'processed', 'unsupported', 'failed')`
    ),
    uniqueIndex("bill_documents_source_uidx").on(table.billId, table.sourceUrl),
    index("bill_documents_processing_idx").on(table.processingStatus, table.updatedAt)
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
    check("document_sections_ordinal_check", sql`${table.ordinal} >= 0`),
    check(
      "document_sections_offsets_check",
      sql`${table.sourceStartOffset} >= 0 and ${table.sourceEndOffset} >= ${table.sourceStartOffset}`
    ),
    check("document_sections_text_check", sql`length(${table.text}) > 0`),
    check("document_sections_hash_check", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    uniqueIndex("document_sections_ordinal_uidx").on(table.documentId, table.ordinal),
    index("document_sections_identifier_idx").on(table.documentId, table.sectionIdentifier),
    index("document_sections_search_vector_gin_idx").using("gin", table.searchVector),
    index("document_sections_embedding_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ]
)

export const ingestionRuns = legislationSchema.table(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
    check("ingestion_runs_status_check", sql`${table.status} in ('running', 'succeeded', 'partial', 'failed')`),
    check(
      "ingestion_runs_completion_check",
      sql`(${table.status} = 'running' and ${table.completedAt} is null) or (${table.status} <> 'running' and ${table.completedAt} is not null)`
    ),
    index("ingestion_runs_source_idx").on(table.source, table.operation, table.startedAt)
  ]
)

export const ingestionLocks = legislationSchema.table(
  "ingestion_locks",
  {
    source: text("source").notNull(),
    operation: text("operation").notNull(),
    ownerId: uuid("owner_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.source, table.operation] }),
    check("ingestion_locks_source_check", sql`length(${table.source}) > 0`),
    check("ingestion_locks_operation_check", sql`length(${table.operation}) > 0`),
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
