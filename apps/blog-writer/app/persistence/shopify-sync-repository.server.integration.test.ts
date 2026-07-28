import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { ScannedShopifyResource } from "../shopify-sync/scan.server"
import type { BlogWriterDatabase } from "./database.server"
import { tenantJobs, tenantResources, tenantStores } from "./schema.server"
import type {
  getShopifySyncStatus as GetShopifySyncStatus,
  ShopifySyncRepository
} from "./shopify-sync-repository.server"

const testDatabaseUrl = process.env.BLOG_WRITER_TEST_DATABASE_URL
const isRepositoryDatabaseUnderTest = testDatabaseUrl !== undefined && testDatabaseUrl === process.env.DATABASE_URL
const describePostgres = isRepositoryDatabaseUnderTest ? describe : describe.skip
const firstDigest = "a".repeat(64)
const secondDigest = "b".repeat(64)

function resource(shopDomain: string, id: string, contentHash: string): ScannedShopifyResource {
  return {
    shopifyGid: `gid://shopify/Product/${id}`,
    resourceType: "product",
    title: `Product ${id}`,
    handle: `product-${id}`,
    canonicalUrl: `https://${shopDomain}/products/product-${id}`,
    locale: "en",
    description: "Product description",
    content: `<p>${contentHash}</p>`,
    metadata: {},
    isPublished: true,
    isAvailable: true,
    contentHash,
    sourceCreatedAt: new Date("2026-01-01T00:00:00Z"),
    sourceUpdatedAt: new Date("2026-01-02T00:00:00Z")
  }
}

describePostgres.sequential("Shopify sync repository", () => {
  const shopDomain = `sync-${randomUUID()}.myshopify.com`
  let database: BlogWriterDatabase
  let databasePool: Awaited<typeof import("./database.server")>["databasePool"]
  let getShopifySyncStatus: typeof GetShopifySyncStatus
  let shopifySyncRepository: ShopifySyncRepository

  beforeAll(async () => {
    const databaseModule = await import("./database.server")
    const repositoryModule = await import("./shopify-sync-repository.server")
    database = databaseModule.database
    databasePool = databaseModule.databasePool
    getShopifySyncStatus = repositoryModule.getShopifySyncStatus
    shopifySyncRepository = repositoryModule.shopifySyncRepository
  })

  afterAll(async () => {
    await database.delete(tenantStores).where(eq(tenantStores.shopDomain, shopDomain))
    await databasePool.end()
  })

  it("versions changed resources and deactivates only rows missing from a complete snapshot", async () => {
    const initialSync = await shopifySyncRepository.begin(shopDomain)
    await shopifySyncRepository.applySnapshot({
      ...initialSync,
      shopName: "Sync test store",
      ownedDomains: [shopDomain],
      keywordMarket: { countryCode: "US", languageCode: "en" },
      resources: [resource(shopDomain, "one", firstDigest), resource(shopDomain, "two", firstDigest)],
      synchronizedAt: new Date("2026-02-01T00:00:00Z")
    })
    await expect(getShopifySyncStatus(shopDomain)).resolves.toMatchObject({
      activeResourceCount: 2,
      activeResourceCounts: { product: 2, collection: 0, blog: 0, article: 0, page: 0 },
      // Copying the text across is not the same as being able to search it, and nothing has embedded these yet.
      embeddedResourceCount: 0
    })

    const secondSync = await shopifySyncRepository.begin(shopDomain)
    await shopifySyncRepository.applySnapshot({
      ...secondSync,
      shopName: "Sync test store",
      ownedDomains: [shopDomain],
      keywordMarket: { countryCode: "US", languageCode: "en" },
      resources: [resource(shopDomain, "one", secondDigest)],
      synchronizedAt: new Date("2026-02-02T00:00:00Z")
    })

    const rows = await database
      .select()
      .from(tenantResources)
      .where(eq(tenantResources.tenantId, initialSync.tenantId))
      .orderBy(tenantResources.shopifyGid)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      shopifyGid: "gid://shopify/Product/one",
      contentHash: secondDigest,
      isActive: true,
      representationVersion: 2,
      deactivatedAt: null
    })
    expect(rows[1]).toMatchObject({
      shopifyGid: "gid://shopify/Product/two",
      isActive: false,
      isPublished: false,
      isAvailable: false
    })
    expect(rows[1]?.deactivatedAt).not.toBeNull()

    await expect(
      database
        .select({ status: tenantJobs.status })
        .from(tenantJobs)
        .where(and(eq(tenantJobs.tenantId, secondSync.tenantId), eq(tenantJobs.jobId, secondSync.jobId)))
    ).resolves.toEqual([{ status: "succeeded" }])
  })

  it("records failure without mutating the last good resource snapshot", async () => {
    const failedSync = await shopifySyncRepository.begin(shopDomain)
    await shopifySyncRepository.recordFailure(failedSync, new Error("Shopify unavailable"))

    await expect(
      database
        .select({ syncStatus: tenantStores.syncStatus })
        .from(tenantStores)
        .where(eq(tenantStores.tenantId, failedSync.tenantId))
    ).resolves.toEqual([{ syncStatus: "failed" }])
    await expect(
      database
        .select({ status: tenantJobs.status, errorCode: tenantJobs.lastErrorCode })
        .from(tenantJobs)
        .where(and(eq(tenantJobs.tenantId, failedSync.tenantId), eq(tenantJobs.jobId, failedSync.jobId)))
    ).resolves.toEqual([{ status: "failed", errorCode: "Error" }])
    await expect(
      database
        .select({ contentHash: tenantResources.contentHash, isActive: tenantResources.isActive })
        .from(tenantResources)
        .where(
          and(
            eq(tenantResources.tenantId, failedSync.tenantId),
            eq(tenantResources.shopifyGid, "gid://shopify/Product/one")
          )
        )
    ).resolves.toEqual([{ contentHash: secondDigest, isActive: true }])
  })
})
