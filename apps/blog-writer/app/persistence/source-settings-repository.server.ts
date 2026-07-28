import { and, asc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { getTenantIdForShop } from "./blog-workspace-repository.server"
import {
  AddTenantBlogSubscriptionSchema,
  AddTenantCompetitorDomainSchema,
  BlogAddressInputSchema,
  CompetitorDomainInputSchema,
  isOwnedDomain
} from "./contracts.server"
import { database } from "./database.server"
import { blogs, tenantBlogSubscriptions, tenantCompetitorDomains, tenantStores } from "./schema.server"

/** Long enough for a paragraph of positioning and voice, short enough to stay inside every prompt. */
export const BrandBriefSchema = z.string().trim().max(2000)

export type SourceSettings = {
  brandBrief: string
  competitorDomains: string[]
  subscribedBlogs: {
    hostname: string
    url: string
    title: string | null
    lastSynchronizedAt: string | null
  }[]
}

async function requireTenantId(shopDomain: string) {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    throw new Error("Store content must be synchronized before configuring sources")
  }
  return tenantId
}

/**
 * Crawled paragraphs are shared across every store that follows the same blog, so each row carries
 * the tenants allowed to read it. A subscription change has to be pushed onto those rows too,
 * otherwise a store keeps seeing prior art it no longer follows.
 */
function restampBlogEmbeddings(hostname: string) {
  return sql`
    update public.blog_embeddings
    set metadata = metadata || jsonb_build_object(
      'tenant_ids',
      coalesce(
        (select jsonb_agg(distinct subscription.tenant_id::text)
         from blog_writer.tenant_blog_subscriptions subscription
         where subscription.blog_hostname = ${hostname}),
        '[]'::jsonb
      )
    )
    where metadata->>'hostname' = ${hostname}
  `
}

export async function getSourceSettings(shopDomain: string): Promise<SourceSettings> {
  const tenantId = await getTenantIdForShop(shopDomain)
  if (tenantId === null) {
    return { brandBrief: "", competitorDomains: [], subscribedBlogs: [] }
  }

  const [store] = await database
    .select({ brandBrief: tenantStores.brandBrief })
    .from(tenantStores)
    .where(eq(tenantStores.tenantId, tenantId))
  const competitorRecords = await database
    .select({ hostname: tenantCompetitorDomains.hostname })
    .from(tenantCompetitorDomains)
    .where(eq(tenantCompetitorDomains.tenantId, tenantId))
    .orderBy(asc(tenantCompetitorDomains.hostname))
  const blogRecords = await database
    .select({
      hostname: blogs.hostname,
      url: blogs.url,
      title: blogs.title,
      lastSynchronizedAt: blogs.lastSync
    })
    .from(tenantBlogSubscriptions)
    .innerJoin(blogs, eq(blogs.hostname, tenantBlogSubscriptions.blogHostname))
    .where(eq(tenantBlogSubscriptions.tenantId, tenantId))
    .orderBy(asc(blogs.hostname))

  return {
    brandBrief: store?.brandBrief ?? "",
    competitorDomains: competitorRecords.map(({ hostname }) => hostname),
    subscribedBlogs: blogRecords.map((blog) => ({
      ...blog,
      lastSynchronizedAt: blog.lastSynchronizedAt?.toISOString() ?? null
    }))
  }
}

export async function setBrandBrief(shopDomain: string, value: string) {
  const tenantId = await requireTenantId(shopDomain)
  await database
    .update(tenantStores)
    .set({ brandBrief: BrandBriefSchema.parse(value), updatedAt: new Date() })
    .where(eq(tenantStores.tenantId, tenantId))
}

export async function addCompetitorDomain(shopDomain: string, value: string) {
  const tenantId = await requireTenantId(shopDomain)
  const hostname = CompetitorDomainInputSchema.parse(value)
  const input = AddTenantCompetitorDomainSchema.parse({ tenantId, hostname })
  await database.insert(tenantCompetitorDomains).values(input).onConflictDoNothing()
}

export async function removeCompetitorDomain(shopDomain: string, value: string) {
  const tenantId = await requireTenantId(shopDomain)
  const hostname = CompetitorDomainInputSchema.parse(value)
  await database
    .delete(tenantCompetitorDomains)
    .where(and(eq(tenantCompetitorDomains.tenantId, tenantId), eq(tenantCompetitorDomains.hostname, hostname)))
}

/**
 * Raised when a store tries to follow its own storefront. Prior art is meant to be independent
 * writing the generator can learn from, so a store following itself would quietly turn its own
 * back catalogue into its reference material and reinforce whatever it already sounds like.
 */
export class OwnDomainSubscriptionError extends Error {
  constructor(hostname: string) {
    super(`${hostname} belongs to this store`)
    this.name = "OwnDomainSubscriptionError"
  }
}

export async function subscribeToBlog(shopDomain: string, value: string, title: string | null = null) {
  const tenantId = await requireTenantId(shopDomain)
  const blog = BlogAddressInputSchema.parse(value)

  const [store] = await database
    .select({ ownedDomains: tenantStores.ownedDomains })
    .from(tenantStores)
    .where(eq(tenantStores.tenantId, tenantId))
  if (isOwnedDomain(blog.hostname, [shopDomain, ...(store?.ownedDomains ?? [])])) {
    throw new OwnDomainSubscriptionError(blog.hostname)
  }

  const subscription = AddTenantBlogSubscriptionSchema.parse({ tenantId, blogHostname: blog.hostname })

  await database.transaction(async (transaction) => {
    // Blog rows are shared between stores, so a title another store already recorded, or one a crawl has since
    // improved on, outranks whatever this subscription happened to read off the page.
    await transaction
      .insert(blogs)
      .values({ ...blog, title })
      .onConflictDoUpdate({
        target: blogs.hostname,
        set: { title: sql`coalesce(${blogs.title}, excluded.title)` }
      })
    await transaction.insert(tenantBlogSubscriptions).values(subscription).onConflictDoNothing()
    await transaction.execute(restampBlogEmbeddings(blog.hostname))
  })
}

export async function unsubscribeFromBlog(shopDomain: string, value: string) {
  const tenantId = await requireTenantId(shopDomain)
  const hostname = CompetitorDomainInputSchema.parse(value)
  await database.transaction(async (transaction) => {
    await transaction
      .delete(tenantBlogSubscriptions)
      .where(and(eq(tenantBlogSubscriptions.tenantId, tenantId), eq(tenantBlogSubscriptions.blogHostname, hostname)))
    await transaction.execute(restampBlogEmbeddings(hostname))
  })
}
