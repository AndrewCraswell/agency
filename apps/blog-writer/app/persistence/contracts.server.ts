import { isIP } from "node:net"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import {
  articlePublicationEvents,
  articleRevisions,
  articles,
  blogs,
  blogDrafts,
  blogIdeas,
  blogRecommendations,
  tenantBlogSubscriptions,
  tenantCompetitorDomains,
  tenantJobs,
  tenantResourceChunks,
  tenantResources,
  tenantStores
} from "./schema.server"

const Sha256DigestSchema = z.string().regex(/^[0-9a-f]{64}$/u)
const ShopDomainSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/u)
const HostnameSchema = z.string().regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/u)
const LocaleSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/u)
const TenantJobTypeSchema = z.enum([
  "onboarding",
  "catalog_sync",
  "content_sync",
  "indexing",
  "reconciliation",
  "idea_generation",
  "draft_generation",
  "crosslinks",
  "further_reading",
  "keyword_import"
])
const TenantResourceTypeSchema = z.enum(["product", "collection", "blog", "article", "page"])
const RecommendationObjectiveSchema = z.enum(["commercial_crosslink", "further_reading"])
const ArticleStatusSchema = z.enum([
  "draft",
  "needs_review",
  "ready_to_publish",
  "published",
  "needs_attention",
  "failed"
])
const ArticleRevisionOriginSchema = z.enum(["generated", "edited", "regenerated", "imported"])
const ArticlePublicationEventTypeSchema = z.enum(["shopify_draft_saved", "published", "unpublished"])

export const TenantStoreRecordSchema = createSelectSchema(tenantStores, {
  shopDomain: ShopDomainSchema,
  status: z.enum(["active", "uninstalled"]),
  syncStatus: z.enum(["pending", "syncing", "ready", "failed"])
})
export const TenantJobRecordSchema = createSelectSchema(tenantJobs, {
  jobType: TenantJobTypeSchema,
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"])
})
export const TenantResourceRecordSchema = createSelectSchema(tenantResources, {
  resourceType: TenantResourceTypeSchema,
  canonicalUrl: z.url(),
  locale: LocaleSchema,
  contentHash: Sha256DigestSchema
})
export const BlogIdeaRecordSchema = createSelectSchema(blogIdeas, {
  status: z.enum(["proposed", "selected", "dismissed", "drafted"])
})
export const BlogDraftRecordSchema = createSelectSchema(blogDrafts, {
  contentHash: Sha256DigestSchema,
  status: z.enum(["generating", "review", "approved", "published", "failed"])
})
export const ArticleRecordSchema = createSelectSchema(articles, {
  status: ArticleStatusSchema
})
export const ArticleRevisionRecordSchema = createSelectSchema(articleRevisions, {
  origin: ArticleRevisionOriginSchema,
  contentHash: Sha256DigestSchema
})
export const ArticlePublicationEventRecordSchema = createSelectSchema(articlePublicationEvents, {
  eventType: ArticlePublicationEventTypeSchema
})
export const BlogRecommendationRecordSchema = createSelectSchema(blogRecommendations, {
  objective: RecommendationObjectiveSchema,
  sourceRevision: Sha256DigestSchema,
  status: z.enum(["proposed", "accepted", "rejected", "stale", "applied"])
})
export const BlogRecordSchema = createSelectSchema(blogs, {
  hostname: HostnameSchema,
  url: z.url()
})
export const TenantCompetitorDomainRecordSchema = createSelectSchema(tenantCompetitorDomains, {
  hostname: HostnameSchema
})
export const TenantBlogSubscriptionRecordSchema = createSelectSchema(tenantBlogSubscriptions, {
  blogHostname: HostnameSchema
})

/**
 * Parses an address a merchant typed into a hostname and a normalized URL, rejecting anything that
 * is not a plain public web address. Credentials, ports, raw IPs, and loopback names are refused
 * because the app fetches these addresses server side, and an unchecked one would let a merchant
 * point the server at infrastructure only the server can reach.
 */
export function parsePublicHttpUrl(value: string) {
  const trimmedValue = value.trim()
  const address = /^[a-z][a-z\d+.-]*:/iu.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`
  const url = new URL(address)
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== ""
  ) {
    throw new Error("Address must use HTTP or HTTPS without credentials or a port")
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./u, "")
  if (hostname === "localhost" || isIP(hostname) !== 0) {
    throw new Error("Address must use a public domain")
  }
  HostnameSchema.parse(hostname)
  url.hostname = hostname
  url.hash = ""
  url.search = ""

  return { hostname, url: url.toString() }
}

export const CompetitorDomainInputSchema = z.string().transform((value, context) => {
  try {
    return parsePublicHttpUrl(value).hostname
  } catch {
    context.addIssue({ code: "custom", message: "Enter a valid competitor domain" })
    return z.NEVER
  }
})

/**
 * Reduces the hostnames Shopify reports for a storefront to the same shape subscribed blog
 * hostnames are stored in, so the two can be compared directly.
 */
export function normalizeOwnedDomains(values: string[]) {
  const normalized = values
    .map((value) =>
      value
        .trim()
        .toLowerCase()
        .replace(/^www\./u, "")
    )
    .filter(Boolean)
  return [...new Set(normalized)].sort()
}

/**
 * True when a blog belongs to the store itself. Subdomains count, because a merchant whose
 * storefront is example.com also owns blog.example.com, and following either would make the
 * generator cite the store's own writing back to it as though it were independent prior art.
 */
export function isOwnedDomain(hostname: string, ownedDomains: string[]) {
  const candidate = hostname
    .trim()
    .toLowerCase()
    .replace(/^www\./u, "")
  return normalizeOwnedDomains(ownedDomains).some((owned) => candidate === owned || candidate.endsWith(`.${owned}`))
}

export const BlogAddressInputSchema = z.string().transform((value, context) => {
  try {
    return parsePublicHttpUrl(value)
  } catch {
    context.addIssue({ code: "custom", message: "Enter a valid blog address" })
    return z.NEVER
  }
})

export const CreateTenantStoreSchema = createInsertSchema(tenantStores, {
  shopDomain: ShopDomainSchema
}).pick({ shopDomain: true, shopName: true })
export const EnqueueTenantJobSchema = createInsertSchema(tenantJobs, {
  jobType: TenantJobTypeSchema
}).pick({ tenantId: true, jobType: true, idempotencyKey: true, cursor: true })
export const UpsertTenantResourceSchema = createInsertSchema(tenantResources, {
  resourceType: TenantResourceTypeSchema,
  canonicalUrl: z.url(),
  locale: LocaleSchema,
  contentHash: Sha256DigestSchema
}).pick({
  tenantId: true,
  shopifyGid: true,
  resourceType: true,
  title: true,
  handle: true,
  canonicalUrl: true,
  locale: true,
  description: true,
  content: true,
  metadata: true,
  isActive: true,
  isPublished: true,
  isAvailable: true,
  contentHash: true,
  sourceCreatedAt: true,
  sourceUpdatedAt: true,
  synchronizedAt: true
})
export const StoreTenantResourceChunkSchema = createInsertSchema(tenantResourceChunks, {
  sourceHash: Sha256DigestSchema
})
  .pick({
    tenantId: true,
    resourceId: true,
    ordinal: true,
    heading: true,
    content: true,
    sourceHash: true,
    representationVersion: true,
    embeddingModel: true,
    embeddingVersion: true
  })
  .refine(
    ({ embeddingModel, embeddingVersion }) =>
      (embeddingModel === null && embeddingVersion === null) || (embeddingModel !== null && embeddingVersion !== null),
    { message: "Embedding model and version must be provided together" }
  )
export const CreateBlogIdeaSchema = createInsertSchema(blogIdeas).pick({
  tenantId: true,
  focus: true,
  title: true,
  angle: true,
  targetKeyword: true,
  rationale: true
})
export const CreateBlogDraftSchema = createInsertSchema(blogDrafts, {
  contentHash: Sha256DigestSchema
}).pick({
  tenantId: true,
  ideaId: true,
  destinationBlogGid: true,
  title: true,
  content: true,
  excerpt: true,
  contentHash: true,
  status: true
})
export const CreateArticleSchema = createInsertSchema(articles, {
  status: ArticleStatusSchema
}).pick({
  tenantId: true,
  ideaId: true,
  draftId: true,
  destinationBlogGid: true,
  status: true
})
export const CreateArticleRevisionSchema = createInsertSchema(articleRevisions, {
  origin: ArticleRevisionOriginSchema,
  contentHash: Sha256DigestSchema
}).pick({
  tenantId: true,
  articleId: true,
  revisionNumber: true,
  origin: true,
  title: true,
  excerpt: true,
  body: true,
  tags: true,
  contentHash: true
})
export const CreateArticlePublicationEventSchema = createInsertSchema(articlePublicationEvents, {
  eventType: ArticlePublicationEventTypeSchema
}).pick({
  tenantId: true,
  articleId: true,
  revisionId: true,
  eventType: true,
  shopifyArticleGid: true,
  shopifyArticleUrl: true
})
export const CreateBlogRecommendationSchema = createInsertSchema(blogRecommendations, {
  objective: RecommendationObjectiveSchema,
  sourceRevision: Sha256DigestSchema
}).pick({
  tenantId: true,
  draftId: true,
  destinationResourceId: true,
  objective: true,
  sourceRevision: true,
  sectionLocator: true,
  anchorText: true,
  rationale: true,
  evidence: true,
  ranker: true
})
export const AddTenantCompetitorDomainSchema = createInsertSchema(tenantCompetitorDomains, {
  hostname: HostnameSchema
}).pick({ tenantId: true, hostname: true })
export const AddTenantBlogSubscriptionSchema = createInsertSchema(tenantBlogSubscriptions, {
  blogHostname: HostnameSchema
}).pick({ tenantId: true, blogHostname: true })

export type TenantStoreRecord = z.infer<typeof TenantStoreRecordSchema>
export type TenantResourceRecord = z.infer<typeof TenantResourceRecordSchema>
export type BlogIdeaRecord = z.infer<typeof BlogIdeaRecordSchema>
export type BlogDraftRecord = z.infer<typeof BlogDraftRecordSchema>
export type ArticleRecord = z.infer<typeof ArticleRecordSchema>
export type BlogRecommendationRecord = z.infer<typeof BlogRecommendationRecordSchema>
export type UpsertTenantResource = z.infer<typeof UpsertTenantResourceSchema>
