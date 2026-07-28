import { randomUUID } from "node:crypto"
import { and, eq, exists, isNotNull, notInArray, sql } from "drizzle-orm"
import { FINGERPRINTED_RESOURCE_TYPES } from "../shopify-sync/fingerprint"
import type { StoreFingerprint } from "../shopify-sync/fingerprint"
import type { ScannedShopifyResource } from "../shopify-sync/scan.server"
import { CreateTenantStoreSchema, normalizeOwnedDomains, UpsertTenantResourceSchema } from "./contracts.server"
import { database } from "./database.server"
import { tenantJobs, tenantResourceChunks, tenantResources, tenantStores } from "./schema.server"

export type ShopifySyncIdentity = {
  tenantId: string
  jobId: string
}

export type ShopifySyncSnapshot = {
  tenantId: string
  jobId: string
  shopName: string
  ownedDomains: string[]
  keywordMarket: { countryCode: string; languageCode: string } | null
  resources: ScannedShopifyResource[]
  synchronizedAt: Date
}

export type ShopifySyncRepository = {
  begin(shopDomain: string): Promise<ShopifySyncIdentity>
  applySnapshot(snapshot: ShopifySyncSnapshot): Promise<void>
  recordFailure(identity: ShopifySyncIdentity, error: unknown): Promise<void>
}

export type ShopifyResourceCounts = {
  product: number
  collection: number
  blog: number
  article: number
  page: number
}

export type ShopifySyncStatus = {
  syncStatus: "pending" | "syncing" | "ready" | "failed"
  lastSynchronizedAt: Date | null
  activeResourceCount: number
  activeResourceCounts: ShopifyResourceCounts
  /**
   * How many of those resources have been embedded, which is a later and slower fact than being synced.
   *
   * Copying the text across is the merchant's own work finishing; the store is only usable once the embedding run has
   * caught up behind it. Reporting one number for both would tell a merchant a feature is ready while every search
   * over their catalogue still comes back empty.
   */
  embeddedResourceCount: number
}

function createEmptyResourceCounts(): ShopifyResourceCounts {
  return { product: 0, collection: 0, blog: 0, article: 0, page: 0 }
}

/**
 * The resources carrying a usable vector, asked of the chunks rather than of a flag.
 *
 * A chunk row is the receipt for an embedding, so counting receipts cannot drift. A column on the resource claiming
 * the same thing did drift, the day a migration cleared every vector and left the claim behind.
 */
function hasLiveEmbedding() {
  return exists(
    database
      .select({ present: sql`1` })
      .from(tenantResourceChunks)
      .where(
        and(
          eq(tenantResourceChunks.tenantId, tenantResources.tenantId),
          eq(tenantResourceChunks.resourceId, tenantResources.resourceId),
          eq(tenantResourceChunks.representationVersion, tenantResources.representationVersion),
          eq(tenantResourceChunks.isActive, true),
          isNotNull(tenantResourceChunks.embedding)
        )
      )
  )
}

export async function getShopifySyncStatus(shopDomain: string): Promise<ShopifySyncStatus> {
  const tenantInput = CreateTenantStoreSchema.parse({ shopDomain, shopName: "" })
  const [tenant] = await database
    .select({
      tenantId: tenantStores.tenantId,
      syncStatus: tenantStores.syncStatus,
      lastSynchronizedAt: tenantStores.lastSynchronizedAt
    })
    .from(tenantStores)
    .where(eq(tenantStores.shopDomain, tenantInput.shopDomain))
    .limit(1)

  if (tenant === undefined) {
    return {
      syncStatus: "pending",
      lastSynchronizedAt: null,
      activeResourceCount: 0,
      activeResourceCounts: createEmptyResourceCounts(),
      embeddedResourceCount: 0
    }
  }

  const groupedResourceCounts = await database
    .select({ resourceType: tenantResources.resourceType, count: sql<number>`count(*)::integer` })
    .from(tenantResources)
    .where(and(eq(tenantResources.tenantId, tenant.tenantId), eq(tenantResources.isActive, true)))
    .groupBy(tenantResources.resourceType)
  const activeResourceCounts = createEmptyResourceCounts()
  let activeResourceCount = 0
  for (const { resourceType, count } of groupedResourceCounts) {
    activeResourceCount += count
    if (resourceType === "product") {
      activeResourceCounts.product = count
    } else if (resourceType === "collection") {
      activeResourceCounts.collection = count
    } else if (resourceType === "blog") {
      activeResourceCounts.blog = count
    } else if (resourceType === "article") {
      activeResourceCounts.article = count
    } else if (resourceType === "page") {
      activeResourceCounts.page = count
    } else {
      throw new Error("Tenant resource has an invalid resource type")
    }
  }
  if (
    tenant.syncStatus !== "pending" &&
    tenant.syncStatus !== "syncing" &&
    tenant.syncStatus !== "ready" &&
    tenant.syncStatus !== "failed"
  ) {
    throw new Error("Tenant store has an invalid synchronization status")
  }

  const [embedded] = await database
    .select({ count: sql<number>`count(*)::integer` })
    .from(tenantResources)
    .where(and(eq(tenantResources.tenantId, tenant.tenantId), eq(tenantResources.isActive, true), hasLiveEmbedding()))

  return {
    syncStatus: tenant.syncStatus,
    lastSynchronizedAt: tenant.lastSynchronizedAt,
    activeResourceCount,
    activeResourceCounts,
    embeddedResourceCount: embedded?.count ?? 0
  }
}

/**
 * The shape of the content this store last copied across, described the same way Shopify describes it live.
 *
 * Nothing records this; it is read back off the resource rows themselves. A stored copy would be one more claim that
 * could drift away from the thing it claims, which is the failure the indexing flag already taught this table.
 */
export async function readStoredFingerprint(shopDomain: string): Promise<StoreFingerprint | null> {
  const tenantInput = CreateTenantStoreSchema.parse({ shopDomain, shopName: "" })
  const [tenant] = await database
    .select({ tenantId: tenantStores.tenantId, lastSynchronizedAt: tenantStores.lastSynchronizedAt })
    .from(tenantStores)
    .where(eq(tenantStores.shopDomain, tenantInput.shopDomain))
    .limit(1)

  // A store that has never finished a sync has nothing to be compared against, and calling it changed would be as
  // wrong as calling it current.
  if (tenant === undefined || tenant.lastSynchronizedAt === null) {
    return null
  }

  const grouped = await database
    .select({
      resourceType: tenantResources.resourceType,
      count: sql<number>`count(*)::integer`,
      latestUpdate: sql<Date | null>`max(${tenantResources.sourceUpdatedAt})`
    })
    .from(tenantResources)
    .where(and(eq(tenantResources.tenantId, tenant.tenantId), eq(tenantResources.isActive, true)))
    .groupBy(tenantResources.resourceType)

  const fingerprint = Object.fromEntries(
    FINGERPRINTED_RESOURCE_TYPES.map((resourceType) => [resourceType, { count: 0, latestUpdate: null }])
  ) as StoreFingerprint
  for (const row of grouped) {
    const resourceType = FINGERPRINTED_RESOURCE_TYPES.find((candidate) => candidate === row.resourceType)
    if (resourceType === undefined) {
      throw new Error("Tenant resource has an invalid resource type")
    }
    // Shopify counts every article the same way it counts the rest, but exposes no field to ask with, so the stored
    // article count is deliberately withheld rather than compared against nothing.
    const count = resourceType === "article" ? null : row.count
    fingerprint[resourceType] = {
      count,
      latestUpdate: row.latestUpdate === null ? null : new Date(row.latestUpdate)
    }
  }
  return fingerprint
}

async function begin(shopDomain: string): Promise<ShopifySyncIdentity> {
  const tenantInput = CreateTenantStoreSchema.parse({ shopDomain, shopName: "" })
  const now = new Date()
  const [tenant] = await database
    .insert(tenantStores)
    .values({ ...tenantInput, syncStatus: "syncing", updatedAt: now })
    .onConflictDoUpdate({
      target: tenantStores.shopDomain,
      set: {
        status: "active",
        syncStatus: "syncing",
        uninstalledAt: null,
        updatedAt: now
      }
    })
    .returning({ tenantId: tenantStores.tenantId })

  if (tenant === undefined) {
    throw new Error("Shopify tenant upsert did not return a tenant")
  }

  const [job] = await database
    .insert(tenantJobs)
    .values({
      tenantId: tenant.tenantId,
      jobType: "reconciliation",
      idempotencyKey: `shopify-sync:${randomUUID()}`,
      status: "running",
      attemptCount: 1,
      startedAt: now,
      updatedAt: now
    })
    .returning({ jobId: tenantJobs.jobId })

  if (job === undefined) {
    throw new Error("Shopify sync job insert did not return a job")
  }
  return { tenantId: tenant.tenantId, jobId: job.jobId }
}

async function applySnapshot(snapshot: ShopifySyncSnapshot) {
  const { tenantId, jobId, shopName, ownedDomains, keywordMarket, resources, synchronizedAt } = snapshot
  const shopifyGids = resources.map(({ shopifyGid }) => shopifyGid)
  // A market Shopify reports is a starting point, not a verdict. Once a merchant has corrected it, later syncs leave
  // it alone, because the billing country is a weaker signal about where a store sells than the merchant is.
  const marketColumns =
    keywordMarket === null
      ? {}
      : {
          marketCountryCode: sql`coalesce(${tenantStores.marketCountryCode}, ${keywordMarket.countryCode})`,
          marketLanguageCode: sql`coalesce(${tenantStores.marketLanguageCode}, ${keywordMarket.languageCode})`,
          marketSource: sql`coalesce(${tenantStores.marketSource}, 'shopify')`
        }

  await database.transaction(async (transaction) => {
    for (const resource of resources) {
      const input = UpsertTenantResourceSchema.parse({
        ...resource,
        tenantId,
        isActive: true,
        synchronizedAt
      })

      await transaction
        .insert(tenantResources)
        .values(input)
        .onConflictDoUpdate({
          target: [tenantResources.tenantId, tenantResources.shopifyGid],
          set: {
            resourceType: input.resourceType,
            title: input.title,
            handle: input.handle,
            canonicalUrl: input.canonicalUrl,
            locale: input.locale,
            description: input.description,
            content: input.content,
            metadata: input.metadata,
            isActive: true,
            isPublished: input.isPublished,
            isAvailable: input.isAvailable,
            representationVersion: sql`case
              when ${tenantResources.contentHash} = ${input.contentHash} then ${tenantResources.representationVersion}
              else ${tenantResources.representationVersion} + 1
            end`,
            contentHash: input.contentHash,
            sourceCreatedAt: input.sourceCreatedAt,
            sourceUpdatedAt: input.sourceUpdatedAt,
            synchronizedAt,
            deactivatedAt: null,
            updatedAt: synchronizedAt
          }
        })
    }

    let missingResources = and(eq(tenantResources.tenantId, tenantId), eq(tenantResources.isActive, true))
    if (shopifyGids.length > 0) {
      missingResources = and(missingResources, notInArray(tenantResources.shopifyGid, shopifyGids))
    }
    await transaction
      .update(tenantResources)
      .set({
        isActive: false,
        isPublished: false,
        isAvailable: false,
        deactivatedAt: synchronizedAt,
        updatedAt: synchronizedAt
      })
      .where(missingResources)

    await transaction
      .update(tenantStores)
      .set({
        shopName,
        ownedDomains: normalizeOwnedDomains(ownedDomains),
        ...marketColumns,
        status: "active",
        syncStatus: "ready",
        lastSynchronizedAt: synchronizedAt,
        uninstalledAt: null,
        updatedAt: synchronizedAt
      })
      .where(eq(tenantStores.tenantId, tenantId))

    await transaction
      .update(tenantJobs)
      .set({ status: "succeeded", completedAt: synchronizedAt, updatedAt: synchronizedAt })
      .where(and(eq(tenantJobs.tenantId, tenantId), eq(tenantJobs.jobId, jobId)))
  })
}

async function recordFailure(identity: ShopifySyncIdentity, error: unknown) {
  const now = new Date()
  const errorCode = error instanceof Error ? error.name : "UnknownError"
  await database.transaction(async (transaction) => {
    await transaction
      .update(tenantStores)
      .set({ syncStatus: "failed", updatedAt: now })
      .where(eq(tenantStores.tenantId, identity.tenantId))
    await transaction
      .update(tenantJobs)
      .set({ status: "failed", lastErrorCode: errorCode, completedAt: now, updatedAt: now })
      .where(and(eq(tenantJobs.tenantId, identity.tenantId), eq(tenantJobs.jobId, identity.jobId)))
  })
}

export const shopifySyncRepository: ShopifySyncRepository = { begin, applySnapshot, recordFailure }
