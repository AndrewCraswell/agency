import { randomUUID } from "node:crypto"
import { resolve } from "node:path"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import * as schema from "./schema.server"

const databaseUrl = process.env.BLOG_WRITER_TEST_DATABASE_URL
const describePostgres = databaseUrl === undefined ? describe.skip : describe
const migrationsFolder = resolve(process.cwd(), "drizzle/migrations")
const digest = "a".repeat(64)

async function expectForeignKeyViolation(operation: Promise<unknown>, constraint: string) {
  const rejection: unknown = await operation.then(
    () => new Error(`Expected ${constraint} to reject the operation`),
    (error: unknown) => error
  )
  expect(rejection).toBeInstanceOf(Error)
  if (!(rejection instanceof Error)) {
    throw rejection
  }
  expect(rejection.cause).toMatchObject({ code: "23503", constraint })
}

describePostgres.sequential("Blog Writer PostgreSQL migrations", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  const database = drizzle(pool, { schema })

  beforeAll(async () => {
    await migrate(database, { migrationsFolder, migrationsSchema: "blog_writer", migrationsTable: "migrations" })
  })

  afterAll(async () => {
    await pool.end()
  })

  it("blocks cross-tenant relationships and cascades only the deleted tenant", async () => {
    const tenantA = randomUUID()
    const tenantB = randomUUID()
    const ideaA = randomUUID()
    const resourceA = randomUUID()
    const resourceB = randomUUID()
    const draftA = randomUUID()
    const articleA = randomUUID()

    try {
      await database.insert(schema.tenantStores).values([
        { tenantId: tenantA, shopDomain: `tenant-${tenantA}.myshopify.com`, shopName: "Tenant A" },
        { tenantId: tenantB, shopDomain: `tenant-${tenantB}.myshopify.com`, shopName: "Tenant B" }
      ])
      const sharedBlogHostname = `blog-${tenantA}.example`
      await database.insert(schema.blogs).values({
        hostname: sharedBlogHostname,
        url: `https://${sharedBlogHostname}/articles`
      })
      await database.insert(schema.tenantCompetitorDomains).values([
        { tenantId: tenantA, hostname: "competitor.example" },
        { tenantId: tenantB, hostname: "competitor.example" }
      ])
      await database.insert(schema.tenantBlogSubscriptions).values([
        { tenantId: tenantA, blogHostname: sharedBlogHostname },
        { tenantId: tenantB, blogHostname: sharedBlogHostname }
      ])
      await database.insert(schema.blogIdeas).values({
        tenantId: tenantA,
        ideaId: ideaA,
        focus: "beginner fencing",
        title: `Tenant idea ${ideaA}`,
        angle: "Practical beginner guidance",
        targetKeyword: "beginner fencing",
        rationale: "Matches the store audience."
      })
      await database.insert(schema.tenantResources).values([
        {
          tenantId: tenantA,
          resourceId: resourceA,
          shopifyGid: `gid://shopify/Article/${resourceA}`,
          resourceType: "article",
          title: "Tenant A article",
          handle: `tenant-a-${resourceA}`,
          canonicalUrl: `https://tenant-${tenantA}.myshopify.com/blogs/news/${resourceA}`,
          locale: "en-US",
          isPublished: true,
          isAvailable: true,
          contentHash: digest,
          synchronizedAt: new Date()
        },
        {
          tenantId: tenantB,
          resourceId: resourceB,
          shopifyGid: `gid://shopify/Article/${resourceB}`,
          resourceType: "article",
          title: "Tenant B article",
          handle: `tenant-b-${resourceB}`,
          canonicalUrl: `https://tenant-${tenantB}.myshopify.com/blogs/news/${resourceB}`,
          locale: "en-US",
          isPublished: true,
          isAvailable: true,
          contentHash: digest,
          synchronizedAt: new Date()
        }
      ])
      await database.insert(schema.blogDrafts).values({
        tenantId: tenantA,
        draftId: draftA,
        ideaId: ideaA,
        title: "Tenant A draft",
        contentHash: digest
      })
      await database
        .insert(schema.articles)
        .values({ tenantId: tenantA, articleId: articleA, ideaId: ideaA, draftId: draftA })
      await database.insert(schema.blogRecommendations).values({
        tenantId: tenantA,
        articleId: articleA,
        draftId: draftA,
        destinationResourceId: resourceA,
        destinationType: "article",
        objective: "further_reading",
        sourceRevision: digest,
        sectionLocator: "conclusion",
        anchorText: "Related article",
        rationale: "Relevant reading for this tenant.",
        ranker: "test"
      })

      await expectForeignKeyViolation(
        database.insert(schema.blogDrafts).values({
          tenantId: tenantB,
          ideaId: ideaA,
          title: "Cross-tenant draft",
          contentHash: digest
        }),
        "blog_drafts_idea_fk"
      )
      await expectForeignKeyViolation(
        database.insert(schema.articles).values({ tenantId: tenantB, ideaId: ideaA, draftId: draftA }),
        "articles_idea_fk"
      )
      await expectForeignKeyViolation(
        database.insert(schema.blogRecommendations).values({
          tenantId: tenantA,
          draftId: draftA,
          destinationResourceId: resourceB,
          objective: "further_reading",
          sourceRevision: digest,
          sectionLocator: "conclusion",
          anchorText: "Related article",
          rationale: "Must not cross stores.",
          ranker: "test"
        }),
        "blog_recommendations_destination_fk"
      )

      await database.delete(schema.tenantStores).where(eq(schema.tenantStores.tenantId, tenantA))

      await expect(
        database.select().from(schema.blogIdeas).where(eq(schema.blogIdeas.tenantId, tenantA))
      ).resolves.toHaveLength(0)
      await expect(
        database.select().from(schema.articles).where(eq(schema.articles.tenantId, tenantA))
      ).resolves.toHaveLength(0)
      await expect(
        database.select().from(schema.blogRecommendations).where(eq(schema.blogRecommendations.tenantId, tenantA))
      ).resolves.toHaveLength(0)
      await expect(
        database
          .select()
          .from(schema.tenantResources)
          .where(and(eq(schema.tenantResources.tenantId, tenantB), eq(schema.tenantResources.resourceId, resourceB)))
      ).resolves.toHaveLength(1)
      await expect(
        database
          .select()
          .from(schema.tenantCompetitorDomains)
          .where(eq(schema.tenantCompetitorDomains.tenantId, tenantA))
      ).resolves.toHaveLength(0)
      await expect(
        database
          .select()
          .from(schema.tenantCompetitorDomains)
          .where(eq(schema.tenantCompetitorDomains.tenantId, tenantB))
      ).resolves.toHaveLength(1)
      await expect(
        database
          .select()
          .from(schema.tenantBlogSubscriptions)
          .where(eq(schema.tenantBlogSubscriptions.tenantId, tenantB))
      ).resolves.toHaveLength(1)
      await expect(
        database.select().from(schema.blogs).where(eq(schema.blogs.hostname, sharedBlogHostname))
      ).resolves.toHaveLength(1)
    } finally {
      await database.delete(schema.tenantStores).where(eq(schema.tenantStores.tenantId, tenantA))
      await database.delete(schema.tenantStores).where(eq(schema.tenantStores.tenantId, tenantB))
      await database.delete(schema.blogs).where(eq(schema.blogs.hostname, `blog-${tenantA}.example`))
    }
  })
})
