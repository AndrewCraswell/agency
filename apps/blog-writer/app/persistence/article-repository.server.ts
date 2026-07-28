import { createHash } from "node:crypto"
import { and, count, desc, eq, max } from "drizzle-orm"
import { z } from "zod"
import { database } from "./database.server"
import { articlePublicationEvents, articleRevisions, articles, blogDrafts } from "./schema.server"

const IdentifierSchema = z.uuid()
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
/** Matches the `article_revisions_handle_check` constraint, where an empty handle means Shopify derives one. */
const HandleSchema = z
  .string()
  .trim()
  .max(255)
  .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const ArticleRevisionContentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  excerpt: z.string().trim().max(5000).default(""),
  body: z.string().default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  author: z.string().trim().max(120).default(""),
  handle: HandleSchema.default(""),
  seoTitle: z.string().trim().max(300).default(""),
  seoDescription: z.string().trim().max(500).default(""),
  imageUrl: z.url().max(2000).nullable().default(null),
  imageAltText: z.string().trim().max(300).default("")
})

export type ArticleStatus = z.infer<typeof ArticleStatusSchema>
export type ArticleRevisionOrigin = z.infer<typeof ArticleRevisionOriginSchema>
export type ArticlePublicationEventType = z.infer<typeof ArticlePublicationEventTypeSchema>
export type ArticleRevisionContent = z.input<typeof ArticleRevisionContentSchema>

export type ArticleRevisionSummary = {
  revisionId: string
  revisionNumber: number
  origin: ArticleRevisionOrigin
  title: string
  contentHash: string
  createdAt: string
  isCurrent: boolean
  isPublished: boolean
  hasPublicationHistory: boolean
}

export type ArticleRevisionDetail = ArticleRevisionSummary & Required<ArticleRevisionContent>

export type ArticleRecord = {
  articleId: string
  ideaId: string
  status: ArticleStatus
  currentRevisionId: string | null
  publishedRevisionId: string | null
  destinationBlogGid: string | null
  shopifyArticleGid: string | null
  shopifyArticleUrl: string | null
  updatedAt: string
}

export type ArticleWithRevision = ArticleRecord & {
  revision:
    | (Required<ArticleRevisionContent> & {
        revisionId: string
        revisionNumber: number
        origin: ArticleRevisionOrigin
        contentHash: string
        createdAt: string
      })
    | null
}

/** Raised when a write targets a revision that is no longer current, so the caller can resolve the conflict. */
export class ArticleRevisionConflictError extends Error {
  readonly currentRevisionId: string | null

  constructor(currentRevisionId: string | null) {
    super("Article changed since it was loaded")
    this.name = "ArticleRevisionConflictError"
    this.currentRevisionId = currentRevisionId
  }
}

/** Raised when a revision cannot be removed because the article or its Shopify history still depends on it. */
export class ArticleRevisionInUseError extends Error {
  readonly reason: "working_copy" | "publication_history"

  constructor(reason: "working_copy" | "publication_history") {
    super(
      reason === "working_copy"
        ? "Restore another version before deleting this one"
        : "Versions that went to Shopify stay in history"
    )
    this.name = "ArticleRevisionInUseError"
    this.reason = reason
  }
}

function hashRevisionContent(content: Required<ArticleRevisionContent>) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        content.title,
        content.excerpt,
        content.body,
        content.tags,
        content.author,
        content.handle,
        content.seoTitle,
        content.seoDescription,
        content.imageUrl,
        content.imageAltText
      ])
    )
    .digest("hex")
}

function toArticleRecord(article: {
  articleId: string
  ideaId: string
  status: string
  currentRevisionId: string | null
  publishedRevisionId: string | null
  destinationBlogGid: string | null
  shopifyArticleGid: string | null
  shopifyArticleUrl: string | null
  updatedAt: Date
}): ArticleRecord {
  return {
    ...article,
    status: ArticleStatusSchema.parse(article.status),
    updatedAt: article.updatedAt.toISOString()
  }
}

const articleColumns = {
  articleId: articles.articleId,
  ideaId: articles.ideaId,
  status: articles.status,
  currentRevisionId: articles.currentRevisionId,
  publishedRevisionId: articles.publishedRevisionId,
  destinationBlogGid: articles.destinationBlogGid,
  shopifyArticleGid: articles.shopifyArticleGid,
  shopifyArticleUrl: articles.shopifyArticleUrl,
  updatedAt: articles.updatedAt
}

const revisionContentColumns = {
  title: articleRevisions.title,
  excerpt: articleRevisions.excerpt,
  body: articleRevisions.body,
  tags: articleRevisions.tags,
  author: articleRevisions.author,
  handle: articleRevisions.handle,
  seoTitle: articleRevisions.seoTitle,
  seoDescription: articleRevisions.seoDescription,
  imageUrl: articleRevisions.imageUrl,
  imageAltText: articleRevisions.imageAltText
}

/**
 * Creates the durable article for a workflow draft and seeds its first immutable revision.
 * The draft bridge disappears once generation returns content instead of writing it.
 */
export async function createArticleFromDraft(tenantId: string, draftId: string) {
  const parsedTenantId = IdentifierSchema.parse(tenantId)
  const parsedDraftId = IdentifierSchema.parse(draftId)

  return await database.transaction(async (transaction) => {
    const [draft] = await transaction
      .select({
        ideaId: blogDrafts.ideaId,
        title: blogDrafts.title,
        excerpt: blogDrafts.excerpt,
        content: blogDrafts.content,
        status: blogDrafts.status,
        destinationBlogGid: blogDrafts.destinationBlogGid,
        shopifyArticleGid: blogDrafts.shopifyArticleGid
      })
      .from(blogDrafts)
      .where(and(eq(blogDrafts.tenantId, parsedTenantId), eq(blogDrafts.draftId, parsedDraftId)))
      .limit(1)
    if (draft === undefined) {
      throw new Error("Draft could not be found")
    }

    const [existingArticle] = await transaction
      .select({ articleId: articles.articleId })
      .from(articles)
      .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.draftId, parsedDraftId)))
      .limit(1)
    if (existingArticle !== undefined) {
      return existingArticle.articleId
    }

    const [article] = await transaction
      .insert(articles)
      .values({
        tenantId: parsedTenantId,
        ideaId: draft.ideaId,
        draftId: parsedDraftId,
        destinationBlogGid: draft.destinationBlogGid,
        shopifyArticleGid: draft.shopifyArticleGid,
        status: draft.status === "generating" ? "draft" : "needs_review"
      })
      .returning({ articleId: articles.articleId })
    if (article === undefined) {
      throw new Error("Article could not be created")
    }

    const content = ArticleRevisionContentSchema.parse({
      title: draft.title,
      excerpt: draft.excerpt,
      body: draft.content,
      tags: []
    })
    const [revision] = await transaction
      .insert(articleRevisions)
      .values({
        tenantId: parsedTenantId,
        articleId: article.articleId,
        revisionNumber: 1,
        origin: "generated",
        ...content,
        contentHash: hashRevisionContent(content)
      })
      .returning({ revisionId: articleRevisions.revisionId })
    if (revision === undefined) {
      throw new Error("Article revision could not be created")
    }

    await transaction
      .update(articles)
      .set({ currentRevisionId: revision.revisionId, updatedAt: new Date() })
      .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, article.articleId)))

    return article.articleId
  })
}

/**
 * Adopts a freshly generated draft as the working copy of an article that already exists.
 * The earlier versions stay in history, so a regeneration can be read side by side with what it replaced.
 */
export async function regenerateArticleFromDraft(tenantId: string, articleId: string, draftId: string) {
  const parsedTenantId = IdentifierSchema.parse(tenantId)
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const parsedDraftId = IdentifierSchema.parse(draftId)

  return await database.transaction(async (transaction) => {
    const [draft] = await transaction
      .select({ title: blogDrafts.title, excerpt: blogDrafts.excerpt, content: blogDrafts.content })
      .from(blogDrafts)
      .where(and(eq(blogDrafts.tenantId, parsedTenantId), eq(blogDrafts.draftId, parsedDraftId)))
      .limit(1)
    if (draft === undefined) {
      throw new Error("Draft could not be found")
    }

    const [article] = await transaction
      .select({ articleId: articles.articleId })
      .from(articles)
      .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId)))
      .limit(1)
      .for("update")
    if (article === undefined) {
      throw new Error("Article could not be found")
    }

    const [highestRevision] = await transaction
      .select({ revisionNumber: max(articleRevisions.revisionNumber) })
      .from(articleRevisions)
      .where(and(eq(articleRevisions.tenantId, parsedTenantId), eq(articleRevisions.articleId, parsedArticleId)))
    const revisionNumber = (highestRevision?.revisionNumber ?? 0) + 1

    const content = ArticleRevisionContentSchema.parse({
      title: draft.title,
      excerpt: draft.excerpt,
      body: draft.content,
      tags: []
    })
    const [revision] = await transaction
      .insert(articleRevisions)
      .values({
        tenantId: parsedTenantId,
        articleId: parsedArticleId,
        revisionNumber,
        origin: "regenerated",
        ...content,
        contentHash: hashRevisionContent(content)
      })
      .returning({ revisionId: articleRevisions.revisionId })
    if (revision === undefined) {
      throw new Error("Article revision could not be created")
    }

    // The article follows the new draft so later suggestion runs read the content the merchant is looking at.
    await transaction
      .update(articles)
      .set({ currentRevisionId: revision.revisionId, draftId: parsedDraftId, updatedAt: new Date() })
      .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId)))

    return { revisionId: revision.revisionId, revisionNumber }
  })
}

export async function listArticleRecords(tenantId: string): Promise<ArticleWithRevision[]> {
  const parsedTenantId = IdentifierSchema.parse(tenantId)
  const records = await database
    .select({
      ...articleColumns,
      ...revisionContentColumns,
      revisionId: articleRevisions.revisionId,
      revisionNumber: articleRevisions.revisionNumber,
      origin: articleRevisions.origin,
      contentHash: articleRevisions.contentHash,
      revisionCreatedAt: articleRevisions.createdAt
    })
    .from(articles)
    .leftJoin(
      articleRevisions,
      and(eq(articleRevisions.tenantId, articles.tenantId), eq(articleRevisions.revisionId, articles.currentRevisionId))
    )
    .where(eq(articles.tenantId, parsedTenantId))
    .orderBy(articles.updatedAt)

  return records.map(({ revisionId, revisionNumber, origin, revisionCreatedAt, ...rest }) => {
    const {
      title,
      excerpt,
      body,
      tags,
      author,
      handle,
      seoTitle,
      seoDescription,
      imageUrl,
      imageAltText,
      contentHash,
      ...article
    } = rest
    const revision =
      revisionId === null || revisionNumber === null || origin === null || revisionCreatedAt === null
        ? null
        : {
            revisionId,
            revisionNumber,
            origin: ArticleRevisionOriginSchema.parse(origin),
            title: title ?? "",
            excerpt: excerpt ?? "",
            body: body ?? "",
            tags: tags ?? [],
            author: author ?? "",
            handle: handle ?? "",
            seoTitle: seoTitle ?? "",
            seoDescription: seoDescription ?? "",
            imageUrl: imageUrl ?? null,
            imageAltText: imageAltText ?? "",
            contentHash: contentHash ?? "",
            createdAt: revisionCreatedAt.toISOString()
          }
    return { ...toArticleRecord(article), revision }
  })
}

export async function getArticleRecord(tenantId: string, articleId: string): Promise<ArticleWithRevision | null> {
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const records = await listArticleRecords(tenantId)
  return records.find((article) => article.articleId === parsedArticleId) ?? null
}

/**
 * Lists versions newest first, with the content each one holds.
 * A limit keeps the newest few on the page while the total says whether older versions exist.
 */
export async function listArticleRevisions(
  tenantId: string,
  articleId: string,
  options: { limit?: number } = {}
): Promise<{ revisions: ArticleRevisionDetail[]; totalCount: number }> {
  const parsedTenantId = IdentifierSchema.parse(tenantId)
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const [article] = await database
    .select({ currentRevisionId: articles.currentRevisionId, publishedRevisionId: articles.publishedRevisionId })
    .from(articles)
    .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId)))
    .limit(1)
  if (article === undefined) {
    throw new Error("Article could not be found")
  }

  const belongsToArticle = and(
    eq(articleRevisions.tenantId, parsedTenantId),
    eq(articleRevisions.articleId, parsedArticleId)
  )
  const [counted] = await database.select({ total: count() }).from(articleRevisions).where(belongsToArticle)
  const publishedRevisions = await database
    .selectDistinct({ revisionId: articlePublicationEvents.revisionId })
    .from(articlePublicationEvents)
    .where(
      and(
        eq(articlePublicationEvents.tenantId, parsedTenantId),
        eq(articlePublicationEvents.articleId, parsedArticleId)
      )
    )
  const withHistory = new Set(publishedRevisions.map(({ revisionId }) => revisionId))
  const newestFirst = database
    .select({
      ...revisionContentColumns,
      revisionId: articleRevisions.revisionId,
      revisionNumber: articleRevisions.revisionNumber,
      origin: articleRevisions.origin,
      contentHash: articleRevisions.contentHash,
      createdAt: articleRevisions.createdAt
    })
    .from(articleRevisions)
    .where(belongsToArticle)
    .orderBy(desc(articleRevisions.revisionNumber))
  const revisions = options.limit === undefined ? await newestFirst : await newestFirst.limit(options.limit)

  return {
    revisions: revisions.map((revision) => ({
      ...revision,
      origin: ArticleRevisionOriginSchema.parse(revision.origin),
      createdAt: revision.createdAt.toISOString(),
      isCurrent: revision.revisionId === article.currentRevisionId,
      isPublished: revision.revisionId === article.publishedRevisionId,
      hasPublicationHistory: withHistory.has(revision.revisionId)
    })),
    totalCount: counted?.total ?? 0
  }
}

/**
 * Appends an immutable revision and advances the current revision.
 * Callers pass the revision they edited so a stale write is rejected instead of overwriting newer work.
 */
export async function createArticleRevision(
  tenantId: string,
  articleId: string,
  input: {
    origin: ArticleRevisionOrigin
    content: ArticleRevisionContent
    expectedRevisionId: string | null
  }
) {
  const parsedTenantId = IdentifierSchema.parse(tenantId)
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const origin = ArticleRevisionOriginSchema.parse(input.origin)
  const content = ArticleRevisionContentSchema.parse(input.content)
  const expectedRevisionId = input.expectedRevisionId === null ? null : IdentifierSchema.parse(input.expectedRevisionId)

  return await database.transaction(async (transaction) => {
    const [article] = await transaction
      .select({ currentRevisionId: articles.currentRevisionId })
      .from(articles)
      .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId)))
      .limit(1)
      .for("update")
    if (article === undefined) {
      throw new Error("Article could not be found")
    }
    if (article.currentRevisionId !== expectedRevisionId) {
      throw new ArticleRevisionConflictError(article.currentRevisionId)
    }

    const [highestRevision] = await transaction
      .select({ revisionNumber: max(articleRevisions.revisionNumber) })
      .from(articleRevisions)
      .where(and(eq(articleRevisions.tenantId, parsedTenantId), eq(articleRevisions.articleId, parsedArticleId)))
    const revisionNumber = (highestRevision?.revisionNumber ?? 0) + 1

    const [revision] = await transaction
      .insert(articleRevisions)
      .values({
        tenantId: parsedTenantId,
        articleId: parsedArticleId,
        revisionNumber,
        origin,
        ...content,
        contentHash: hashRevisionContent(content)
      })
      .returning({ revisionId: articleRevisions.revisionId })
    if (revision === undefined) {
      throw new Error("Article revision could not be created")
    }

    await transaction
      .update(articles)
      .set({ currentRevisionId: revision.revisionId, updatedAt: new Date() })
      .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId)))

    return { revisionId: revision.revisionId, revisionNumber }
  })
}

/** Points the article at an existing revision, used when restoring history without rewriting it. */
export async function setCurrentArticleRevision(
  tenantId: string,
  articleId: string,
  input: { revisionId: string; expectedRevisionId: string | null }
) {
  const parsedTenantId = IdentifierSchema.parse(tenantId)
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const parsedRevisionId = IdentifierSchema.parse(input.revisionId)
  const expectedRevisionId = input.expectedRevisionId === null ? null : IdentifierSchema.parse(input.expectedRevisionId)

  await database.transaction(async (transaction) => {
    const [article] = await transaction
      .select({ currentRevisionId: articles.currentRevisionId })
      .from(articles)
      .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId)))
      .limit(1)
      .for("update")
    if (article === undefined) {
      throw new Error("Article could not be found")
    }
    if (article.currentRevisionId !== expectedRevisionId) {
      throw new ArticleRevisionConflictError(article.currentRevisionId)
    }

    const [revision] = await transaction
      .select({ revisionId: articleRevisions.revisionId })
      .from(articleRevisions)
      .where(
        and(
          eq(articleRevisions.tenantId, parsedTenantId),
          eq(articleRevisions.articleId, parsedArticleId),
          eq(articleRevisions.revisionId, parsedRevisionId)
        )
      )
      .limit(1)
    if (revision === undefined) {
      throw new Error("Revision does not belong to the article")
    }

    await transaction
      .update(articles)
      .set({ currentRevisionId: parsedRevisionId, updatedAt: new Date() })
      .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId)))
  })
}

/**
 * Removes one version from history.
 * The working copy and anything Shopify has seen are kept, because the article and its publication events point at
 * those rows and published history needs to stay auditable.
 */
export async function deleteArticleRevision(tenantId: string, articleId: string, revisionId: string) {
  const parsedTenantId = IdentifierSchema.parse(tenantId)
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const parsedRevisionId = IdentifierSchema.parse(revisionId)

  await database.transaction(async (transaction) => {
    const [article] = await transaction
      .select({ currentRevisionId: articles.currentRevisionId, publishedRevisionId: articles.publishedRevisionId })
      .from(articles)
      .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId)))
      .limit(1)
      .for("update")
    if (article === undefined) {
      throw new Error("Article could not be found")
    }
    if (article.currentRevisionId === parsedRevisionId) {
      throw new ArticleRevisionInUseError("working_copy")
    }

    const [publication] = await transaction
      .select({ total: count() })
      .from(articlePublicationEvents)
      .where(
        and(
          eq(articlePublicationEvents.tenantId, parsedTenantId),
          eq(articlePublicationEvents.revisionId, parsedRevisionId)
        )
      )
    if (article.publishedRevisionId === parsedRevisionId || (publication?.total ?? 0) > 0) {
      throw new ArticleRevisionInUseError("publication_history")
    }

    const deleted = await transaction
      .delete(articleRevisions)
      .where(
        and(
          eq(articleRevisions.tenantId, parsedTenantId),
          eq(articleRevisions.articleId, parsedArticleId),
          eq(articleRevisions.revisionId, parsedRevisionId)
        )
      )
      .returning({ revisionId: articleRevisions.revisionId })
    if (deleted.length === 0) {
      throw new Error("Revision does not belong to the article")
    }
  })
}

/**
 * Removes an article and everything written about it.
 * The revision pointers are cleared first, then the publication events, because the article and the events both
 * reference revisions and the database refuses to drop a revision anything still points at.
 */
export async function deleteArticle(tenantId: string, articleId: string) {
  const parsedTenantId = IdentifierSchema.parse(tenantId)
  const parsedArticleId = IdentifierSchema.parse(articleId)

  await database.transaction(async (transaction) => {
    const articleScope = and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId))
    const [article] = await transaction
      .select({ articleId: articles.articleId })
      .from(articles)
      .where(articleScope)
      .limit(1)
      .for("update")
    if (article === undefined) {
      throw new Error("Article could not be found")
    }

    await transaction
      .update(articles)
      .set({ currentRevisionId: null, publishedRevisionId: null, updatedAt: new Date() })
      .where(articleScope)
    await transaction
      .delete(articlePublicationEvents)
      .where(
        and(
          eq(articlePublicationEvents.tenantId, parsedTenantId),
          eq(articlePublicationEvents.articleId, parsedArticleId)
        )
      )
    await transaction
      .delete(articleRevisions)
      .where(and(eq(articleRevisions.tenantId, parsedTenantId), eq(articleRevisions.articleId, parsedArticleId)))
    await transaction.delete(articles).where(articleScope)
  })
}

/** Stores the blog an article publishes to, so later Shopify writes always target the same destination. */ export async function setArticleDestinationBlog(
  tenantId: string,
  articleId: string,
  destinationBlogGid: string
) {
  const parsedTenantId = IdentifierSchema.parse(tenantId)
  const parsedArticleId = IdentifierSchema.parse(articleId)
  await database
    .update(articles)
    .set({ destinationBlogGid, updatedAt: new Date() })
    .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId)))
}

/** Records what was sent to Shopify for one revision and moves the published pointer when it goes live. */
export async function recordArticlePublication(
  tenantId: string,
  articleId: string,
  input: {
    revisionId: string
    eventType: ArticlePublicationEventType
    shopifyArticleGid?: string | null
    shopifyArticleUrl?: string | null
  }
) {
  const parsedTenantId = IdentifierSchema.parse(tenantId)
  const parsedArticleId = IdentifierSchema.parse(articleId)
  const parsedRevisionId = IdentifierSchema.parse(input.revisionId)
  const eventType = ArticlePublicationEventTypeSchema.parse(input.eventType)
  const shopifyArticleGid = input.shopifyArticleGid ?? null
  const shopifyArticleUrl = input.shopifyArticleUrl ?? null

  return await database.transaction(async (transaction) => {
    const [revision] = await transaction
      .select({ revisionId: articleRevisions.revisionId })
      .from(articleRevisions)
      .where(
        and(
          eq(articleRevisions.tenantId, parsedTenantId),
          eq(articleRevisions.articleId, parsedArticleId),
          eq(articleRevisions.revisionId, parsedRevisionId)
        )
      )
      .limit(1)
    if (revision === undefined) {
      throw new Error("Revision does not belong to the article")
    }

    const [event] = await transaction
      .insert(articlePublicationEvents)
      .values({
        tenantId: parsedTenantId,
        articleId: parsedArticleId,
        revisionId: parsedRevisionId,
        eventType,
        shopifyArticleGid,
        shopifyArticleUrl
      })
      .returning({ eventId: articlePublicationEvents.eventId })
    if (event === undefined) {
      throw new Error("Publication event could not be recorded")
    }

    const publishedUpdate =
      eventType === "published" ? { publishedRevisionId: parsedRevisionId, status: "published" as const } : {}
    const unpublishedUpdate =
      eventType === "unpublished" ? { publishedRevisionId: null, status: "ready_to_publish" as const } : {}
    const draftSavedUpdate = eventType === "shopify_draft_saved" ? { status: "ready_to_publish" as const } : {}
    await transaction
      .update(articles)
      .set({
        ...publishedUpdate,
        ...unpublishedUpdate,
        ...draftSavedUpdate,
        ...(shopifyArticleGid === null ? {} : { shopifyArticleGid }),
        ...(shopifyArticleUrl === null ? {} : { shopifyArticleUrl }),
        updatedAt: new Date()
      })
      .where(and(eq(articles.tenantId, parsedTenantId), eq(articles.articleId, parsedArticleId)))

    return event.eventId
  })
}
