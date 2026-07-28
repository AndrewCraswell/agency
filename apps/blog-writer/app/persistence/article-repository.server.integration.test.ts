import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type * as ArticleRepository from "./article-repository.server"
import type { BlogWriterDatabase } from "./database.server"
import { blogDrafts, blogIdeas, tenantStores } from "./schema.server"

const testDatabaseUrl = process.env.BLOG_WRITER_TEST_DATABASE_URL
const isRepositoryDatabaseUnderTest = testDatabaseUrl !== undefined && testDatabaseUrl === process.env.DATABASE_URL
const describePostgres = isRepositoryDatabaseUnderTest ? describe : describe.skip
const digest = "c".repeat(64)

describePostgres.sequential("Article repository", () => {
  const shopDomain = `articles-${randomUUID()}.myshopify.com`
  let database: BlogWriterDatabase
  let databasePool: Awaited<typeof import("./database.server")>["databasePool"]
  let repository: typeof ArticleRepository
  let tenantId: string
  let draftId: string

  beforeAll(async () => {
    const databaseModule = await import("./database.server")
    repository = await import("./article-repository.server")
    database = databaseModule.database
    databasePool = databaseModule.databasePool

    const [tenant] = await database
      .insert(tenantStores)
      .values({ shopDomain, shopName: "Article tenant" })
      .returning({ tenantId: tenantStores.tenantId })
    tenantId = tenant!.tenantId

    const [idea] = await database
      .insert(blogIdeas)
      .values({
        tenantId,
        focus: "camp cooking",
        title: `Camp cooking ${randomUUID()}`,
        angle: "Practical guidance",
        targetKeyword: "camp cooking",
        rationale: "Matches the store audience."
      })
      .returning({ ideaId: blogIdeas.ideaId })

    const [draft] = await database
      .insert(blogDrafts)
      .values({
        tenantId,
        ideaId: idea!.ideaId,
        title: "Camp cooking basics",
        excerpt: "Cook well on a small stove.",
        content: "<p>Start with a stable surface.</p>",
        contentHash: digest,
        status: "review"
      })
      .returning({ draftId: blogDrafts.draftId })
    draftId = draft!.draftId
  })

  afterAll(async () => {
    await database.delete(tenantStores).where(eq(tenantStores.shopDomain, shopDomain))
    await databasePool.end()
  })

  it("keeps revision history ordered and rejects stale writes", async () => {
    const articleId = await repository.createArticleFromDraft(tenantId, draftId)
    expect(await repository.createArticleFromDraft(tenantId, draftId)).toBe(articleId)

    const generated = await repository.getArticleRecord(tenantId, articleId)
    expect(generated?.status).toBe("needs_review")
    expect(generated?.revision?.revisionNumber).toBe(1)
    expect(generated?.revision?.origin).toBe("generated")
    expect(generated?.revision?.body).toBe("<p>Start with a stable surface.</p>")

    const firstRevisionId = generated!.revision!.revisionId
    const edited = await repository.createArticleRevision(tenantId, articleId, {
      origin: "edited",
      content: { title: "Camp cooking basics", excerpt: "Cook well anywhere.", body: "<p>Level the ground.</p>" },
      expectedRevisionId: firstRevisionId
    })
    expect(edited.revisionNumber).toBe(2)

    await expect(
      repository.createArticleRevision(tenantId, articleId, {
        origin: "edited",
        content: { title: "Stale edit", excerpt: "", body: "" },
        expectedRevisionId: firstRevisionId
      })
    ).rejects.toBeInstanceOf(repository.ArticleRevisionConflictError)

    const history = await repository.listArticleRevisions(tenantId, articleId)
    expect(history.totalCount).toBe(2)
    expect(history.revisions.map((revision) => revision.revisionNumber)).toEqual([2, 1])
    expect(history.revisions.map((revision) => revision.isCurrent)).toEqual([true, false])

    const newest = await repository.listArticleRevisions(tenantId, articleId, { limit: 1 })
    expect(newest.totalCount).toBe(2)
    expect(newest.revisions.map((revision) => revision.revisionNumber)).toEqual([2])

    await repository.setCurrentArticleRevision(tenantId, articleId, {
      revisionId: firstRevisionId,
      expectedRevisionId: edited.revisionId
    })
    const restored = await repository.getArticleRecord(tenantId, articleId)
    expect(restored?.revision?.revisionId).toBe(firstRevisionId)

    await repository.recordArticlePublication(tenantId, articleId, {
      revisionId: edited.revisionId,
      eventType: "published",
      shopifyArticleGid: "gid://shopify/Article/1",
      shopifyArticleUrl: "https://example.com/blogs/news/camp-cooking-basics"
    })
    const published = await repository.getArticleRecord(tenantId, articleId)
    expect(published?.status).toBe("published")
    expect(published?.publishedRevisionId).toBe(edited.revisionId)
    expect(published?.currentRevisionId).toBe(firstRevisionId)

    const summaries = await repository.listArticleRecords(tenantId)
    expect(summaries.map((article) => article.articleId)).toEqual([articleId])
  })
})
