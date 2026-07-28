import { and, count, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm"
import { z } from "zod"
import type { ArticleStatus } from "./article-repository.server"
import { CreateTenantStoreSchema } from "./contracts.server"
import { database } from "./database.server"
import {
  articleRevisions,
  articles,
  blogDrafts,
  blogIdeas,
  blogRecommendations,
  tenantResources,
  tenantStores
} from "./schema.server"

const IdentifierSchema = z.uuid()
/** A plain calendar day, the unit the editorial calendar plans in. */
const CalendarDaySchema = z.iso.date()
const RecommendationDecisionSchema = z.enum(["accepted", "rejected"])
const IdeaStatusSchema = z.enum(["proposed", "selected", "dismissed", "drafted"])
const DraftStatusSchema = z.enum(["generating", "review", "approved", "published", "failed"])
const ArticleStatusSchema = z.enum([
  "draft",
  "needs_review",
  "ready_to_publish",
  "published",
  "needs_attention",
  "failed"
])
const RecommendationObjectiveSchema = z.enum(["commercial_crosslink", "further_reading"])
const RecommendationStatusSchema = z.enum(["proposed", "accepted", "rejected", "stale", "applied"])
const DestinationTypeSchema = z.enum(["product", "collection", "blog", "article", "page"])

type DestinationType = z.infer<typeof DestinationTypeSchema>

export type LinkTypeCounts = Record<DestinationType, number>

export type BlogWorkspace = {
  ideas: {
    ideaId: string
    title: string
    angle: string
    targetKeyword: string
    rationale: string
    status: "proposed" | "selected" | "dismissed" | "drafted"
    scheduledFor: string | null
    articleId: string | null
  }[]
  draft: {
    draftId: string
    ideaId: string
    title: string
    content: string
    excerpt: string
    status: "generating" | "review" | "approved" | "published" | "failed"
    updatedAt: string
  } | null
  recommendations: {
    recommendationId: string
    objective: "commercial_crosslink" | "further_reading"
    sectionLocator: string
    anchorText: string
    rationale: string
    status: "proposed" | "accepted" | "rejected" | "stale" | "applied"
    destinationTitle: string
    destinationUrl: string
    destinationType: DestinationType
  }[]
}

export type ArticleSummary = {
  articleId: string
  title: string
  excerpt: string
  status: ArticleStatus
  updatedAt: string
  linkTypeCounts: LinkTypeCounts
}

export type DestinationBlog = {
  blogGid: string
  title: string
  handle: string
}

export type StoreProfile = {
  name: string
  domain: string
}

export type ArticleDetail = {
  articleId: string
  title: string
  excerpt: string
  content: string
  tags: string[]
  author: string
  handle: string
  seoTitle: string
  seoDescription: string
  imageUrl: string | null
  imageAltText: string
  status: ArticleStatus
  updatedAt: string
  currentRevisionId: string | null
  publishedRevisionId: string | null
  destinationBlogGid: string | null
  shopifyArticleGid: string | null
  shopifyArticleUrl: string | null
  recommendations: BlogWorkspace["recommendations"]
}

function createEmptyLinkTypeCounts(): LinkTypeCounts {
  return { product: 0, collection: 0, blog: 0, article: 0, page: 0 }
}

export async function getTenantIdForShop(shopDomain: string) {
  const { shopDomain: parsedShopDomain } = CreateTenantStoreSchema.parse({ shopDomain, shopName: "" })
  const [tenant] = await database
    .select({ tenantId: tenantStores.tenantId })
    .from(tenantStores)
    .where(and(eq(tenantStores.shopDomain, parsedShopDomain), eq(tenantStores.status, "active")))
    .limit(1)

  return tenant?.tenantId ?? null
}

/** The store as a reader sees it, for the parts of the editor that show what an address or a listing will look like. */
export async function getStoreProfile(shopDomain: string): Promise<StoreProfile> {
  const { shopDomain: parsedShopDomain } = CreateTenantStoreSchema.parse({ shopDomain, shopName: "" })
  const [store] = await database
    .select({ name: tenantStores.shopName })
    .from(tenantStores)
    .where(and(eq(tenantStores.shopDomain, parsedShopDomain), eq(tenantStores.status, "active")))
    .limit(1)

  return {
    name: store?.name === undefined || store.name === "" ? parsedShopDomain : store.name,
    domain: parsedShopDomain
  }
}

export async function getBlogWorkspace(shopDomain: string): Promise<BlogWorkspace> {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return { ideas: [], draft: null, recommendations: [] }
  }

  const ideas = await database
    .select({
      ideaId: blogIdeas.ideaId,
      title: blogIdeas.title,
      angle: blogIdeas.angle,
      targetKeyword: blogIdeas.targetKeyword,
      rationale: blogIdeas.rationale,
      status: blogIdeas.status,
      scheduledFor: blogIdeas.scheduledFor,
      // Once a post exists the calendar shows the post in place of the idea it grew from.
      articleId: articles.articleId
    })
    .from(blogIdeas)
    .leftJoin(articles, and(eq(articles.tenantId, blogIdeas.tenantId), eq(articles.ideaId, blogIdeas.ideaId)))
    .where(eq(blogIdeas.tenantId, tenantId))
    .orderBy(desc(blogIdeas.createdAt))
  const parsedIdeas = ideas.map((idea) => ({ ...idea, status: IdeaStatusSchema.parse(idea.status) }))

  const [draftRecord] = await database
    .select({
      draftId: blogDrafts.draftId,
      ideaId: blogDrafts.ideaId,
      title: blogDrafts.title,
      content: blogDrafts.content,
      excerpt: blogDrafts.excerpt,
      status: blogDrafts.status,
      updatedAt: blogDrafts.updatedAt
    })
    .from(blogDrafts)
    .where(eq(blogDrafts.tenantId, tenantId))
    .orderBy(desc(blogDrafts.updatedAt))
    .limit(1)

  if (draftRecord === undefined) {
    return { ideas: parsedIdeas, draft: null, recommendations: [] }
  }

  const recommendations = await database
    .select({
      recommendationId: blogRecommendations.recommendationId,
      objective: blogRecommendations.objective,
      sectionLocator: blogRecommendations.sectionLocator,
      anchorText: blogRecommendations.anchorText,
      rationale: blogRecommendations.rationale,
      status: blogRecommendations.status,
      destinationTitle: tenantResources.title,
      destinationUrl: tenantResources.canonicalUrl,
      destinationType: tenantResources.resourceType
    })
    .from(blogRecommendations)
    .innerJoin(
      tenantResources,
      and(
        eq(tenantResources.tenantId, blogRecommendations.tenantId),
        eq(tenantResources.resourceId, blogRecommendations.destinationResourceId)
      )
    )
    .where(and(eq(blogRecommendations.tenantId, tenantId), eq(blogRecommendations.draftId, draftRecord.draftId)))
    .orderBy(blogRecommendations.objective, blogRecommendations.createdAt)
  const parsedRecommendations = recommendations.map((recommendation) => ({
    ...recommendation,
    destinationType: DestinationTypeSchema.parse(recommendation.destinationType),
    objective: RecommendationObjectiveSchema.parse(recommendation.objective),
    status: RecommendationStatusSchema.parse(recommendation.status)
  }))

  return {
    ideas: parsedIdeas,
    draft: {
      ...draftRecord,
      status: DraftStatusSchema.parse(draftRecord.status),
      updatedAt: draftRecord.updatedAt.toISOString()
    },
    recommendations: parsedRecommendations
  }
}

async function requireTenantId(shopDomain: string) {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    throw new Error("Store content must be synchronized before writing")
  }
  return tenantId
}

export async function listArticles(shopDomain: string): Promise<ArticleSummary[]> {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return []
  }

  const articleRecords = await database
    .select({
      articleId: articles.articleId,
      title: articleRevisions.title,
      excerpt: articleRevisions.excerpt,
      status: articles.status,
      updatedAt: articles.updatedAt
    })
    .from(articles)
    .innerJoin(
      articleRevisions,
      and(eq(articleRevisions.tenantId, articles.tenantId), eq(articleRevisions.revisionId, articles.currentRevisionId))
    )
    .where(eq(articles.tenantId, tenantId))
    .orderBy(desc(articles.updatedAt))
  const countsByArticle = new Map<string, LinkTypeCounts>()
  if (articleRecords.length > 0) {
    const linkRecords = await database
      .select({ articleId: blogRecommendations.articleId, destinationType: blogRecommendations.destinationType })
      .from(blogRecommendations)
      .where(
        and(
          eq(blogRecommendations.tenantId, tenantId),
          inArray(
            blogRecommendations.articleId,
            articleRecords.map(({ articleId }) => articleId)
          ),
          notInArray(blogRecommendations.status, ["rejected", "stale"])
        )
      )
    for (const link of linkRecords) {
      if (link.articleId === null || link.destinationType === null) {
        continue
      }
      const destinationType = DestinationTypeSchema.parse(link.destinationType)
      const counts = countsByArticle.get(link.articleId) ?? createEmptyLinkTypeCounts()
      counts[destinationType] += 1
      countsByArticle.set(link.articleId, counts)
    }
  }

  return articleRecords.map((article) => ({
    ...article,
    status: ArticleStatusSchema.parse(article.status),
    updatedAt: article.updatedAt.toISOString(),
    linkTypeCounts: countsByArticle.get(article.articleId) ?? createEmptyLinkTypeCounts()
  }))
}

export async function getArticleDetail(shopDomain: string, articleId: string): Promise<ArticleDetail | null> {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return null
  }
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const [article] = await database
    .select({
      articleId: articles.articleId,
      title: articleRevisions.title,
      excerpt: articleRevisions.excerpt,
      content: articleRevisions.body,
      tags: articleRevisions.tags,
      author: articleRevisions.author,
      handle: articleRevisions.handle,
      seoTitle: articleRevisions.seoTitle,
      seoDescription: articleRevisions.seoDescription,
      imageUrl: articleRevisions.imageUrl,
      imageAltText: articleRevisions.imageAltText,
      status: articles.status,
      updatedAt: articles.updatedAt,
      currentRevisionId: articles.currentRevisionId,
      publishedRevisionId: articles.publishedRevisionId,
      destinationBlogGid: articles.destinationBlogGid,
      shopifyArticleGid: articles.shopifyArticleGid,
      shopifyArticleUrl: articles.shopifyArticleUrl
    })
    .from(articles)
    .innerJoin(
      articleRevisions,
      and(eq(articleRevisions.tenantId, articles.tenantId), eq(articleRevisions.revisionId, articles.currentRevisionId))
    )
    .where(and(eq(articles.tenantId, tenantId), eq(articles.articleId, parsedArticleId)))
    .limit(1)
  if (article === undefined) {
    return null
  }

  const recommendationRecords = await database
    .select({
      recommendationId: blogRecommendations.recommendationId,
      objective: blogRecommendations.objective,
      sectionLocator: blogRecommendations.sectionLocator,
      anchorText: blogRecommendations.anchorText,
      rationale: blogRecommendations.rationale,
      status: blogRecommendations.status,
      destinationTitle: tenantResources.title,
      destinationUrl: tenantResources.canonicalUrl,
      destinationType: blogRecommendations.destinationType,
      resourceType: tenantResources.resourceType
    })
    .from(blogRecommendations)
    .innerJoin(
      tenantResources,
      and(
        eq(tenantResources.tenantId, blogRecommendations.tenantId),
        eq(tenantResources.resourceId, blogRecommendations.destinationResourceId)
      )
    )
    .where(
      and(
        eq(blogRecommendations.tenantId, tenantId),
        eq(blogRecommendations.articleId, parsedArticleId),
        notInArray(blogRecommendations.status, ["rejected", "stale"])
      )
    )
    .orderBy(blogRecommendations.objective, blogRecommendations.createdAt)
  const recommendations = recommendationRecords.map(({ resourceType, ...recommendation }) => {
    const destinationType = DestinationTypeSchema.parse(recommendation.destinationType)
    if (destinationType !== resourceType) {
      throw new Error("Recommendation destination type does not match its resource")
    }
    return {
      ...recommendation,
      destinationType,
      objective: RecommendationObjectiveSchema.parse(recommendation.objective),
      status: RecommendationStatusSchema.parse(recommendation.status)
    }
  })

  return {
    ...article,
    status: ArticleStatusSchema.parse(article.status),
    updatedAt: article.updatedAt.toISOString(),
    recommendations
  }
}

/** Lists the synchronized blogs an article can publish to, so the merchant picks a destination the store already has. */
export async function listDestinationBlogs(shopDomain: string): Promise<DestinationBlog[]> {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return []
  }
  const blogRecords = await database
    .select({ blogGid: tenantResources.shopifyGid, title: tenantResources.title, handle: tenantResources.handle })
    .from(tenantResources)
    .where(
      and(
        eq(tenantResources.tenantId, tenantId),
        eq(tenantResources.resourceType, "blog"),
        eq(tenantResources.isActive, true)
      )
    )
    .orderBy(tenantResources.title)
  return blogRecords
}

/** How many names the author field offers, because a longer list is quicker to scroll past than to read. */
const AUTHOR_SUGGESTION_LIMIT = 50

/**
 * The names this store already publishes under, gathered from its Shopify articles and from drafts written here.
 * Shopify only lists staff accounts to apps holding `read_users`, which is a Plus-only scope, so the bylines the
 * store has actually used stand in for the staff directory.
 */
export async function listAuthorSuggestions(shopDomain: string): Promise<string[]> {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return []
  }
  const [storefrontAuthors, draftAuthors] = await Promise.all([
    database
      .selectDistinct({ name: sql<string | null>`${tenantResources.metadata}->>'authorName'` })
      .from(tenantResources)
      .where(
        and(
          eq(tenantResources.tenantId, tenantId),
          eq(tenantResources.resourceType, "article"),
          eq(tenantResources.isActive, true)
        )
      ),
    database
      .selectDistinct({ name: articleRevisions.author })
      .from(articleRevisions)
      .where(eq(articleRevisions.tenantId, tenantId))
  ])

  // The same person can be spelled with different capitalization across sources, so the first spelling seen wins.
  const namesByComparison = new Map<string, string>()
  for (const { name } of [...storefrontAuthors, ...draftAuthors]) {
    const trimmed = name?.trim() ?? ""
    if (trimmed !== "" && !namesByComparison.has(trimmed.toLowerCase())) {
      namesByComparison.set(trimmed.toLowerCase(), trimmed)
    }
  }
  return [...namesByComparison.values()]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, AUTHOR_SUGGESTION_LIMIT)
}

export type LinkableResource = {
  resourceId: string
  resourceType: DestinationType
  title: string
  url: string
}

const SearchTermSchema = z.string().trim().min(1).max(100)

/** Postgres treats these as wildcards, so a merchant typing one gets it matched literally rather than broadening. */
function escapeLikeWildcards(term: string) {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`)
}

/**
 * Finds storefront resources an article can link at, matched on title or handle.
 * This reads the synchronized catalogue rather than the Admin API so the crosslink picker keeps up with typing and
 * never spends a merchant's API budget on a keystroke.
 */
export async function searchLinkableResources(shopDomain: string, term: string): Promise<LinkableResource[]> {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return []
  }
  const parsedTerm = SearchTermSchema.safeParse(term)
  if (!parsedTerm.success) {
    return []
  }
  const pattern = `%${escapeLikeWildcards(parsedTerm.data)}%`
  const records = await database
    .select({
      resourceId: tenantResources.resourceId,
      resourceType: tenantResources.resourceType,
      title: tenantResources.title,
      url: tenantResources.canonicalUrl
    })
    .from(tenantResources)
    .where(
      and(
        eq(tenantResources.tenantId, tenantId),
        eq(tenantResources.isActive, true),
        or(ilike(tenantResources.title, pattern), ilike(tenantResources.handle, pattern))
      )
    )
    .orderBy(tenantResources.resourceType, tenantResources.title)
    .limit(10)
  return records.map((record) => ({
    ...record,
    resourceType: DestinationTypeSchema.parse(record.resourceType)
  }))
}

/**
 * How many storefront destinations a suggestion could honestly point at.
 * These counts apply the same live-on-the-storefront rule the recommendation workflows use, so an empty suggestion
 * panel can tell a merchant whether the writer found nothing worth linking or the store has nothing to link at.
 */
export async function countLinkableDestinations(shopDomain: string) {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return { commercial: 0, reading: 0 }
  }
  const records = await database
    .select({ resourceType: tenantResources.resourceType, total: count() })
    .from(tenantResources)
    .where(
      and(
        eq(tenantResources.tenantId, tenantId),
        eq(tenantResources.isActive, true),
        eq(tenantResources.isPublished, true),
        eq(tenantResources.isAvailable, true),
        inArray(tenantResources.resourceType, ["product", "collection", "article"])
      )
    )
    .groupBy(tenantResources.resourceType)
  const totals = new Map(records.map(({ resourceType, total }) => [resourceType, total]))
  const tally = (resourceType: string) => totals.get(resourceType) ?? 0
  return { commercial: tally("product") + tally("collection"), reading: tally("article") }
}

export async function getArticleWorkflowIdentity(shopDomain: string, articleId: string) {
  const tenantId = await requireTenantId(shopDomain)
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const [article] = await database
    .select({ draftId: articles.draftId })
    .from(articles)
    .where(and(eq(articles.tenantId, tenantId), eq(articles.articleId, parsedArticleId)))
    .limit(1)
  if (article === undefined) {
    throw new Error("Article could not be found")
  }
  if (article.draftId === null) {
    throw new Error("Article has no workflow draft")
  }
  return { tenantId, articleId: parsedArticleId, draftId: article.draftId }
}

/** Resolves the topic an article grew from, which is what a fresh generation run needs as its starting point. */
export async function getArticleIdeaIdentity(shopDomain: string, articleId: string) {
  const tenantId = await requireTenantId(shopDomain)
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const [article] = await database
    .select({ ideaId: articles.ideaId })
    .from(articles)
    .where(and(eq(articles.tenantId, tenantId), eq(articles.articleId, parsedArticleId)))
    .limit(1)
  if (article === undefined) {
    throw new Error("Article could not be found")
  }
  return { tenantId, articleId: parsedArticleId, ideaId: article.ideaId }
}

export async function attachDraftRecommendations(tenantId: string, articleId: string, draftId: string) {
  const parsedTenantId = IdentifierSchema.parse(tenantId)
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const parsedDraftId = IdentifierSchema.parse(draftId)
  await database.transaction(async (transaction) => {
    const [article] = await transaction
      .select({ draftId: articles.draftId })
      .from(articles)
      .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId)))
      .limit(1)
    if (article?.draftId !== parsedDraftId) {
      throw new Error("Article does not own the workflow draft")
    }

    const recommendations = await transaction
      .select({
        recommendationId: blogRecommendations.recommendationId,
        objective: blogRecommendations.objective,
        destinationType: tenantResources.resourceType
      })
      .from(blogRecommendations)
      .innerJoin(
        tenantResources,
        and(
          eq(tenantResources.tenantId, blogRecommendations.tenantId),
          eq(tenantResources.resourceId, blogRecommendations.destinationResourceId)
        )
      )
      .where(and(eq(blogRecommendations.tenantId, parsedTenantId), eq(blogRecommendations.draftId, parsedDraftId)))

    for (const recommendation of recommendations) {
      if (recommendation.objective === "further_reading" && recommendation.destinationType !== "article") {
        throw new Error("Further-reading suggestions must point to articles")
      }
      await transaction
        .update(blogRecommendations)
        .set({ articleId: parsedArticleId, destinationType: recommendation.destinationType })
        .where(
          and(
            eq(blogRecommendations.tenantId, parsedTenantId),
            eq(blogRecommendations.recommendationId, recommendation.recommendationId)
          )
        )
    }
  })
}

export async function setBlogIdeaStatus(shopDomain: string, ideaId: string, status: "selected" | "dismissed") {
  const tenantId = await requireTenantId(shopDomain)
  const parsedIdeaId = IdentifierSchema.parse(ideaId)
  const [updatedIdea] = await database
    .update(blogIdeas)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(blogIdeas.tenantId, tenantId),
        eq(blogIdeas.ideaId, parsedIdeaId),
        inArray(blogIdeas.status, ["proposed", "selected", "dismissed"])
      )
    )
    .returning({ ideaId: blogIdeas.ideaId })

  if (updatedIdea === undefined) {
    throw new Error("Blog idea could not be updated")
  }
}

/**
 * Puts an idea on a calendar day, or takes it back off when the day is null.
 * Scheduling an idea also selects it, because a day on the calendar is the merchant saying to write this one.
 * An idea that has already been written keeps its drafted status, since moving the day cannot unwrite the post.
 */
export async function setBlogIdeaSchedule(shopDomain: string, ideaId: string, scheduledFor: string | null) {
  const tenantId = await requireTenantId(shopDomain)
  const parsedIdeaId = IdentifierSchema.parse(ideaId)
  const parsedDate = scheduledFor === null ? null : CalendarDaySchema.parse(scheduledFor)
  const plannedStatus = parsedDate === null ? "proposed" : "selected"
  const [updatedIdea] = await database
    .update(blogIdeas)
    .set({
      scheduledFor: parsedDate,
      status: sql`case when ${blogIdeas.status} = 'drafted' then 'drafted' else ${plannedStatus} end`,
      updatedAt: new Date()
    })
    .where(and(eq(blogIdeas.tenantId, tenantId), eq(blogIdeas.ideaId, parsedIdeaId)))
    .returning({ ideaId: blogIdeas.ideaId })

  if (updatedIdea === undefined) {
    throw new Error("Blog idea could not be scheduled")
  }
}

export async function reviewBlogRecommendation(
  shopDomain: string,
  articleId: string,
  recommendationId: string,
  decision: "accepted" | "rejected"
) {
  const tenantId = await requireTenantId(shopDomain)
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const parsedRecommendationId = IdentifierSchema.parse(recommendationId)
  const parsedDecision = RecommendationDecisionSchema.parse(decision)
  const [updatedRecommendation] = await database
    .update(blogRecommendations)
    .set({ status: parsedDecision, reviewedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(blogRecommendations.tenantId, tenantId),
        eq(blogRecommendations.articleId, parsedArticleId),
        eq(blogRecommendations.recommendationId, parsedRecommendationId),
        inArray(blogRecommendations.status, ["proposed", "accepted", "rejected"])
      )
    )
    .returning({ recommendationId: blogRecommendations.recommendationId })

  if (updatedRecommendation === undefined) {
    throw new Error("Recommendation could not be reviewed")
  }
}
