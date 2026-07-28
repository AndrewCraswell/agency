import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import type { ArticleStatus } from "./article-repository.server"
import { getTenantIdForShop } from "./blog-workspace-repository.server"
import { database } from "./database.server"
import {
  articlePublicationEvents,
  articleRevisions,
  articles,
  blogIdeas,
  blogRecommendations,
  tenantJobs
} from "./schema.server"

const ArticleStatusSchema = z.enum([
  "draft",
  "needs_review",
  "ready_to_publish",
  "published",
  "needs_attention",
  "failed"
])

/** Home ranks work rather than listing it, so it reads the newest articles instead of the whole shelf. */
const ARTICLE_LIMIT = 50

/** How far ahead the agenda looks. A week is what a merchant can still act on. */
const SCHEDULE_WINDOW_DAYS = 7

const SCHEDULED_IDEA_LIMIT = 5
const FAILED_JOB_LIMIT = 3

export type HomeArticle = {
  articleId: string
  title: string
  status: ArticleStatus
  updatedAt: string
  /** The working copy has moved on from the version readers see, so publishing again would change the storefront. */
  hasUnpublishedChanges: boolean
  proposedCrosslinkCount: number
  proposedFurtherReadingCount: number
  staleLinkCount: number
  publishedAt: string | null
  shopifyArticleUrl: string | null
}

export type HomeScheduledIdea = {
  ideaId: string
  title: string
  scheduledFor: string
}

export type HomeFailedJob = {
  jobId: string
  jobType: string
  lastErrorCode: string | null
  failedAt: string
}

export type HomeOverview = {
  articles: HomeArticle[]
  articleCounts: Record<ArticleStatus, number>
  ideasToReview: number
  scheduledIdeaCount: number
  scheduledIdeas: HomeScheduledIdea[]
  unscheduledIdeaCount: number
  generatingCount: number
  failedJobs: HomeFailedJob[]
}

function createEmptyArticleCounts(): Record<ArticleStatus, number> {
  return { draft: 0, needs_review: 0, ready_to_publish: 0, published: 0, needs_attention: 0, failed: 0 }
}

function createEmptyOverview(): HomeOverview {
  return {
    articles: [],
    articleCounts: createEmptyArticleCounts(),
    ideasToReview: 0,
    scheduledIdeaCount: 0,
    scheduledIdeas: [],
    unscheduledIdeaCount: 0,
    generatingCount: 0,
    failedJobs: []
  }
}

/** The calendar plans in store days, so a scheduled date is compared as a plain day rather than an instant. */
function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

type LinkCounts = {
  proposedCrosslinkCount: number
  proposedFurtherReadingCount: number
  staleLinkCount: number
}

function createEmptyLinkCounts(): LinkCounts {
  return { proposedCrosslinkCount: 0, proposedFurtherReadingCount: 0, staleLinkCount: 0 }
}

async function getLinkCountsByArticle(tenantId: string, articleIds: string[]) {
  const countsByArticle = new Map<string, LinkCounts>()
  if (articleIds.length === 0) {
    return countsByArticle
  }

  const linkRecords = await database
    .select({
      articleId: blogRecommendations.articleId,
      objective: blogRecommendations.objective,
      status: blogRecommendations.status,
      count: sql<number>`count(*)::integer`
    })
    .from(blogRecommendations)
    .where(
      and(
        eq(blogRecommendations.tenantId, tenantId),
        inArray(blogRecommendations.articleId, articleIds),
        inArray(blogRecommendations.status, ["proposed", "stale"])
      )
    )
    .groupBy(blogRecommendations.articleId, blogRecommendations.objective, blogRecommendations.status)

  for (const link of linkRecords) {
    if (link.articleId === null) {
      continue
    }
    const counts = countsByArticle.get(link.articleId) ?? createEmptyLinkCounts()
    if (link.status === "stale") {
      counts.staleLinkCount += link.count
    } else if (link.objective === "commercial_crosslink") {
      counts.proposedCrosslinkCount += link.count
    } else {
      counts.proposedFurtherReadingCount += link.count
    }
    countsByArticle.set(link.articleId, counts)
  }

  return countsByArticle
}

async function getPublishedAtByArticle(tenantId: string) {
  const eventRecords = await database
    .select({
      articleId: articlePublicationEvents.articleId,
      publishedAt: sql<Date>`max(${articlePublicationEvents.occurredAt})`
    })
    .from(articlePublicationEvents)
    .where(and(eq(articlePublicationEvents.tenantId, tenantId), eq(articlePublicationEvents.eventType, "published")))
    .groupBy(articlePublicationEvents.articleId)

  return new Map(eventRecords.map(({ articleId, publishedAt }) => [articleId, new Date(publishedAt).toISOString()]))
}

/**
 * Everything Home ranks, read once per request. Home decides what deserves attention; this only reports the state
 * each owning page already holds, so no count here is authoritative for that page's own list.
 */
export async function getHomeOverview(shopDomain: string): Promise<HomeOverview> {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return createEmptyOverview()
  }

  const [articleRecords, statusCounts, ideaRecords, jobRecords, publishedAtByArticle] = await Promise.all([
    database
      .select({
        articleId: articles.articleId,
        title: articleRevisions.title,
        status: articles.status,
        updatedAt: articles.updatedAt,
        currentRevisionId: articles.currentRevisionId,
        publishedRevisionId: articles.publishedRevisionId,
        shopifyArticleUrl: articles.shopifyArticleUrl
      })
      .from(articles)
      .innerJoin(
        articleRevisions,
        and(
          eq(articleRevisions.tenantId, articles.tenantId),
          eq(articleRevisions.revisionId, articles.currentRevisionId)
        )
      )
      .where(eq(articles.tenantId, tenantId))
      .orderBy(desc(articles.updatedAt))
      .limit(ARTICLE_LIMIT),
    database
      .select({ status: articles.status, count: sql<number>`count(*)::integer` })
      .from(articles)
      .where(eq(articles.tenantId, tenantId))
      .groupBy(articles.status),
    database
      .select({
        ideaId: blogIdeas.ideaId,
        title: blogIdeas.title,
        status: blogIdeas.status,
        scheduledFor: blogIdeas.scheduledFor,
        articleId: articles.articleId
      })
      .from(blogIdeas)
      .leftJoin(articles, and(eq(articles.tenantId, blogIdeas.tenantId), eq(articles.ideaId, blogIdeas.ideaId)))
      .where(eq(blogIdeas.tenantId, tenantId)),
    database
      .select({
        jobId: tenantJobs.jobId,
        jobType: tenantJobs.jobType,
        status: tenantJobs.status,
        lastErrorCode: tenantJobs.lastErrorCode,
        updatedAt: tenantJobs.updatedAt
      })
      .from(tenantJobs)
      .where(and(eq(tenantJobs.tenantId, tenantId), inArray(tenantJobs.status, ["queued", "running", "failed"])))
      .orderBy(desc(tenantJobs.updatedAt)),
    getPublishedAtByArticle(tenantId)
  ])

  const linkCountsByArticle = await getLinkCountsByArticle(
    tenantId,
    articleRecords.map(({ articleId }) => articleId)
  )

  const articleCounts = createEmptyArticleCounts()
  for (const { status, count } of statusCounts) {
    articleCounts[ArticleStatusSchema.parse(status)] = count
  }

  const today = toDateKey(new Date())
  const horizon = toDateKey(new Date(Date.now() + SCHEDULE_WINDOW_DAYS * 24 * 60 * 60 * 1000))
  const plannedIdeas = ideaRecords.filter(
    (idea) => idea.articleId === null && idea.status !== "dismissed" && idea.scheduledFor !== null
  )

  return {
    articles: articleRecords.map((article) => ({
      articleId: article.articleId,
      title: article.title,
      status: ArticleStatusSchema.parse(article.status),
      updatedAt: article.updatedAt.toISOString(),
      hasUnpublishedChanges:
        article.publishedRevisionId !== null && article.publishedRevisionId !== article.currentRevisionId,
      publishedAt: publishedAtByArticle.get(article.articleId) ?? null,
      shopifyArticleUrl: article.shopifyArticleUrl,
      ...(linkCountsByArticle.get(article.articleId) ?? createEmptyLinkCounts())
    })),
    articleCounts,
    ideasToReview: ideaRecords.filter(({ status }) => status === "proposed").length,
    scheduledIdeaCount: plannedIdeas.length,
    scheduledIdeas: plannedIdeas
      .filter(
        (idea): idea is typeof idea & { scheduledFor: string } =>
          idea.scheduledFor !== null && idea.scheduledFor >= today && idea.scheduledFor <= horizon
      )
      .sort((first, second) => first.scheduledFor.localeCompare(second.scheduledFor))
      .slice(0, SCHEDULED_IDEA_LIMIT)
      .map(({ ideaId, title, scheduledFor }) => ({ ideaId, title, scheduledFor })),
    unscheduledIdeaCount: ideaRecords.filter(
      ({ status, scheduledFor, articleId }) => status === "selected" && scheduledFor === null && articleId === null
    ).length,
    generatingCount: jobRecords.filter(({ jobType, status }) => jobType === "draft_generation" && status !== "failed")
      .length,
    failedJobs: jobRecords
      .filter(({ status }) => status === "failed")
      .slice(0, FAILED_JOB_LIMIT)
      .map(({ jobId, jobType, lastErrorCode, updatedAt }) => ({
        jobId,
        jobType,
        lastErrorCode,
        failedAt: updatedAt.toISOString()
      }))
  }
}
