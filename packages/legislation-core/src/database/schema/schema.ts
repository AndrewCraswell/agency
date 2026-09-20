import {
  organizationMembershipEndReasons,
  type OrganizationMembershipEndReason
} from "@repo/legislation-core/domain/membership"
import { sql } from "drizzle-orm"
import {
  bigserial,
  bigint,
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
  unique,
  uuid,
  vector
} from "drizzle-orm/pg-core"

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector"
})
const xid8 = customType<{ data: string }>({ dataType: () => "xid8" })

/** Source-declared only; missing keys remain unknown rather than copied from a participant or venue label. */
export interface EventLocationPayload {
  address?: string
  name?: string
  room?: string
}

/** The provider may publish a stream or join URL without declaring the meeting remote. */
export interface EventVirtualAccessPayload {
  url: string
}

export const legislationSchema = pgSchema("legislation")

export const researchResultSnapshots = legislationSchema.table(
  "research_result_snapshots",
  {
    id: uuid("id").primaryKey(),
    sessionKey: uuid("session_key").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
  },
  (table) => [index("research_result_snapshots_expiry_idx").on(table.expiresAt)]
)

export const organizationMembershipEndReason = legislationSchema.enum(
  "organization_membership_end_reason",
  organizationMembershipEndReasons
)
export type { OrganizationMembershipEndReason }

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
    index("bills_identifier_lower_idx").on(sql`lower(${table.identifier})`, table.id),
    index("bills_status_idx").on(table.jurisdictionId, table.sessionId, table.status),
    index("bills_introduced_idx").on(table.jurisdictionId, table.introducedAt),
    index("bills_global_introduced_idx").on(table.introducedAt.desc().nullsFirst(), table.id.asc()),
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
    inOfficeSinceYear: integer("in_office_since_year"),
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

/**
 * Source-declared alternate names. These are distinct from given/family names:
 * the API searches them only when their source evidence is complete.
 */
export const personAliases = legislationSchema.table(
  "person_aliases",
  {
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    sourceIdentity: text("source_identity").notNull(),
    name: text("name").notNull(),
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
    primaryKey({ columns: [table.personId, table.sourceIdentity] }),
    check("person_aliases_name_check", sql`length(btrim(${table.name})) > 0`),
    check("person_aliases_source_identity_check", sql`length(btrim(${table.sourceIdentity})) > 0`),
    check(
      "person_aliases_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    index("person_aliases_name_idx").on(table.name),
    index("person_aliases_person_idx").on(table.personId)
  ]
)

/**
 * Source-backed profile facts for a person.  Optional fields remain null when
 * an authoritative source did not publish them; the row itself distinguishes
 * that from an uncollected profile.
 */
export const personDetails = legislationSchema.table(
  "person_details",
  {
    personId: text("person_id")
      .primaryKey()
      .references(() => people.id, { onDelete: "cascade" }),
    imageUrl: text("image_url"),
    publicEmail: text("public_email"),
    officialUrl: text("official_url"),
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
    check(
      "person_details_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    check("person_details_image_url_check", sql`${table.imageUrl} is null or ${table.imageUrl} ~ '^https://'`),
    check(
      "person_details_official_url_check",
      sql`${table.officialUrl} is null or ${table.officialUrl} ~ '^https?://'`
    ),
    check(
      "person_details_public_email_check",
      sql`${table.publicEmail} is null or length(btrim(${table.publicEmail})) > 0`
    )
  ]
)

/** Individual provider identifiers retain their own source relationship. */
export const personExternalIdentifiers = legislationSchema.table(
  "person_external_identifiers",
  {
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    sourceIdentity: text("source_identity").notNull(),
    scheme: text("scheme").notNull(),
    value: text("value").notNull(),
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
    primaryKey({ columns: [table.personId, table.sourceIdentity] }),
    check("person_external_identifiers_scheme_check", sql`length(btrim(${table.scheme})) > 0`),
    check("person_external_identifiers_value_check", sql`length(btrim(${table.value})) > 0`),
    check(
      "person_external_identifiers_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    index("person_external_identifiers_person_idx").on(table.personId)
  ]
)

/** A person can be authoritatively associated with more than one jurisdiction. */
export const personJurisdictions = legislationSchema.table(
  "person_jurisdictions",
  {
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id, { onDelete: "restrict" }),
    sourceIdentity: text("source_identity").notNull(),
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
    primaryKey({ columns: [table.personId, table.jurisdictionId, table.sourceIdentity] }),
    check("person_jurisdictions_source_identity_check", sql`length(btrim(${table.sourceIdentity})) > 0`),
    check(
      "person_jurisdictions_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    index("person_jurisdictions_person_idx").on(table.personId, table.jurisdictionId)
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
    /** Source-supplied public organization profile. Null records an explicitly unavailable source fact. */
    description: text("description"),
    websiteUrl: text("website_url"),
    publicContactAddress: text("public_contact_address"),
    publicContactPhone: text("public_contact_phone"),
    publicContactEmail: text("public_contact_email"),
    termsOfReference: text("terms_of_reference"),
    /**
     * True only after an authoritative provider record supplied a detail
     * profile. It prevents legacy summary-only rows from being projected as a
     * detail with invented null fields.
     */
    detailFactsComplete: boolean("detail_facts_complete").notNull().default(false),
    /** A source-complete snapshot established the complete direct-child set. */
    childRelationsComplete: boolean("child_relations_complete").notNull().default(false),
    /** A source-complete snapshot established the complete direct-membership set. */
    membershipRelationsComplete: boolean("membership_relations_complete").notNull().default(false),
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
      "organizations_description_check",
      sql`${table.description} is null or length(btrim(${table.description})) > 0`
    ),
    check("organizations_website_url_check", sql`${table.websiteUrl} is null or ${table.websiteUrl} ~ '^https://'`),
    check(
      "organizations_public_contact_address_check",
      sql`${table.publicContactAddress} is null or length(btrim(${table.publicContactAddress})) > 0`
    ),
    check(
      "organizations_public_contact_phone_check",
      sql`${table.publicContactPhone} is null or length(btrim(${table.publicContactPhone})) > 0`
    ),
    check(
      "organizations_public_contact_email_check",
      sql`${table.publicContactEmail} is null or length(btrim(${table.publicContactEmail})) > 0`
    ),
    check(
      "organizations_terms_of_reference_check",
      sql`${table.termsOfReference} is null or length(btrim(${table.termsOfReference})) > 0`
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
    startYear: integer("start_year"),
    endYear: integer("end_year"),
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
    legislativeSessionId: text("legislative_session_id").references(() => legislativeSessions.id, {
      onDelete: "restrict"
    }),
    sourceId: text("source_id"),
    /** Sequential internal identity for distinct tenures with one provider assignment identity. */
    tenureOrdinal: integer("tenure_ordinal").notNull().default(1),
    /** Canonical membership role. Null is incomplete, not a fallback to legacy fields. */
    role: text("role"),
    /** Source-supplied public label, kept distinct from the canonical role. */
    label: text("label"),
    title: text("title"),
    rank: text("rank"),
    classification: text("classification"),
    effectiveStartDate: date("effective_start_date"),
    effectiveEndDate: date("effective_end_date"),
    detectedStartDate: date("detected_start_date"),
    detectedEndDate: date("detected_end_date"),
    lastObservedDate: date("last_observed_date"),
    endedReason: organizationMembershipEndReason("ended_reason"),
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
      "organization_memberships_effective_dates_check",
      sql`${table.effectiveStartDate} is null or ${table.effectiveEndDate} is null or ${table.effectiveStartDate} <= ${table.effectiveEndDate}`
    ),
    check(
      "organization_memberships_detected_dates_check",
      sql`${table.detectedStartDate} is null or ${table.detectedEndDate} is null or ${table.detectedStartDate} <= ${table.detectedEndDate}`
    ),
    check(
      "organization_memberships_last_observed_check",
      sql`${table.detectedStartDate} is null or ${table.lastObservedDate} is null or ${table.detectedStartDate} <= ${table.lastObservedDate}`
    ),
    check(
      "organization_memberships_roster_removal_check",
      sql`${table.endedReason} is distinct from 'roster_removal_detected' or ${table.detectedEndDate} is not null`
    ),
    check(
      "organization_memberships_congress_end_check",
      sql`${table.endedReason} is distinct from 'congress_ended' or (${table.legislativeSessionId} is not null and ${table.detectedEndDate} is null)`
    ),
    check("organization_memberships_tenure_ordinal_check", sql`${table.tenureOrdinal} > 0`),
    check(
      "organization_memberships_historical_observation_check",
      sql`${table.endedReason} is distinct from 'historical_at_first_observation' or (${table.legislativeSessionId} is not null and ${table.isActive} is false and ${table.detectedStartDate} is null and ${table.detectedEndDate} is null and ${table.lastObservedDate} is null)`
    ),
    check(
      "organization_memberships_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    uniqueIndex("organization_memberships_source_tenure_uidx")
      .on(table.organizationId, table.sourceId, table.tenureOrdinal)
      .where(sql`${table.sourceId} is not null`),
    uniqueIndex("organization_memberships_active_source_uidx")
      .on(table.organizationId, table.sourceId)
      .where(sql`${table.sourceId} is not null and ${table.isActive} is true`),
    uniqueIndex("organization_memberships_session_tenure_uidx")
      .on(table.organizationId, table.personId, table.legislativeSessionId, table.tenureOrdinal)
      .where(sql`${table.legislativeSessionId} is not null`),
    index("organization_memberships_person_idx").on(table.personId, table.effectiveStartDate, table.detectedStartDate),
    index("organization_memberships_organization_idx").on(table.organizationId, table.isActive),
    index("organization_memberships_session_idx").on(table.legislativeSessionId, table.isActive)
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
    /** The date published by the source, never calculated from an instant or jurisdiction. */
    publisherLocalDate: date("publisher_local_date"),
    name: text("name").notNull(),
    classification: text("classification"),
    status: text("status").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    timezone: text("timezone"),
    allDay: boolean("all_day").notNull().default(false),
    location: jsonb("location").$type<EventLocationPayload>(),
    virtualAccess: jsonb("virtual_access").$type<EventVirtualAccessPayload>(),
    /** Null means the publisher has not declared whether this meeting is remote. */
    isRemote: boolean("is_remote"),
    description: text("description"),
    /** Source ordering is retained only where the publisher supplies it. */
    sourceSequence: integer("source_sequence"),
    sourceProvider: text("source_provider"),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }),
    sourceIsOfficial: boolean("source_is_official"),
    provenanceComplete: boolean("provenance_complete").notNull().default(false),
    /** All summary facts are source-declared and validated for the public contract. */
    canonicalFactsComplete: boolean("canonical_facts_complete").notNull().default(false),
    /** Empty relationship sets are complete only when the source says so. */
    sessionRelationsComplete: boolean("session_relations_complete").notNull().default(false),
    organizationRelationsComplete: boolean("organization_relations_complete").notNull().default(false),
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
    check(
      "legislative_events_classification_vocabulary_check",
      sql`${table.classification} is null or ${table.classification} in ('meeting', 'hearing', 'session', 'other')`
    ),
    check(
      "legislative_events_status_vocabulary_check",
      sql`${table.status} in ('scheduled', 'completed', 'cancelled', 'postponed', 'other')`
    ),
    check(
      "legislative_events_source_sequence_check",
      sql`${table.sourceSequence} is null or ${table.sourceSequence} >= 0`
    ),
    check(
      "legislative_events_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    check(
      "legislative_events_canonical_facts_complete_check",
      sql`not ${table.canonicalFactsComplete} or (${table.publisherLocalDate} is not null and ${table.classification} is not null and ${table.provenanceComplete})`
    ),
    uniqueIndex("legislative_events_jurisdiction_source_uidx").on(table.jurisdictionId, table.sourceId),
    index("legislative_events_schedule_idx").on(table.jurisdictionId, table.startAt, table.status),
    index("legislative_events_deleted_idx").on(table.jurisdictionId, table.isDeleted, table.startAt)
  ]
)

/** Authoritative session links for a meeting. No date or jurisdiction matching is used to fabricate these rows. */
export const eventSessions = legislationSchema.table(
  "event_sessions",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => legislativeEvents.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => legislativeSessions.id, { onDelete: "restrict" })
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.sessionId] }),
    index("event_sessions_session_idx").on(table.sessionId, table.eventId)
  ]
)

/** Authoritative organization links for a meeting. Participant labels never create these rows. */
export const eventOrganizations = legislationSchema.table(
  "event_organizations",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => legislativeEvents.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" })
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.organizationId] }),
    index("event_organizations_organization_idx").on(table.organizationId, table.eventId)
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
    /** Published label. Null keeps legacy/source rows fail-closed. */
    title: text("title"),
    description: text("description"),
    status: text("status"),
    canonicalFactsComplete: boolean("canonical_facts_complete").notNull().default(false),
    billRelationsComplete: boolean("bill_relations_complete").notNull().default(false),
    amendmentRelationsComplete: boolean("amendment_relations_complete").notNull().default(false),
    materialRelationsComplete: boolean("material_relations_complete").notNull().default(false),
    classification: text("classification"),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
    documentId: text("document_id").references(() => eventDocuments.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("event_agenda_items_ordinal_check", sql`${table.ordinal} >= 0`),
    check(
      "event_agenda_items_canonical_facts_check",
      sql`not ${table.canonicalFactsComplete} or (${table.title} is not null and length(btrim(${table.title})) > 0)`
    ),
    uniqueIndex("event_agenda_items_ordinal_uidx").on(table.eventId, table.ordinal)
  ]
)

export const eventAgendaItemBills = legislationSchema.table(
  "event_agenda_item_bills",
  {
    agendaItemId: text("agenda_item_id")
      .notNull()
      .references(() => eventAgendaItems.id, { onDelete: "cascade" }),
    billId: text("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "restrict" })
  },
  (table) => [
    primaryKey({ columns: [table.agendaItemId, table.billId] }),
    index("event_agenda_item_bills_bill_idx").on(table.billId, table.agendaItemId)
  ]
)

export const eventAgendaItemAmendments = legislationSchema.table(
  "event_agenda_item_amendments",
  {
    agendaItemId: text("agenda_item_id")
      .notNull()
      .references(() => eventAgendaItems.id, { onDelete: "cascade" }),
    amendmentId: text("amendment_id")
      .notNull()
      .references(() => amendments.id, { onDelete: "restrict" })
  },
  (table) => [
    primaryKey({ columns: [table.agendaItemId, table.amendmentId] }),
    index("event_agenda_item_amendments_amendment_idx").on(table.amendmentId, table.agendaItemId)
  ]
)

export const eventAgendaItemSupportingMaterials = legislationSchema.table(
  "event_agenda_item_supporting_materials",
  {
    agendaItemId: text("agenda_item_id")
      .notNull()
      .references(() => eventAgendaItems.id, { onDelete: "cascade" }),
    materialId: text("material_id")
      .notNull()
      .references(() => supportingMaterials.id, { onDelete: "restrict" })
  },
  (table) => [
    primaryKey({ columns: [table.agendaItemId, table.materialId] }),
    index("event_agenda_item_supporting_materials_material_idx").on(table.materialId, table.agendaItemId)
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

/** A publisher-owned durable calendar or schedule feed. Event groups are never inferred into this table. */
export const calendars = legislationSchema.table(
  "calendars",
  {
    id: text("id").primaryKey(),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id, { onDelete: "restrict" }),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
    sourceProvider: text("source_provider").notNull(),
    sourceId: text("source_id").notNull(),
    name: text("name").notNull(),
    classification: text("classification").notNull(),
    timezone: text("timezone"),
    description: text("description"),
    coverageFrom: date("coverage_from"),
    coverageTo: date("coverage_to"),
    sourceUrl: text("source_url").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }).notNull(),
    sourceIsOfficial: boolean("source_is_official").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("calendars_id_check", sql`length(${table.id}) > 0`),
    check("calendars_source_provider_check", sql`length(btrim(${table.sourceProvider})) > 0`),
    check("calendars_source_id_check", sql`length(btrim(${table.sourceId})) > 0`),
    check("calendars_name_check", sql`length(btrim(${table.name})) > 0`),
    check("calendars_classification_check", sql`length(btrim(${table.classification})) > 0`),
    check("calendars_source_url_check", sql`${table.sourceUrl} ~ '^https://'`),
    check(
      "calendars_coverage_bounds_check",
      sql`${table.coverageFrom} is null or ${table.coverageTo} is null or ${table.coverageFrom} <= ${table.coverageTo}`
    ),
    uniqueIndex("calendars_source_uidx").on(table.sourceProvider, table.sourceId),
    index("calendars_name_idx").on(table.name, table.id),
    index("calendars_browse_idx").on(table.jurisdictionId, table.organizationId, table.name, table.id),
    index("calendars_organization_idx").on(table.organizationId, table.name, table.id)
  ]
)

/** An explicit publisher-declared calendar membership; temporal proximity never creates this relationship. */
export const calendarEvents = legislationSchema.table(
  "calendar_events",
  {
    calendarId: text("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => legislativeEvents.id, { onDelete: "cascade" }),
    sourceProvider: text("source_provider").notNull(),
    sourceId: text("source_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }).notNull(),
    sourceIsOfficial: boolean("source_is_official").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.calendarId, table.eventId, table.sourceProvider, table.sourceId] }),
    check("calendar_events_source_provider_check", sql`length(btrim(${table.sourceProvider})) > 0`),
    check("calendar_events_source_id_check", sql`length(btrim(${table.sourceId})) > 0`),
    check("calendar_events_source_url_check", sql`${table.sourceUrl} ~ '^https://'`),
    index("calendar_events_calendar_idx").on(table.calendarId, table.eventId),
    index("calendar_events_event_idx").on(table.eventId, table.calendarId)
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
    /** First time this structured sponsorship relationship was observed locally. */
    firstObservedAt: timestamp("first_observed_at", { withTimezone: true }),
    /** Most recent successful observation of this structured sponsorship relationship. */
    latestObservedAt: timestamp("latest_observed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("bill_sponsors_name_check", sql`length(${table.name}) > 0`),
    check(
      "bill_sponsors_observation_bounds_check",
      sql`(${table.firstObservedAt} is null and ${table.latestObservedAt} is null) or (${table.firstObservedAt} is not null and ${table.latestObservedAt} is not null and ${table.firstObservedAt} <= ${table.latestObservedAt})`
    ),
    uniqueIndex("bill_sponsors_person_uidx")
      .on(table.billId, table.personId, table.classification)
      .where(sql`${table.personId} is not null`),
    index("bill_sponsors_bill_idx").on(table.billId, table.isPrimary),
    index("bill_sponsors_name_search_gin_idx").using("gin", sql`to_tsvector('english', ${table.name})`),
    index("bill_sponsors_person_activity_idx")
      .on(table.personId, table.latestObservedAt, table.billId)
      .where(sql`${table.personId} is not null and ${table.latestObservedAt} is not null`)
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
    sessionId: text("session_id").references(() => legislativeSessions.id, { onDelete: "restrict" }),
    sourceId: text("source_id").notNull(),
    classification: text("classification").notNull(),
    title: text("title").notNull(),
    documentDate: date("document_date"),
    hearingDates: date("hearing_dates").array(),
    pageCount: integer("page_count"),
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
    index("supporting_materials_classification_idx").on(table.jurisdictionId, table.classification, table.documentDate),
    index("supporting_materials_title_search_gin_idx").using("gin", sql`to_tsvector('english', ${table.title})`)
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
    index("supporting_material_sections_embedding_shard_idx").on(
      sql`(((hashtextextended(${table.id}, 0) % 200) + 200) % 200)`,
      table.id
    ),
    check("supporting_material_sections_ordinal_check", sql`${table.ordinal} >= 0`),
    check(
      "supporting_material_sections_offsets_check",
      sql`${table.sourceStartOffset} >= 0 and ${table.sourceEndOffset} >= ${table.sourceStartOffset}`
    ),
    check(
      "supporting_material_sections_pages_check",
      sql`(${table.pageStart} is null and ${table.pageEnd} is null) or (${table.pageStart} is not null and ${table.pageEnd} is not null and ${table.pageStart} >= 1 and ${table.pageEnd} >= ${table.pageStart})`
    ),
    check("supporting_material_sections_text_check", sql`length(${table.text}) > 0`),
    check("supporting_material_sections_hash_check", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    uniqueIndex("supporting_material_sections_ordinal_uidx").on(table.materialId, table.ordinal),
    index("supporting_material_sections_identifier_idx").on(table.materialId, table.sectionIdentifier),
    index("supporting_material_sections_page_range_idx").on(table.materialId, table.pageStart, table.pageEnd),
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
    /** Source calendar date when no exact vote instant was reported. */
    heldDate: date("held_date"),
    yesCount: integer("yes_count"),
    noCount: integer("no_count"),
    absentCount: integer("absent_count"),
    abstainCount: integer("abstain_count"),
    notVotingCount: integer("not_voting_count"),
    presentCount: integer("present_count"),
    proxyCount: integer("proxy_count"),
    pairedCount: integer("paired_count"),
    otherCount: integer("other_count"),
    sourceUrl: text("source_url"),
    sourceProvider: text("source_provider"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }),
    sourceIsOfficial: boolean("source_is_official"),
    sourceSequence: integer("source_sequence"),
    /** False preserves legacy and partial provider rows without inventing timeline facts. */
    timelineComplete: boolean("timeline_complete").notNull().default(false),
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
    check("votes_absent_count_check", sql`${table.absentCount} is null or ${table.absentCount} >= 0`),
    check("votes_abstain_count_check", sql`${table.abstainCount} is null or ${table.abstainCount} >= 0`),
    check("votes_not_voting_count_check", sql`${table.notVotingCount} is null or ${table.notVotingCount} >= 0`),
    check("votes_present_count_check", sql`${table.presentCount} is null or ${table.presentCount} >= 0`),
    check("votes_proxy_count_check", sql`${table.proxyCount} is null or ${table.proxyCount} >= 0`),
    check("votes_paired_count_check", sql`${table.pairedCount} is null or ${table.pairedCount} >= 0`),
    check("votes_other_count_check", sql`${table.otherCount} is null or ${table.otherCount} >= 0`),
    check("votes_source_sequence_check", sql`${table.sourceSequence} is null or ${table.sourceSequence} >= 0`),
    check(
      "votes_timeline_complete_check",
      sql`not ${table.timelineComplete} or ((${table.heldAt} is not null or ${table.heldDate} is not null) and ${table.result} in ('passed', 'failed', 'other') and ${table.yesCount} is not null and ${table.noCount} is not null and ${table.absentCount} is not null and ${table.abstainCount} is not null and ${table.notVotingCount} is not null and ${table.presentCount} is not null and ${table.proxyCount} is not null and ${table.pairedCount} is not null and ${table.otherCount} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null and ${table.sourceSequence} is not null)`
    ),
    index("votes_bill_idx").on(table.billId, table.heldAt),
    index("votes_session_idx").on(table.sessionId, table.id),
    index("votes_occurrence_asc_idx")
      .on(sql`coalesce(${table.heldAt}, ${table.heldDate}::timestamp at time zone 'UTC')`, table.id)
      .where(sql`${table.timelineComplete}`),
    index("votes_occurrence_desc_idx")
      .on(sql`coalesce(${table.heldAt}, ${table.heldDate}::timestamp at time zone 'UTC') desc`, table.id)
      .where(sql`${table.timelineComplete}`),
    index("votes_bill_timeline_idx").on(table.billId, table.heldAt, table.sourceSequence, table.id),
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
    /** Publisher-array ordinal preserves the authoritative position order. */
    sourceSequence: integer("source_sequence"),
    option: text("option").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.voteId, table.sourceIdentity] }),
    check("vote_positions_source_identity_check", sql`length(${table.sourceIdentity}) > 0`),
    check("vote_positions_source_sequence_check", sql`${table.sourceSequence} is null or ${table.sourceSequence} >= 0`),
    check("vote_positions_option_check", sql`length(${table.option}) > 0`),
    check(
      "vote_positions_normalized_option_check",
      sql`${table.option} in ('yes', 'no', 'absent', 'abstain', 'not-voting', 'present', 'proxy', 'paired', 'other')`
    ),
    index("vote_positions_person_idx").on(table.personId, table.option),
    index("vote_positions_vote_option_person_idx").on(table.voteId, table.option, table.personId),
    index("vote_positions_vote_sequence_idx").on(table.voteId, table.sourceSequence, table.sourceIdentity),
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
    /** Null means this legacy relation has not received a source-declared direction. */
    direction: text("direction"),
    /** Relation-level provenance is separate from the related bill's provenance. */
    sourceUrl: text("source_url"),
    sourceProvider: text("source_provider"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }),
    sourceIsOfficial: boolean("source_is_official"),
    provenanceComplete: boolean("provenance_complete").notNull().default(false),
    canonicalFactsComplete: boolean("canonical_facts_complete").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.billId, table.relatedBillId, table.classification] }),
    check("bill_relations_distinct_check", sql`${table.billId} <> ${table.relatedBillId}`),
    check(
      "bill_relations_classification_check",
      sql`${table.classification} in ('companion', 'replacement', 'replaced-by', 'prior-session', 'related', 'other')`
    ),
    check(
      "bill_relations_direction_check",
      sql`${table.direction} is null or ${table.direction} in ('outgoing', 'incoming')`
    ),
    check(
      "bill_relations_provenance_complete_check",
      sql`not ${table.provenanceComplete} or (${table.sourceUrl} is not null and ${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
    ),
    check(
      "bill_relations_canonical_facts_complete_check",
      sql`not ${table.canonicalFactsComplete} or (${table.direction} is not null and ${table.provenanceComplete} and ${table.sourceUpdatedAt} is not null)`
    ),
    index("bill_relations_related_idx").on(table.relatedBillId, table.classification),
    index("bill_relations_lookup_idx").on(table.billId, table.direction, table.classification, table.relatedBillId)
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

/**
 * Canonical meeting outcomes are authoritative source facts, unlike
 * eventOutcomeLinks which records relationship evidence only.
 */
export const eventOutcomes = legislationSchema.table(
  "event_outcomes",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => legislativeEvents.id, { onDelete: "cascade" }),
    agendaAssociation: text("agenda_association").notNull(),
    agendaItemId: text("agenda_item_id").references(() => eventAgendaItems.id, { onDelete: "restrict" }),
    classification: text("classification").notNull(),
    description: text("description").notNull(),
    actionId: text("action_id").references(() => billActions.id, { onDelete: "restrict" }),
    voteId: text("vote_id").references(() => votes.id, { onDelete: "restrict" }),
    linkMethod: text("link_method").notNull(),
    sourceSequence: integer("source_sequence").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    occurredDate: date("occurred_date"),
    /** Legacy outcomes remain excluded until their publisher declares an occurrence. */
    timelineComplete: boolean("timeline_complete").notNull().default(false),
    sourceUrl: text("source_url").notNull(),
    sourceProvider: text("source_provider").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }).notNull(),
    sourceIsOfficial: boolean("source_is_official").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("event_outcomes_description_check", sql`length(btrim(${table.description})) > 0`),
    check("event_outcomes_source_sequence_check", sql`${table.sourceSequence} >= 0`),
    check(
      "event_outcomes_classification_check",
      sql`${table.classification} in ('action', 'vote', 'disposition', 'note')`
    ),
    check(
      "event_outcomes_agenda_association_check",
      sql`(${table.agendaAssociation} = 'explicit' and ${table.agendaItemId} is not null) or (${table.agendaAssociation} = 'none' and ${table.agendaItemId} is null)`
    ),
    check(
      "event_outcomes_target_check",
      sql`(${table.classification} = 'action' and ${table.actionId} is not null and ${table.voteId} is null) or (${table.classification} = 'vote' and ${table.actionId} is null and ${table.voteId} is not null) or (${table.classification} in ('disposition', 'note') and ${table.actionId} is null and ${table.voteId} is null)`
    ),
    check("event_outcomes_link_method_check", sql`${table.linkMethod} in ('explicit', 'deterministic-id')`),
    check("event_outcomes_source_url_check", sql`${table.sourceUrl} ~ '^https://'`),
    check("event_outcomes_source_provider_check", sql`length(btrim(${table.sourceProvider})) > 0`),
    check(
      "event_outcomes_timeline_complete_check",
      sql`not ${table.timelineComplete} or (${table.occurredAt} is not null and ${table.occurredDate} is not null)`
    ),
    index("event_outcomes_event_idx").on(table.eventId, table.sourceSequence, table.id),
    index("event_outcomes_timeline_idx").on(table.occurredAt, table.sourceSequence, table.id),
    index("event_outcomes_agenda_idx").on(table.agendaItemId, table.eventId)
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
    pageCount: integer("page_count"),
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
    index("bill_documents_amendment_date_idx").on(
      table.classification.asc(),
      sql`${table.documentDate} is null`,
      table.documentDate.desc().nullsFirst(),
      table.id.asc()
    ),
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
      sql`(${table.pageStart} is null and ${table.pageEnd} is null) or (${table.pageStart} is not null and ${table.pageEnd} is not null and ${table.pageStart} > 0 and ${table.pageEnd} >= ${table.pageStart})`
    ),
    check("document_sections_text_check", sql`length(${table.text}) > 0`),
    check("document_sections_hash_check", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    uniqueIndex("document_sections_ordinal_uidx").on(table.documentId, table.ordinal),
    index("document_sections_identifier_idx").on(table.documentId, table.sectionIdentifier),
    index("document_sections_search_vector_gin_idx").using("gin", table.searchVector),
    index("document_sections_embedding_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ]
)

export const amendmentSectionSearch = legislationSchema.table(
  "amendment_section_search",
  {
    sectionId: text("section_id")
      .primaryKey()
      .references(() => documentSections.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => billDocuments.id, { onDelete: "cascade" }),
    sectionVector: tsvector("section_vector"),
    titleVector: tsvector("title_vector").notNull()
  },
  (table) => [
    index("amendment_section_search_document_idx").on(table.documentId),
    index("amendment_section_search_section_gin_idx").using("gin", table.sectionVector),
    index("amendment_section_search_title_gin_idx").using("gin", table.titleVector)
  ]
)

export const passageSearchChanges = legislationSchema.table(
  "passage_search_changes",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    entityKind: text("entity_kind").notNull(),
    entityId: text("entity_id").notNull(),
    afterDocumentId: text("after_document_id"),
    enqueuedAt: timestamp("enqueued_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    transactionId: xid8("transaction_id")
      .notNull()
      .default(sql`pg_current_xact_id()`),
    retryAt: timestamp("retry_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    attempts: integer("attempts").notNull().default(0),
    errorCategory: text("error_category")
  },
  (table) => [
    check("passage_search_changes_entity_kind_check", sql`${table.entityKind} in ('document','bill')`),
    unique("passage_search_changes_transaction_key").on(table.entityKind, table.entityId, table.transactionId),
    index("passage_search_changes_retry_idx").on(table.retryAt, table.id)
  ]
)

export const passageSearchBackfill = legislationSchema.table("passage_search_backfill", {
  name: text("name").primaryKey(),
  afterDocumentId: text("after_document_id"),
  completedAt: timestamp("completed_at", { withTimezone: true })
})

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
    documentClassification: text("document_classification"),
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
    check(
      "document_section_embeddings_classification_check",
      sql`${table.documentClassification} is null or ${table.documentClassification} in ('amendment', 'analysis', 'fiscal-note', 'supplemental', 'version')`
    ),
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
    /** Immutable source reference captured with the observation, not resolved from the live record. */
    sourceUrl: text("source_url"),
    sourceProvider: text("source_provider"),
    sourceRetrievedAt: timestamp("source_retrieved_at", { withTimezone: true }),
    sourceIsOfficial: boolean("source_is_official"),
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
    check(
      "change_events_source_snapshot_check",
      sql`(${table.sourceUrl} is null and ${table.sourceProvider} is null and ${table.sourceRetrievedAt} is null and ${table.sourceIsOfficial} is null) or (${table.sourceUrl} ~ '^https://' and ${table.sourceProvider} is not null and length(btrim(${table.sourceProvider})) > 0 and ${table.sourceRetrievedAt} is not null and ${table.sourceIsOfficial} is not null)`
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

/** Immutable, owner-attributed mutation trail. It never contains signing secrets. */
export const webhookAuditRecords = legislationSchema.table(
  "webhook_audit_records",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    actorOrganizationId: text("actor_organization_id"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("webhook_audit_records_action_check", sql`length(${table.action}) > 0`),
    check("webhook_audit_records_actor_check", sql`length(${table.actorUserId}) > 0`),
    index("webhook_audit_records_webhook_occurred_idx").on(table.webhookId, table.occurredAt, table.id)
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

// Regulatory storage has no bill/session ownership. Publication is edition-scoped.
export const legalRightsProfiles = legislationSchema.table(
  "legal_rights_profiles",
  {
    id: text("id").primaryKey(),
    policyHash: text("policy_hash").notNull(),
    policy: jsonb("policy").notNull(),
    isActive: boolean("is_active").notNull().default(true)
  },
  (t) => [
    check("legal_rights_profiles_policy_hash_check", sql`${t.policyHash} ~ '^[a-f0-9]{64}$'`),
    check("legal_rights_profiles_policy_check", sql`jsonb_typeof(${t.policy}) = 'object'`)
  ]
)

export const legalSources = legislationSchema.table(
  "legal_sources",
  {
    id: text("id").primaryKey(),
    publisher: text("publisher").notNull(),
    authority: text("authority").notNull()
  },
  (t) => [check("legal_sources_authority_check", sql`${t.authority} in ('official','licensed')`)]
)

export const legalDiscoveryCheckpoints = legislationSchema.table(
  "legal_discovery_checkpoints",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => legalSources.id),
    scopeKey: text("scope_key").notNull(),
    queryHash: text("query_hash").notNull(),
    query: jsonb("query").$type<Record<string, unknown>>().notNull(),
    committedCursor: jsonb("committed_cursor"),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }),
    windowEndedAt: timestamp("window_ended_at", { withTimezone: true }),
    overlapStartedAt: timestamp("overlap_started_at", { withTimezone: true }),
    sourceCutoff: jsonb("source_cutoff"),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastPageId: text("last_page_id"),
    revision: bigint("revision", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.scopeKey] }),
    check("legal_discovery_checkpoints_scope_check", sql`${t.scopeKey} ~ '^[a-f0-9]{64}$'`),
    check("legal_discovery_checkpoints_query_hash_check", sql`${t.queryHash} ~ '^[a-f0-9]{64}$'`),
    check("legal_discovery_checkpoints_query_check", sql`jsonb_typeof(${t.query})='object'`),
    check(
      "legal_discovery_checkpoints_window_check",
      sql`(${t.windowStartedAt} IS NULL)=(${t.windowEndedAt} IS NULL) AND (${t.windowStartedAt} IS NULL OR ${t.windowStartedAt}<=${t.windowEndedAt})`
    ),
    check(
      "legal_discovery_checkpoints_overlap_check",
      sql`${t.overlapStartedAt} IS NULL OR ${t.windowStartedAt} IS NULL OR ${t.overlapStartedAt}<=${t.windowStartedAt}`
    ),
    check("legal_discovery_checkpoints_revision_check", sql`${t.revision}>=0`)
  ]
)

export const legalDiscoveryPages = legislationSchema.table(
  "legal_discovery_pages",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    expectedRevision: bigint("expected_revision", { mode: "number" }).notNull(),
    expectedCursor: jsonb("expected_cursor"),
    nextCursor: jsonb("next_cursor"),
    unitCount: integer("unit_count").notNull(),
    committedAt: timestamp("committed_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    foreignKey({
      columns: [t.sourceId, t.scopeKey],
      foreignColumns: [legalDiscoveryCheckpoints.sourceId, legalDiscoveryCheckpoints.scopeKey]
    }),
    unique().on(t.sourceId, t.scopeKey, t.expectedRevision),
    check("legal_discovery_pages_id_check", sql`${t.id} ~ '^[a-f0-9]{64}$'`),
    check("legal_discovery_pages_revision_check", sql`${t.expectedRevision}>=0`),
    check("legal_discovery_pages_unit_count_check", sql`${t.unitCount} BETWEEN 0 AND 100`)
  ]
)

export const legalDiscoveryUnits = legislationSchema.table(
  "legal_discovery_units",
  {
    sourceId: text("source_id").notNull(),
    scopeKey: text("scope_key").notNull(),
    unitKey: text("unit_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    unit: jsonb("unit").$type<Record<string, unknown>>().notNull(),
    state: text("state").notNull().default("pending"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    registeredAt: timestamp("registered_at", { withTimezone: true }),
    artifactHash: text("artifact_hash").references(() => legalArtifacts.hash),
    artifactBytes: bigint("artifact_bytes", { mode: "number" }),
    storageLocator: text("storage_locator"),
    acquisitionReceipt: jsonb("acquisition_receipt").$type<Record<string, unknown>>(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }),
    parserHash: text("parser_hash"),
    normalizedGeneration: text("normalized_generation"),
    normalizedLocator: text("normalized_locator"),
    parseSummary: jsonb("parse_summary").$type<Record<string, unknown>>(),
    parsedAt: timestamp("parsed_at", { withTimezone: true })
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.scopeKey, t.unitKey] }),
    foreignKey({
      columns: [t.sourceId, t.scopeKey],
      foreignColumns: [legalDiscoveryCheckpoints.sourceId, legalDiscoveryCheckpoints.scopeKey]
    }),
    check("legal_discovery_units_key_check", sql`${t.unitKey} ~ '^[a-f0-9]{64}$'`),
    check("legal_discovery_units_payload_hash_check", sql`${t.payloadHash} ~ '^[a-f0-9]{64}$'`),
    check("legal_discovery_units_payload_check", sql`jsonb_typeof(${t.unit})='object'`),
    check(
      "legal_discovery_units_state_check",
      sql`${t.state} IN ('pending','registered','acquired','parsed','quarantined')`
    ),
    check(
      "legal_discovery_units_registered_check",
      sql`(${t.state}='pending' AND ${t.registeredAt} IS NULL) OR (${t.state} IN ('registered','acquired','parsed') AND ${t.registeredAt} IS NOT NULL) OR ${t.state}='quarantined'`
    ),
    check(
      "legal_discovery_units_acquired_check",
      sql`(${t.state} IN ('acquired','parsed'))=(${t.artifactHash} IS NOT NULL AND ${t.artifactBytes} IS NOT NULL AND ${t.storageLocator} IS NOT NULL AND ${t.acquisitionReceipt} IS NOT NULL AND ${t.acquiredAt} IS NOT NULL)`
    ),
    check(
      "legal_discovery_units_parsed_check",
      sql`(${t.state}='parsed')=(${t.parserHash} IS NOT NULL AND ${t.normalizedGeneration} IS NOT NULL AND ${t.normalizedLocator} IS NOT NULL AND ${t.parseSummary} IS NOT NULL AND ${t.parsedAt} IS NOT NULL)`
    ),
    index("legal_discovery_units_pending_idx")
      .on(t.sourceId, t.scopeKey, t.discoveredAt, t.unitKey)
      .where(sql`${t.state}='pending'`)
  ]
)

export const legalImportManifests = legislationSchema.table(
  "legal_import_manifests",
  {
    id: text("id").primaryKey(),
    body: jsonb("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`)
  },
  (t) => [check("legal_import_manifests_id_check", sql`${t.id} ~ '^[a-f0-9]{64}$'`)]
)

export const legalArtifacts = legislationSchema.table(
  "legal_artifacts",
  {
    hash: text("hash").primaryKey(),
    bytes: bigint("bytes", { mode: "number" }).notNull(),
    storageLocator: text("storage_locator").notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull()
  },
  (t) => [
    check("legal_artifacts_hash_check", sql`${t.hash} ~ '^[a-f0-9]{64}$'`),
    check("legal_artifacts_bytes_check", sql`${t.bytes} > 0`)
  ]
)

export const legalImportGenerations = legislationSchema.table(
  "legal_import_generations",
  {
    id: text("id").primaryKey(),
    manifestId: text("manifest_id")
      .notNull()
      .references(() => legalImportManifests.id),
    unitKey: text("unit_key").notNull(),
    sourceId: text("source_id")
      .notNull()
      .references(() => legalSources.id),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id),
    rightsProfileId: text("rights_profile_id")
      .notNull()
      .references(() => legalRightsProfiles.id),
    artifactHash: text("artifact_hash")
      .notNull()
      .references(() => legalArtifacts.hash),
    parserHash: text("parser_hash").notNull(),
    contract: text("contract").notNull(),
    unit: jsonb("unit").notNull(),
    summary: jsonb("summary").notNull(),
    expectedRecords: integer("expected_records").notNull(),
    state: text("state").notNull().default("staging"),
    blockedReason: text("blocked_reason"),
    fence: integer("fence").notNull().default(0),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`)
  },
  (t) => [
    unique().on(t.id, t.sourceId, t.jurisdictionId, t.rightsProfileId),
    check("legal_import_generations_id_check", sql`${t.id} ~ '^[a-f0-9]{64}$'`),
    check(
      "legal_import_generations_expected_records_check",
      sql`${t.expectedRecords} > 0 OR (${t.expectedRecords} = 0 AND ${t.contract} = 'fr-html-import-2026-09-14')`
    ),
    check(
      "legal_import_generations_state_check",
      sql`${t.state} in ('staging','validated','materialized','published','blocked')`
    ),
    check("legal_import_generations_fence_check", sql`${t.fence} >= 0`),
    check("legal_import_generations_check", sql`(${t.leaseToken} is null) = (${t.leaseExpiresAt} is null)`),
    index("legal_import_generations_work_idx").on(t.state, t.leaseExpiresAt, t.id)
  ]
)

export const legalImportRecords = legislationSchema.table(
  "legal_import_records",
  {
    generationId: text("generation_id")
      .notNull()
      .references(() => legalImportGenerations.id),
    recordKey: text("record_key").notNull(),
    nativeId: text("native_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    parentKey: text("parent_key"),
    nodeKind: text("node_kind").notNull(),
    sourceLocator: text("source_locator").notNull(),
    identityKey: text("identity_key").notNull(),
    payloadBytes: integer("payload_bytes").notNull(),
    recordHash: text("record_hash").notNull(),
    payload: jsonb("payload").notNull()
  },
  (t) => [
    primaryKey({ columns: [t.generationId, t.recordKey] }),
    unique().on(t.generationId, t.nativeId),
    unique().on(t.generationId, t.ordinal),
    check("legal_import_records_ordinal_check", sql`${t.ordinal} >= 0`),
    check("legal_import_records_payload_bytes_check", sql`${t.payloadBytes} > 0 and ${t.payloadBytes} <= 67108864`),
    check("legal_import_records_record_hash_check", sql`${t.recordHash} ~ '^[a-f0-9]{64}$'`)
  ]
)

export const legalCodes = legislationSchema.table(
  "legal_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id),
    codeKey: text("code_key").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull()
  },
  (t) => [
    unique().on(t.jurisdictionId, t.codeKey),
    unique().on(t.id, t.jurisdictionId),
    check("legal_codes_kind_check", sql`${t.kind} in ('regulation','statute')`)
  ]
)

export const legalEditions = legislationSchema.table(
  "legal_editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeId: uuid("code_id").notNull(),
    jurisdictionId: text("jurisdiction_id").notNull(),
    sourceId: text("source_id").notNull(),
    generationId: text("generation_id").notNull().unique(),
    rightsProfileId: text("rights_profile_id").notNull(),
    nativeKey: text("native_key").notNull(),
    sourceRevision: text("source_revision").notNull(),
    issueDate: date("issue_date"),
    currencyDate: date("currency_date"),
    publishedAt: timestamp("published_at", { withTimezone: true })
  },
  (t) => [
    foreignKey({ columns: [t.codeId, t.jurisdictionId], foreignColumns: [legalCodes.id, legalCodes.jurisdictionId] }),
    foreignKey({
      columns: [t.generationId, t.sourceId, t.jurisdictionId, t.rightsProfileId],
      foreignColumns: [
        legalImportGenerations.id,
        legalImportGenerations.sourceId,
        legalImportGenerations.jurisdictionId,
        legalImportGenerations.rightsProfileId
      ]
    }),
    unique().on(t.id, t.codeId),
    unique().on(t.id, t.codeId, t.sourceId),
    index("legal_editions_source_idx").on(t.codeId, t.sourceId, t.issueDate, t.id)
  ]
)

export const legalAnnualEditions = legislationSchema.table(
  "legal_annual_editions",
  {
    id: text("id").primaryKey(),
    manifestId: text("manifest_id")
      .notNull()
      .references(() => legalImportManifests.id),
    codeId: uuid("code_id")
      .notNull()
      .references(() => legalCodes.id),
    packageYear: integer("package_year").notNull(),
    revisionDate: date("revision_date").notNull(),
    expectedVolumes: integer("expected_volumes").notNull(),
    coverage: jsonb("coverage").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    unique().on(t.id, t.codeId),
    unique().on(t.manifestId, t.codeId, t.packageYear),
    check("legal_annual_editions_id_check", sql`${t.id} ~ '^[a-f0-9]{64}$'`),
    check("legal_annual_editions_package_year_check", sql`${t.packageYear} BETWEEN 1996 AND 9999`),
    check("legal_annual_editions_expected_volumes_check", sql`${t.expectedVolumes} BETWEEN 1 AND 200`)
  ]
)

export const legalAnnualEditionVolumes = legislationSchema.table(
  "legal_annual_edition_volumes",
  {
    annualEditionId: text("annual_edition_id").notNull(),
    codeId: uuid("code_id").notNull(),
    volume: integer("volume").notNull(),
    editionId: uuid("edition_id").notNull()
  },
  (t) => [
    primaryKey({ columns: [t.annualEditionId, t.volume] }),
    unique().on(t.annualEditionId, t.editionId),
    foreignKey({
      columns: [t.annualEditionId, t.codeId],
      foreignColumns: [legalAnnualEditions.id, legalAnnualEditions.codeId]
    }),
    foreignKey({ columns: [t.editionId, t.codeId], foreignColumns: [legalEditions.id, legalEditions.codeId] }),
    check("legal_annual_edition_volumes_volume_check", sql`${t.volume} > 0`)
  ]
)

export const legalProvisions = legislationSchema.table(
  "legal_provisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => legalCodes.id),
    identityKey: text("identity_key").notNull(),
    identityBasis: text("identity_basis").notNull()
  },
  (t) => [unique().on(t.codeId, t.identityKey), unique().on(t.id, t.codeId)]
)

export const legalProvisionVersions = legislationSchema.table(
  "legal_provision_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provisionId: uuid("provision_id").notNull(),
    codeId: uuid("code_id").notNull(),
    contentHash: text("content_hash").notNull(),
    inputContract: text("input_contract").notNull(),
    heading: text("heading").notNull(),
    body: text("body").notNull(),
    nodeKind: text("node_kind").notNull(),
    blocks: jsonb("blocks").notNull(),
    language: text("language").notNull()
  },
  (t) => [
    foreignKey({ columns: [t.provisionId, t.codeId], foreignColumns: [legalProvisions.id, legalProvisions.codeId] }),
    unique().on(t.provisionId, t.contentHash, t.inputContract),
    unique().on(t.id, t.provisionId, t.codeId),
    check("legal_provision_versions_content_hash_check", sql`${t.contentHash} ~ '^[a-f0-9]{64}$'`)
  ]
)

export const legalEditionProvisions = legislationSchema.table(
  "legal_edition_provisions",
  {
    editionId: uuid("edition_id").notNull(),
    codeId: uuid("code_id").notNull(),
    provisionId: uuid("provision_id").notNull(),
    versionId: uuid("version_id").notNull(),
    parentId: uuid("parent_id"),
    ordinal: integer("ordinal").notNull(),
    sourceLocator: text("source_locator").notNull(),
    sourceAttributes: jsonb("source_attributes").notNull(),
    nativeId: text("native_id").notNull()
  },
  (t) => [
    primaryKey({ columns: [t.editionId, t.provisionId] }),
    unique().on(t.editionId, t.ordinal),
    unique().on(t.editionId, t.versionId),
    foreignKey({ columns: [t.editionId, t.codeId], foreignColumns: [legalEditions.id, legalEditions.codeId] }),
    foreignKey({
      columns: [t.versionId, t.provisionId, t.codeId],
      foreignColumns: [legalProvisionVersions.id, legalProvisionVersions.provisionId, legalProvisionVersions.codeId]
    }),
    foreignKey({ columns: [t.editionId, t.parentId], foreignColumns: [t.editionId, t.provisionId] }),
    check("legal_edition_provisions_ordinal_check", sql`${t.ordinal} >= 0`),
    check("legal_edition_provisions_check", sql`${t.parentId} is distinct from ${t.provisionId}`),
    index("legal_edition_provisions_version_idx").on(t.versionId),
    index("legal_edition_provisions_children_idx").on(t.editionId, t.parentId, t.ordinal),
    index("legal_edition_provisions_parent_idx").on(t.editionId, t.parentId, t.ordinal)
  ]
)

export const legalProvisionSourceReviews = legislationSchema.table(
  "legal_provision_source_reviews",
  {
    editionId: uuid("edition_id").notNull(),
    versionId: uuid("version_id").notNull(),
    tableIndex: integer("table_index").notNull(),
    blockHash: text("block_hash").notNull(),
    reviewHash: text("review_hash").notNull(),
    disposition: text("disposition").notNull(),
    evidence: jsonb("evidence").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`)
  },
  (t) => [
    primaryKey({ columns: [t.editionId, t.versionId, t.tableIndex] }),
    foreignKey({
      columns: [t.editionId, t.versionId],
      foreignColumns: [legalEditionProvisions.editionId, legalEditionProvisions.versionId]
    }),
    check("legal_provision_source_reviews_table_index_check", sql`${t.tableIndex} >= 0`),
    check("legal_provision_source_reviews_block_hash_check", sql`${t.blockHash} ~ '^[a-f0-9]{64}$'`),
    check("legal_provision_source_reviews_review_hash_check", sql`${t.reviewHash} ~ '^[a-f0-9]{64}$'`),
    check(
      "legal_provision_source_reviews_disposition_check",
      sql`${t.disposition} in ('accepted_context', 'quarantined_source_gap', 'non_data_table')`
    )
  ]
)

export const legalCodeHeads = legislationSchema.table(
  "legal_code_heads",
  {
    codeId: uuid("code_id").notNull(),
    sourceId: text("source_id").notNull(),
    editionId: uuid("edition_id").notNull()
  },
  (t) => [
    primaryKey({ columns: [t.codeId, t.sourceId] }),
    foreignKey({
      columns: [t.editionId, t.codeId, t.sourceId],
      foreignColumns: [legalEditions.id, legalEditions.codeId, legalEditions.sourceId]
    })
  ]
)

export const legalDerivedOutbox = legislationSchema.table(
  "legal_derived_outbox",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    editionId: uuid("edition_id")
      .notNull()
      .references(() => legalEditions.id),
    operation: text("operation").notNull(),
    state: text("state").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    retryAt: timestamp("retry_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`)
  },
  (t) => [
    unique().on(t.editionId, t.operation),
    check("legal_derived_outbox_operation_check", sql`${t.operation} in ('lexical','embedding','event')`),
    check("legal_derived_outbox_state_check", sql`${t.state} in ('pending','acknowledged')`),
    check("legal_derived_outbox_attempts_check", sql`${t.attempts} >= 0`),
    index("legal_derived_outbox_retry_idx").on(t.state, t.retryAt, t.id)
  ]
)

export const regulatoryDocuments = legislationSchema.table(
  "regulatory_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: text("jurisdiction_id")
      .notNull()
      .references(() => jurisdictions.id),
    identityNamespace: text("identity_namespace").notNull(),
    nativeNumber: text("native_number").notNull()
  },
  (t) => [unique().on(t.jurisdictionId, t.identityNamespace, t.nativeNumber)]
)

export const regulatoryDocumentVersions = legislationSchema.table(
  "regulatory_document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => regulatoryDocuments.id),
    contentHash: text("content_hash").notNull(),
    inputContract: text("input_contract").notNull(),
    pdfHash: text("pdf_hash")
      .notNull()
      .references(() => legalArtifacts.hash),
    heading: text("heading").notNull(),
    body: text("body").notNull(),
    blocks: jsonb("blocks").notNull(),
    publicationKind: text("publication_kind").notNull()
  },
  (t) => [
    unique().on(t.documentId, t.contentHash, t.inputContract, t.pdfHash),
    unique().on(t.id, t.documentId),
    check("regulatory_document_versions_content_hash_check", sql`${t.contentHash} ~ '^[a-f0-9]{64}$'`),
    check("regulatory_document_versions_blocks_check", sql`jsonb_typeof(${t.blocks})='array'`),
    check(
      "regulatory_document_versions_publication_kind_check",
      sql`${t.publicationKind} in ('final_rule','proposed_rule','notice','other')`
    )
  ]
)

export const regulatoryPublicationBatches = legislationSchema.table(
  "regulatory_publication_batches",
  {
    generationId: text("generation_id")
      .primaryKey()
      .references(() => legalImportGenerations.id),
    metadataManifestId: text("metadata_manifest_id").notNull(),
    metadataManifest: jsonb("metadata_manifest").notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    reconciliation: jsonb("reconciliation").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`)
  },
  (t) => [
    check("regulatory_publication_batches_metadata_manifest_id_check", sql`${t.metadataManifestId} ~ '^[a-f0-9]{64}$'`),
    check("regulatory_publication_batches_snapshot_hash_check", sql`${t.snapshotHash} ~ '^[a-f0-9]{64}$'`)
  ]
)

export const regulatoryDocumentObservations = legislationSchema.table(
  "regulatory_document_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generationId: text("generation_id")
      .notNull()
      .references(() => regulatoryPublicationBatches.generationId),
    documentId: uuid("document_id")
      .notNull()
      .references(() => regulatoryDocuments.id),
    versionId: uuid("version_id").notNull(),
    sourceId: text("source_id").notNull(),
    jurisdictionId: text("jurisdiction_id").notNull(),
    rightsProfileId: text("rights_profile_id").notNull(),
    publicationDate: date("publication_date").notNull(),
    metadata: jsonb("metadata").notNull(),
    sourceLocator: text("source_locator").notNull(),
    pdfReceipt: jsonb("pdf_receipt").notNull(),
    pdfInspection: jsonb("pdf_inspection").notNull()
  },
  (t) => [
    unique().on(t.generationId, t.documentId),
    foreignKey({
      columns: [t.versionId, t.documentId],
      foreignColumns: [regulatoryDocumentVersions.id, regulatoryDocumentVersions.documentId]
    }),
    foreignKey({
      columns: [t.generationId, t.sourceId, t.jurisdictionId, t.rightsProfileId],
      foreignColumns: [
        legalImportGenerations.id,
        legalImportGenerations.sourceId,
        legalImportGenerations.jurisdictionId,
        legalImportGenerations.rightsProfileId
      ]
    }),
    index("regulatory_document_observations_browse_idx").on(t.publicationDate, t.id),
    index("regulatory_document_observations_version_idx").on(t.versionId)
  ]
)

export const regulatoryPublicationOutbox = legislationSchema.table(
  "regulatory_publication_outbox",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    observationId: uuid("observation_id")
      .notNull()
      .unique()
      .references(() => regulatoryDocumentObservations.id),
    operation: text("operation").notNull(),
    state: text("state").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    retryAt: timestamp("retry_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`)
  },
  (t) => [
    check("regulatory_publication_outbox_operation_check", sql`${t.operation}='lexical'`),
    check("regulatory_publication_outbox_state_check", sql`${t.state} in ('pending','acknowledged')`),
    check("regulatory_publication_outbox_attempts_check", sql`${t.attempts} >= 0`),
    index("regulatory_publication_outbox_retry_idx").on(t.state, t.retryAt, t.id)
  ]
)

export const legalPassageGenerations = legislationSchema.table(
  "legal_passage_generations",
  {
    id: text("id").primaryKey(),
    provisionVersionId: uuid("provision_version_id").references(() => legalProvisionVersions.id),
    documentVersionId: uuid("document_version_id").references(() => regulatoryDocumentVersions.id),
    contract: text("contract").notNull(),
    bodyHash: text("body_hash").notNull(),
    tokenizerId: text("tokenizer_id").notNull(),
    context: text("context").notNull(),
    manifestHash: text("manifest_hash").notNull(),
    passageCount: integer("passage_count").notNull(),
    eligibility: text("eligibility").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`)
  },
  (t) => [
    check("legal_passage_generations_id_check", sql`${t.id} ~ '^[a-f0-9]{64}$'`),
    check("legal_passage_generations_body_hash_check", sql`${t.bodyHash} ~ '^[a-f0-9]{64}$'`),
    check("legal_passage_generations_manifest_hash_check", sql`${t.manifestHash} ~ '^[a-f0-9]{64}$'`),
    check("legal_passage_generations_owner_check", sql`num_nonnulls(${t.provisionVersionId},${t.documentVersionId})=1`),
    check("legal_passage_generations_count_check", sql`${t.passageCount} >= 0`),
    check("legal_passage_generations_eligibility_check", sql`${t.eligibility} in ('eligible','empty_text')`),
    check("legal_passage_generations_empty_check", sql`(${t.passageCount}=0)=(${t.eligibility}='empty_text')`),
    index("legal_passage_generations_provision_idx").on(t.provisionVersionId, t.id),
    index("legal_passage_generations_document_idx").on(t.documentVersionId, t.id)
  ]
)

export const legalPassages = legislationSchema.table(
  "legal_passages",
  {
    id: text("id").primaryKey(),
    generationId: text("generation_id")
      .notNull()
      .references(() => legalPassageGenerations.id),
    ordinal: integer("ordinal").notNull(),
    body: text("body").notNull(),
    inputText: text("input_text").notNull(),
    data: jsonb("data").notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(sql`to_tsvector('english'::regconfig,input_text)`)
  },
  (t) => [
    unique().on(t.generationId, t.ordinal),
    check("legal_passages_id_check", sql`${t.id} ~ '^[a-f0-9]{64}$'`),
    check("legal_passages_ordinal_check", sql`${t.ordinal} >= 0`),
    check(
      "legal_passages_data_check",
      sql`${t.body}=${t.data}->>'text' and ${t.inputText}=${t.data}->>'inputText' and ${t.ordinal}=(${t.data}->>'ordinal')::integer`
    ),
    index("legal_passages_search_idx").using("gin", t.searchVector)
  ]
)

export const legalPassagePreparations = legislationSchema.table(
  "legal_passage_preparations",
  {
    id: text("id").primaryKey(),
    editionId: uuid("edition_id").references(() => legalEditions.id),
    observationId: uuid("observation_id").references(() => regulatoryDocumentObservations.id),
    tokenizerId: text("tokenizer_id").notNull(),
    inventoryHash: text("inventory_hash").notNull(),
    expectedCount: integer("expected_count").notNull(),
    state: text("state").notNull().default("pending"),
    fence: integer("fence").notNull().default(0),
    leaseToken: uuid("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    retryAt: timestamp("retry_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    lastError: text("last_error")
  },
  (t) => [
    check("legal_passage_preparations_scope_check", sql`num_nonnulls(${t.editionId},${t.observationId})=1`),
    check("legal_passage_preparations_count_check", sql`${t.expectedCount}>0`),
    check("legal_passage_preparations_state_check", sql`${t.state} in ('pending','prepared','blocked')`),
    check("legal_passage_preparations_lease_check", sql`(${t.leaseToken} is null)=(${t.leaseExpiresAt} is null)`)
  ]
)
export const legalPassagePreparationItems = legislationSchema.table(
  "legal_passage_preparation_items",
  {
    preparationId: text("preparation_id")
      .notNull()
      .references(() => legalPassagePreparations.id),
    ordinal: integer("ordinal").notNull(),
    versionId: uuid("version_id").notNull(),
    context: text("context").notNull(),
    generationId: text("generation_id").references(() => legalPassageGenerations.id),
    failureCode: text("failure_code"),
    failedAt: timestamp("failed_at", { withTimezone: true })
  },
  (t) => [
    primaryKey({ columns: [t.preparationId, t.ordinal] }),
    unique().on(t.preparationId, t.versionId),
    check("legal_preparation_item_failure_code", sql`${t.failureCode} ~ '^[a-z_]+$'`),
    check("legal_preparation_item_failure_time", sql`(${t.failureCode} is null)=(${t.failedAt} is null)`),
    check("legal_preparation_item_outcome", sql`${t.generationId} is null or ${t.failureCode} is null`),
    index("legal_passage_preparation_pending_idx")
      .on(t.preparationId, t.ordinal)
      .where(sql`${t.generationId} is null and ${t.failureCode} is null`)
  ]
)
