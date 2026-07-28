import { sql } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import {
  bigint,
  boolean,
  char,
  check,
  date,
  doublePrecision,
  foreignKey,
  halfvec,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core"

export const blogWriterSchema = pgSchema("blog_writer")

export const blogs = pgTable("blogs", {
  hostname: text("hostname").primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  lastSync: timestamp("last_sync", { withTimezone: true })
})

export const tenantStores = blogWriterSchema.table(
  "tenant_stores",
  {
    tenantId: uuid("tenant_id").primaryKey().defaultRandom(),
    shopDomain: text("shop_domain").notNull(),
    shopName: text("shop_name").notNull().default(""),
    // Every hostname the storefront answers on, including the myshopify domain and any custom
    // domains and aliases. A store must not be able to follow itself as prior art, and checking
    // only the myshopify domain would miss the custom domain that merchants actually publish on.
    ownedDomains: text("owned_domains")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Who the store sells to and how it sounds, written by the merchant and given to every generator.
    brandBrief: text("brand_brief").notNull().default(""),
    // The search market every keyword figure is measured in. A ranking has no meaning without one, because the same
    // term can be uncontested in one country and unwinnable in another, so an unresolved pair blocks keyword work
    // rather than defaulting to a guess. Derived from Shopify at sync time and correctable by the merchant, which is
    // what market_source records.
    marketCountryCode: char("market_country_code", { length: 2 }),
    marketLanguageCode: text("market_language_code"),
    marketSource: text("market_source"),
    status: text("status").notNull().default("active"),
    syncStatus: text("sync_status").notNull().default("pending"),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull().defaultNow(),
    lastSynchronizedAt: timestamp("last_synchronized_at", { withTimezone: true }),
    uninstalledAt: timestamp("uninstalled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("tenant_stores_domain_check", sql`${table.shopDomain} ~ '^[a-z0-9][a-z0-9-]*\\.myshopify\\.com$'`),
    check("tenant_stores_status_check", sql`${table.status} in ('active', 'uninstalled')`),
    check("tenant_stores_market_country_check", sql`${table.marketCountryCode} ~ '^[A-Z]{2}$'`),
    check("tenant_stores_market_language_check", sql`${table.marketLanguageCode} ~ '^[a-z]{2}(-[A-Z]{2})?$'`),
    check(
      "tenant_stores_market_source_check",
      sql`${table.marketSource} is null or ${table.marketSource} in ('shopify', 'merchant')`
    ),
    check(
      "tenant_stores_market_complete_check",
      sql`(${table.marketCountryCode} is null and ${table.marketLanguageCode} is null and ${table.marketSource} is null) or (${table.marketCountryCode} is not null and ${table.marketLanguageCode} is not null and ${table.marketSource} is not null)`
    ),
    check("tenant_stores_sync_status_check", sql`${table.syncStatus} in ('pending', 'syncing', 'ready', 'failed')`),
    check(
      "tenant_stores_uninstalled_check",
      sql`(${table.status} = 'active' and ${table.uninstalledAt} is null) or (${table.status} = 'uninstalled' and ${table.uninstalledAt} is not null)`
    ),
    uniqueIndex("tenant_stores_shop_domain_uidx").on(table.shopDomain)
  ]
)

export const tenantCompetitorDomains = blogWriterSchema.table(
  "tenant_competitor_domains",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.hostname] }),
    check(
      "tenant_competitor_domains_hostname_check",
      sql`${table.hostname} ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$'`
    )
  ]
)

/**
 * One keyword import run for a tenant. A run covers the store's own domain and every accepted competitor, so the
 * cost and outcome of each provider request live on `keyword_import_domains` rather than here.
 */
export const keywordImports = blogWriterSchema.table(
  "keyword_imports",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    importId: uuid("import_id").notNull().defaultRandom(),
    provider: text("provider").notNull(),
    endpoint: text("endpoint").notNull(),
    // The market the whole run was measured in, copied rather than referenced, so a later market correction cannot
    // silently restate what these figures meant when they were collected.
    locationName: text("location_name").notNull(),
    languageCode: text("language_code").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status").notNull().default("running"),
    // The thresholds this run's recommendations were judged against, which are taken from the tenant's own results
    // rather than fixed. A merchant asking why a term missed the demand floor is asking about this row's numbers, and
    // they would otherwise be unrecoverable once the next import moved them.
    calibration: jsonb("calibration").$type<Record<string, unknown>>(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cost: numeric("cost", { precision: 12, scale: 6 }).notNull().default("0"),
    rowCount: integer("row_count").notNull().default(0),
    errorCode: text("error_code")
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.importId] }),
    check("keyword_imports_status_check", sql`${table.status} in ('running', 'succeeded', 'partial', 'failed')`),
    check("keyword_imports_trigger_check", sql`${table.trigger} in ('scheduled', 'manual')`),
    check("keyword_imports_row_count_check", sql`${table.rowCount} >= 0`),
    index("keyword_imports_requested_idx").on(table.tenantId, table.requestedAt)
  ]
)

/**
 * One provider request within a run, which is one domain. Its own status is kept because a competitor that fails to
 * resolve must not discard the domains that did, and its own cost is kept because spend has to be attributable to the
 * domain that caused it before a plan limit can be set from measured figures.
 */
export const keywordImportDomains = blogWriterSchema.table(
  "keyword_import_domains",
  {
    tenantId: uuid("tenant_id").notNull(),
    importId: uuid("import_id").notNull(),
    domain: text("domain").notNull(),
    isOwnDomain: boolean("is_own_domain").notNull(),
    // The provider's authority score for this domain, which is a property of the domain rather than of any one term,
    // so it is recorded once here instead of on every observation it explains.
    domainRank: doublePrecision("domain_rank"),
    status: text("status").notNull().default("running"),
    rowCount: integer("row_count").notNull().default(0),
    availableRowCount: integer("available_row_count"),
    cost: numeric("cost", { precision: 12, scale: 6 }).notNull().default("0"),
    errorCode: text("error_code")
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.importId, table.domain] }),
    foreignKey({
      columns: [table.tenantId, table.importId],
      foreignColumns: [keywordImports.tenantId, keywordImports.importId],
      name: "keyword_import_domains_import_fk"
    }).onDelete("cascade"),
    check("keyword_import_domains_status_check", sql`${table.status} in ('running', 'succeeded', 'failed')`),
    check("keyword_import_domains_row_count_check", sql`${table.rowCount} >= 0`)
  ]
)

/**
 * What one domain ranked for, on one keyword, at one moment. Written once and never updated: these rows are the
 * evidence every derived figure is answerable to, so a later import adds a new generation rather than restating an
 * earlier one, and any clustering or scoring change can be replayed against exactly what the provider returned.
 */
export const keywordObservations = blogWriterSchema.table(
  "keyword_observations",
  {
    tenantId: uuid("tenant_id").notNull(),
    importId: uuid("import_id").notNull(),
    keyword: text("keyword").notNull(),
    domain: text("domain").notNull(),
    isOwnDomain: boolean("is_own_domain").notNull(),
    rankAbsolute: integer("rank_absolute").notNull(),
    rankGroup: integer("rank_group"),
    rankingUrl: text("ranking_url"),
    // The provider reports the position it last saw, which means decay is measurable on a first import. The interval
    // is the provider's own check cadence rather than ours, so the two freshness stamps have to be read together.
    previousRankAbsolute: integer("previous_rank_absolute"),
    // Demand and result counts are wider than a 32-bit column: a broad term reports millions of searches and billions
    // of results, and a single overflowing row would otherwise reject the whole domain's evidence.
    searchVolume: bigint("search_volume", { mode: "number" }),
    monthlySearches: jsonb("monthly_searches").$type<{ year: number; month: number; searchVolume: number }[]>(),
    difficulty: integer("difficulty"),
    mainIntent: text("main_intent"),
    foreignIntents: text("foreign_intents")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    serpItemTypes: text("serp_item_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // The average authority of the pages currently holding the top ten. Attainability is read as the gap between this
    // and the store's own rank, because the provider leaves its difficulty score empty on a large share of terms.
    serpAverageDomainRank: doublePrecision("serp_average_domain_rank"),
    serpResultCount: bigint("serp_result_count", { mode: "number" }),
    estimatedTrafficVolume: doublePrecision("estimated_traffic_volume"),
    // When the provider last refreshed each group of fields, which differ by months. A figure is only as current as
    // its own group, so provenance is kept per group rather than per row.
    fieldFreshness: jsonb("field_freshness").$type<Record<string, string>>().notNull().default({}),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.importId, table.keyword, table.domain] }),
    foreignKey({
      columns: [table.tenantId, table.importId],
      foreignColumns: [keywordImports.tenantId, keywordImports.importId],
      name: "keyword_observations_import_fk"
    }).onDelete("cascade"),
    check("keyword_observations_rank_check", sql`${table.rankAbsolute} > 0`),
    check(
      "keyword_observations_previous_rank_check",
      sql`${table.previousRankAbsolute} is null or ${table.previousRankAbsolute} > 0`
    ),
    check("keyword_observations_volume_check", sql`${table.searchVolume} is null or ${table.searchVolume} >= 0`),
    index("keyword_observations_keyword_idx").on(table.tenantId, table.importId, table.keyword),
    index("keyword_observations_domain_idx").on(table.tenantId, table.importId, table.domain)
  ]
)

/**
 * A set of terms one page has been proven able to win, as one import saw it.
 *
 * Entirely derived: every column here is recomputed from the observations of the same import, so a change to how
 * clusters are formed is replayed rather than migrated. That is why the rows belong to an import instead of to the
 * tenant. A run that fails writes none of them and the previous run's remain readable, which is what keeps the
 * section populated through a bad night at the provider.
 */
export const keywordClusters = blogWriterSchema.table(
  "keyword_clusters",
  {
    tenantId: uuid("tenant_id").notNull(),
    importId: uuid("import_id").notNull(),
    // A fingerprint of the cluster's own terms, so the same set of terms carries the same identity across imports and
    // a dismissal made against it survives the next run.
    clusterId: text("cluster_id").notNull(),
    headKeyword: text("head_keyword").notNull(),
    headDemand: bigint("head_demand", { mode: "number" }).notNull().default(0),
    // Combined demand across the cluster's terms, kept beside the head's own rather than standing in for it.
    demand: bigint("demand", { mode: "number" }).notNull().default(0),
    keywords: text("keywords")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    keywordDemand: jsonb("keyword_demand").$type<Record<string, number>>().notNull().default({}),
    // The competitor pages that hold two or more of these terms together, which is the proof the cluster exists.
    proofUrls: text("proof_urls")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    competitorTopTen: jsonb("competitor_top_ten")
      .$type<{ domain: string; keyword: string; position: number; url: string | null }[]>()
      .notNull()
      .default([]),
    ourBestPosition: integer("our_best_position"),
    ourBestKeyword: text("our_best_keyword"),
    ourHeadPosition: integer("our_head_position"),
    ourRankingUrls: text("our_ranking_urls")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    largestOurDecline: jsonb("largest_our_decline").$type<{
      keyword: string
      from: number
      to: number
      demand: number
    } | null>(),
    mainIntent: text("main_intent"),
    intents: text("intents")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // The middle of the cluster's reported difficulties, which lands between whole numbers as often as on one. Rounding
    // it would be inventing precision in the opposite direction from the one that matters.
    difficulty: doublePrecision("difficulty"),
    serpAverageDomainRank: doublePrecision("serp_average_domain_rank"),
    serpItemTypes: text("serp_item_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    headMonthlySearches: jsonb("head_monthly_searches").$type<
      { year: number; month: number; searchVolume: number }[] | null
    >(),
    hasEditorialProof: boolean("has_editorial_proof").notNull().default(false),
    isReachable: boolean("is_reachable").notNull().default(false),
    hasAiOverview: boolean("has_ai_overview").notNull().default(false),
    hasProductBlocks: boolean("has_product_blocks").notNull().default(false),
    questionKeywords: text("question_keywords")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`)
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.importId, table.clusterId] }),
    foreignKey({
      columns: [table.tenantId, table.importId],
      foreignColumns: [keywordImports.tenantId, keywordImports.importId],
      name: "keyword_clusters_import_fk"
    }).onDelete("cascade"),
    index("keyword_clusters_demand_idx").on(table.tenantId, table.importId, table.demand)
  ]
)

/**
 * What the rules concluded about one cluster, with the evidence that produced it.
 *
 * One row per cluster, not one per rule. Several rules reach the same cluster routinely, and a merchant reading three
 * rows for one subject would read three pieces of work. The rule that speaks for the cluster is `detector`; the others
 * are kept in `supporting` so nothing the run concluded is thrown away.
 *
 * Rows that recommend no article are stored alongside the ones that recommend writing, because a list that silently
 * omits things is a list a merchant stops trusting, and "why is this term not here" needs an answer. `isSuppressed`
 * separates the two lists; it is not a reason to discard either.
 */
export const keywordOpportunities = blogWriterSchema.table(
  "keyword_opportunities",
  {
    tenantId: uuid("tenant_id").notNull(),
    importId: uuid("import_id").notNull(),
    clusterId: text("cluster_id").notNull(),
    detector: text("detector").notNull(),
    verdict: text("verdict").notNull(),
    // The other rules that reached this cluster and agreed there was something here. They earn no row of their own,
    // but a merchant deciding whether to write is owed the fact that three rules pointed at the same subject.
    supporting: jsonb("supporting")
      .$type<{ detector: string; verdict: string; evidence: string[] }[]>()
      .notNull()
      .default([]),
    // Where the finding sits in the ranked list, which is not the score order: rules take turns so that no single one
    // fills the list. Suppressed rows carry no rank because they form no list.
    rank: integer("rank"),
    isSuppressed: boolean("is_suppressed").notNull().default(false),
    score: doublePrecision("score").notNull().default(0),
    // What each part of the score was worth and what it measured, so a recommendation can be opened rather than
    // trusted. The total alone would be an unexplained number, which is the one thing this list must not be.
    scoreComponents: jsonb("score_components")
      .$type<{ name: string; value: number; reason: string }[]>()
      .notNull()
      .default([]),
    evidence: text("evidence")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // What a refresh is being asked to change, which the detector decides and generation must not have to re-infer.
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.importId, table.clusterId] }),
    foreignKey({
      columns: [table.tenantId, table.importId, table.clusterId],
      foreignColumns: [keywordClusters.tenantId, keywordClusters.importId, keywordClusters.clusterId],
      name: "keyword_opportunities_cluster_fk"
    }).onDelete("cascade"),
    check(
      "keyword_opportunities_verdict_check",
      sql`${table.verdict} in ('new_article', 'refresh', 'schedule', 'no_action')`
    ),
    index("keyword_opportunities_rank_idx").on(table.tenantId, table.importId, table.isSuppressed, table.rank)
  ]
)

/**
 * A cluster the merchant has said should never be written about, and why.
 *
 * Kept against the tenant rather than against an import, because a decision about the subject is not a decision about
 * one night's numbers, and a dismissal a merchant made would otherwise be undone by the next run.
 */
export const keywordClusterDismissals = blogWriterSchema.table(
  "keyword_cluster_dismissals",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    clusterId: text("cluster_id").notNull(),
    // The terms the cluster held when it was dismissed, so the row is still legible after clustering has moved on.
    headKeyword: text("head_keyword").notNull(),
    reason: text("reason").notNull().default(""),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.clusterId] })]
)

export const tenantBlogSubscriptions = blogWriterSchema.table(
  "tenant_blog_subscriptions",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    blogHostname: text("blog_hostname")
      .notNull()
      .references(() => blogs.hostname, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.blogHostname] })]
)

export const tenantJobs = blogWriterSchema.table(
  "tenant_jobs",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().defaultRandom(),
    jobType: text("job_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("queued"),
    cursor: jsonb("cursor").$type<Record<string, unknown>>(),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastErrorCode: text("last_error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.jobId] }),
    check(
      "tenant_jobs_type_check",
      sql`${table.jobType} in ('onboarding', 'catalog_sync', 'content_sync', 'indexing', 'reconciliation', 'idea_generation', 'draft_generation', 'crosslinks', 'further_reading', 'keyword_import')`
    ),
    check(
      "tenant_jobs_status_check",
      sql`${table.status} in ('queued', 'running', 'succeeded', 'failed', 'cancelled')`
    ),
    check("tenant_jobs_attempt_count_check", sql`${table.attemptCount} >= 0`),
    uniqueIndex("tenant_jobs_idempotency_uidx").on(table.tenantId, table.idempotencyKey),
    index("tenant_jobs_status_idx").on(table.tenantId, table.status, table.createdAt)
  ]
)

export const tenantResources = blogWriterSchema.table(
  "tenant_resources",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    resourceId: uuid("resource_id").notNull().defaultRandom(),
    shopifyGid: text("shopify_gid").notNull(),
    resourceType: text("resource_type").notNull(),
    title: text("title").notNull(),
    handle: text("handle").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    locale: text("locale").notNull(),
    description: text("description").notNull().default(""),
    content: text("content").notNull().default(""),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    isPublished: boolean("is_published").notNull().default(false),
    isAvailable: boolean("is_available").notNull().default(false),
    // Whether a resource still needs embedding is not recorded here. The chunk rows are the receipt for that work, so
    // asking them cannot drift from the truth the way a flag on this table did when a migration cleared the vectors
    // underneath it and left every resource claiming to be indexed.
    representationVersion: integer("representation_version").notNull().default(1),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    synchronizedAt: timestamp("synchronized_at", { withTimezone: true }).notNull(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.resourceId] }),
    check(
      "tenant_resources_type_check",
      sql`${table.resourceType} in ('product', 'collection', 'blog', 'article', 'page')`
    ),
    check("tenant_resources_representation_version_check", sql`${table.representationVersion} > 0`),
    check("tenant_resources_content_hash_check", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "tenant_resources_deactivated_check",
      sql`(${table.isActive} and ${table.deactivatedAt} is null) or (not ${table.isActive} and ${table.deactivatedAt} is not null)`
    ),
    uniqueIndex("tenant_resources_shopify_gid_uidx").on(table.tenantId, table.shopifyGid),
    uniqueIndex("tenant_resources_canonical_url_uidx").on(table.tenantId, table.canonicalUrl),
    index("tenant_resources_retrieval_idx").on(
      table.tenantId,
      table.isActive,
      table.isPublished,
      table.isAvailable,
      table.resourceType
    )
  ]
)

export const tenantResourceChunks = blogWriterSchema.table(
  "tenant_resource_chunks",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    chunkId: uuid("chunk_id").notNull().defaultRandom(),
    resourceId: uuid("resource_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    heading: text("heading"),
    content: text("content").notNull(),
    sourceHash: char("source_hash", { length: 64 }).notNull(),
    representationVersion: integer("representation_version").notNull(),
    embeddingModel: text("embedding_model"),
    embeddingVersion: text("embedding_version"),
    // Sized for openai/text-embedding-3-small truncated to 512 of its 1536 dimensions. The model is trained so that
    // the leading dimensions carry the most meaning, so a truncated and renormalized vector keeps almost all of its
    // retrieval quality at a third of the width. Half precision costs about 2e-5 per component, which is orders of
    // magnitude below the distance between a relevant and an irrelevant result. A different model or width means a new
    // embedding_version and a fresh backfill.
    embedding: halfvec("embedding", { dimensions: 512 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true })
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.chunkId] }),
    foreignKey({
      columns: [table.tenantId, table.resourceId],
      foreignColumns: [tenantResources.tenantId, tenantResources.resourceId],
      name: "tenant_resource_chunks_resource_fk"
    }).onDelete("cascade"),
    check("tenant_resource_chunks_ordinal_check", sql`${table.ordinal} >= 0`),
    check("tenant_resource_chunks_source_hash_check", sql`${table.sourceHash} ~ '^[0-9a-f]{64}$'`),
    check("tenant_resource_chunks_representation_version_check", sql`${table.representationVersion} > 0`),
    check(
      "tenant_resource_chunks_embedding_check",
      sql`(${table.embeddingModel} is null and ${table.embeddingVersion} is null and ${table.embedding} is null) or (${table.embeddingModel} is not null and ${table.embeddingVersion} is not null and ${table.embedding} is not null)`
    ),
    check(
      "tenant_resource_chunks_deactivated_check",
      sql`(${table.isActive} and ${table.deactivatedAt} is null) or (not ${table.isActive} and ${table.deactivatedAt} is not null)`
    ),
    uniqueIndex("tenant_resource_chunks_ordinal_uidx").on(
      table.tenantId,
      table.resourceId,
      table.representationVersion,
      table.ordinal
    ),
    index("tenant_resource_chunks_resource_idx").on(table.tenantId, table.resourceId, table.isActive),
    // Cosine distance, because embeddings are compared by direction rather than magnitude.
    index("tenant_resource_chunks_embedding_idx").using("hnsw", table.embedding.op("halfvec_cosine_ops"))
  ]
)

export const blogIdeas = blogWriterSchema.table(
  "blog_ideas",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    ideaId: uuid("idea_id").notNull().defaultRandom(),
    focus: text("focus").notNull(),
    title: text("title").notNull(),
    angle: text("angle").notNull(),
    targetKeyword: text("target_keyword").notNull(),
    // The cluster this idea was drawn from, which is what claims it. Nullable because an idea from a merchant's own
    // title has no cluster behind it, and that idea stays allowed and stays labelled as unverified rather than being
    // refused. It carries no foreign key: clusters are replaced wholesale by every import, and a claim must outlive
    // the run that suggested it.
    clusterId: text("cluster_id"),
    rationale: text("rationale").notNull(),
    status: text("status").notNull().default("proposed"),
    // The calendar day this idea is planned for. A plain date, because a merchant plans in store days, not instants.
    scheduledFor: date("scheduled_for"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.ideaId] }),
    check("blog_ideas_status_check", sql`${table.status} in ('proposed', 'selected', 'dismissed', 'drafted')`),
    uniqueIndex("blog_ideas_title_uidx").on(table.tenantId, table.title),
    index("blog_ideas_status_idx").on(table.tenantId, table.status, table.createdAt),
    // Serves the daily authoring run, which reads every tenant's ideas for one day.
    index("blog_ideas_scheduled_idx").on(table.scheduledFor, table.status)
  ]
)

export const blogDrafts = blogWriterSchema.table(
  "blog_drafts",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    draftId: uuid("draft_id").notNull().defaultRandom(),
    ideaId: uuid("idea_id").notNull(),
    destinationBlogGid: text("destination_blog_gid"),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    excerpt: text("excerpt").notNull().default(""),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    status: text("status").notNull().default("generating"),
    shopifyArticleGid: text("shopify_article_gid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.draftId] }),
    foreignKey({
      columns: [table.tenantId, table.ideaId],
      foreignColumns: [blogIdeas.tenantId, blogIdeas.ideaId],
      name: "blog_drafts_idea_fk"
    }).onDelete("restrict"),
    check("blog_drafts_content_hash_check", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "blog_drafts_status_check",
      sql`${table.status} in ('generating', 'review', 'approved', 'published', 'failed')`
    ),
    uniqueIndex("blog_drafts_idea_uidx").on(table.tenantId, table.ideaId),
    index("blog_drafts_status_idx").on(table.tenantId, table.status, table.updatedAt)
  ]
)

// Articles point at their revisions and revisions point back, so the reference is resolved lazily to break the cycle.
function articleRevisionKey(): [AnyPgColumn, AnyPgColumn] {
  return [articleRevisions.tenantId, articleRevisions.revisionId]
}

export const articles = blogWriterSchema.table(
  "articles",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    articleId: uuid("article_id").notNull().defaultRandom(),
    ideaId: uuid("idea_id").notNull(),
    // Temporary bridge to the workflow landing table; removed once generation returns content instead of writing it.
    draftId: uuid("draft_id"),
    destinationBlogGid: text("destination_blog_gid"),
    status: text("status").notNull().default("draft"),
    currentRevisionId: uuid("current_revision_id"),
    publishedRevisionId: uuid("published_revision_id"),
    shopifyArticleGid: text("shopify_article_gid"),
    shopifyArticleUrl: text("shopify_article_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.articleId] }),
    foreignKey({
      columns: [table.tenantId, table.ideaId],
      foreignColumns: [blogIdeas.tenantId, blogIdeas.ideaId],
      name: "articles_idea_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.draftId],
      foreignColumns: [blogDrafts.tenantId, blogDrafts.draftId],
      name: "articles_draft_fk"
    }).onDelete("set null"),
    foreignKey({
      columns: [table.tenantId, table.currentRevisionId],
      foreignColumns: articleRevisionKey(),
      name: "articles_current_revision_fk"
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.publishedRevisionId],
      foreignColumns: articleRevisionKey(),
      name: "articles_published_revision_fk"
    }).onDelete("restrict"),
    check(
      "articles_status_check",
      sql`${table.status} in ('draft', 'needs_review', 'ready_to_publish', 'published', 'needs_attention', 'failed')`
    ),
    check(
      "articles_published_revision_check",
      sql`${table.publishedRevisionId} is null or ${table.currentRevisionId} is not null`
    ),
    uniqueIndex("articles_draft_uidx")
      .on(table.tenantId, table.draftId)
      .where(sql`${table.draftId} is not null`),
    index("articles_status_idx").on(table.tenantId, table.status, table.updatedAt),
    index("articles_updated_idx").on(table.tenantId, table.updatedAt)
  ]
)

export const articleRevisions = blogWriterSchema.table(
  "article_revisions",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    revisionId: uuid("revision_id").notNull().defaultRandom(),
    articleId: uuid("article_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    origin: text("origin").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    author: text("author").notNull().default(""),
    handle: text("handle").notNull().default(""),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    imageUrl: text("image_url"),
    imageAltText: text("image_alt_text").notNull().default(""),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.revisionId] }),
    foreignKey({
      columns: [table.tenantId, table.articleId],
      foreignColumns: [articles.tenantId, articles.articleId],
      name: "article_revisions_article_fk"
    }).onDelete("cascade"),
    check("article_revisions_origin_check", sql`${table.origin} in ('generated', 'edited', 'regenerated', 'imported')`),
    check("article_revisions_number_check", sql`${table.revisionNumber} > 0`),
    check("article_revisions_content_hash_check", sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "article_revisions_handle_check",
      sql`${table.handle} = '' or ${table.handle} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`
    ),
    uniqueIndex("article_revisions_number_uidx").on(table.tenantId, table.articleId, table.revisionNumber),
    index("article_revisions_article_idx").on(table.tenantId, table.articleId, table.createdAt)
  ]
)

export const articlePublicationEvents = blogWriterSchema.table(
  "article_publication_events",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    eventId: uuid("event_id").notNull().defaultRandom(),
    articleId: uuid("article_id").notNull(),
    revisionId: uuid("revision_id").notNull(),
    eventType: text("event_type").notNull(),
    shopifyArticleGid: text("shopify_article_gid"),
    shopifyArticleUrl: text("shopify_article_url"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.eventId] }),
    foreignKey({
      columns: [table.tenantId, table.articleId],
      foreignColumns: [articles.tenantId, articles.articleId],
      name: "article_publication_events_article_fk"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.revisionId],
      foreignColumns: [articleRevisions.tenantId, articleRevisions.revisionId],
      name: "article_publication_events_revision_fk"
    }).onDelete("restrict"),
    check(
      "article_publication_events_type_check",
      sql`${table.eventType} in ('shopify_draft_saved', 'published', 'unpublished')`
    ),
    index("article_publication_events_article_idx").on(table.tenantId, table.articleId, table.occurredAt)
  ]
)

export const blogRecommendations = blogWriterSchema.table(
  "blog_recommendations",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenantStores.tenantId, { onDelete: "cascade" }),
    recommendationId: uuid("recommendation_id").notNull().defaultRandom(),
    articleId: uuid("article_id"),
    draftId: uuid("draft_id").notNull(),
    destinationResourceId: uuid("destination_resource_id").notNull(),
    destinationType: text("destination_type"),
    objective: text("objective").notNull(),
    sourceRevision: char("source_revision", { length: 64 }).notNull(),
    sectionLocator: text("section_locator").notNull(),
    anchorText: text("anchor_text").notNull(),
    rationale: text("rationale").notNull(),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    ranker: text("ranker").notNull(),
    status: text("status").notNull().default("proposed"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.recommendationId] }),
    foreignKey({
      columns: [table.tenantId, table.articleId],
      foreignColumns: [articles.tenantId, articles.articleId],
      name: "blog_recommendations_article_fk"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.draftId],
      foreignColumns: [blogDrafts.tenantId, blogDrafts.draftId],
      name: "blog_recommendations_draft_fk"
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.destinationResourceId],
      foreignColumns: [tenantResources.tenantId, tenantResources.resourceId],
      name: "blog_recommendations_destination_fk"
    }).onDelete("restrict"),
    check(
      "blog_recommendations_objective_check",
      sql`${table.objective} in ('commercial_crosslink', 'further_reading')`
    ),
    check(
      "blog_recommendations_article_type_check",
      sql`(${table.articleId} is null and ${table.destinationType} is null) or (${table.articleId} is not null and ${table.destinationType} is not null)`
    ),
    check(
      "blog_recommendations_destination_type_check",
      sql`${table.destinationType} is null or ${table.destinationType} in ('product', 'collection', 'blog', 'article', 'page')`
    ),
    check(
      "blog_recommendations_further_reading_type_check",
      sql`${table.objective} <> 'further_reading' or ${table.destinationType} is null or ${table.destinationType} = 'article'`
    ),
    check("blog_recommendations_revision_check", sql`${table.sourceRevision} ~ '^[0-9a-f]{64}$'`),
    check(
      "blog_recommendations_status_check",
      sql`${table.status} in ('proposed', 'accepted', 'rejected', 'stale', 'applied')`
    ),
    uniqueIndex("blog_recommendations_destination_uidx").on(
      table.tenantId,
      table.draftId,
      table.objective,
      table.destinationResourceId
    ),
    uniqueIndex("blog_recommendations_article_destination_uidx")
      .on(table.tenantId, table.articleId, table.objective, table.destinationResourceId)
      .where(sql`${table.articleId} is not null`),
    index("blog_recommendations_article_review_idx").on(table.tenantId, table.articleId, table.status),
    index("blog_recommendations_review_idx").on(table.tenantId, table.draftId, table.status)
  ]
)
