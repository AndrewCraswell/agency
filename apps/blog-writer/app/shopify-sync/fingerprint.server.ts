import { z } from "zod"
import { readStoredFingerprint } from "../persistence/shopify-sync-repository.server"
import { compareFingerprints } from "./fingerprint"
import type { ContentDrift, StoreFingerprint } from "./fingerprint"

const CountSchema = z.object({ count: z.number().int().nonnegative(), precision: z.string() })

const NewestNodeSchema = z.object({ nodes: z.array(z.object({ updatedAt: z.iso.datetime().nullable() })) })

const FingerprintResponseSchema = z.object({
  data: z.object({
    productsCount: CountSchema,
    collectionsCount: CountSchema,
    pagesCount: CountSchema,
    blogsCount: CountSchema,
    products: NewestNodeSchema,
    collections: NewestNodeSchema,
    pages: NewestNodeSchema,
    articles: NewestNodeSchema,
    blogs: NewestNodeSchema
  }),
  errors: z.array(z.object({ message: z.string() })).optional()
})

/**
 * Everything the comparison needs, in one request.
 *
 * The full scan pulls every product description and every article body, which is far too expensive to run on a page
 * load. This asks only for the shape of the content rather than the content itself, so it can run every time the
 * merchant opens the page without costing them anything they would notice.
 *
 * Blogs are the exception: Shopify offers no way to sort them by when they changed, and a store keeps a handful of
 * them rather than thousands, so their timestamps are read directly and reduced here.
 */
const fingerprintQuery = `#graphql
  query StoreContentFingerprint {
    productsCount { count precision }
    collectionsCount { count precision }
    pagesCount { count precision }
    blogsCount { count precision }
    products(first: 1, sortKey: UPDATED_AT, reverse: true) { nodes { updatedAt } }
    collections(first: 1, sortKey: UPDATED_AT, reverse: true) { nodes { updatedAt } }
    pages(first: 1, sortKey: UPDATED_AT, reverse: true) { nodes { updatedAt } }
    articles(first: 1, sortKey: UPDATED_AT, reverse: true) { nodes { updatedAt } }
    blogs(first: 250) { nodes { updatedAt } }
  }`

type Graphql = (query: string, options: { variables: { after: string | null } }) => Promise<Response>

/**
 * A count Shopify is sure about, or nothing.
 *
 * Past ten thousand rows Shopify stops counting exactly and answers with a floor instead. Comparing that against a
 * real count would report a change on every load of a large store, so an inexact count is treated as no count at all
 * and the timestamp carries the comparison by itself.
 */
function exactCount(reported: z.infer<typeof CountSchema>) {
  if (reported.precision !== "EXACT") {
    return null
  }
  return reported.count
}

function newestUpdate(connection: z.infer<typeof NewestNodeSchema>) {
  const timestamps = connection.nodes
    .map(({ updatedAt }) => updatedAt)
    .filter((updatedAt) => updatedAt !== null)
    .map((updatedAt) => new Date(updatedAt).getTime())
  if (timestamps.length === 0) {
    return null
  }
  return new Date(Math.max(...timestamps))
}

export async function readLiveFingerprint(graphql: Graphql): Promise<StoreFingerprint> {
  const response = await graphql(fingerprintQuery, { variables: { after: null } })
  const payload = FingerprintResponseSchema.parse(await response.json())
  if (payload.errors?.length) {
    throw new Error(payload.errors.map(({ message }) => message).join("; "))
  }

  const { data } = payload
  return {
    product: { count: exactCount(data.productsCount), latestUpdate: newestUpdate(data.products) },
    collection: { count: exactCount(data.collectionsCount), latestUpdate: newestUpdate(data.collections) },
    blog: { count: exactCount(data.blogsCount), latestUpdate: newestUpdate(data.blogs) },
    // Shopify exposes no article count, so an article deleted without anything else changing stays invisible here.
    // The scheduled full sync is what reconciles that, which is why the schedule is not optional.
    article: { count: null, latestUpdate: newestUpdate(data.articles) },
    page: { count: exactCount(data.pagesCount), latestUpdate: newestUpdate(data.pages) }
  }
}

/**
 * Whether the store has moved on since the last sync, asked of Shopify rather than of a stored claim.
 *
 * A badge that calls a store up to date because a sync once finished is only reporting the app's own history. This
 * asks the store, so the answer is about the merchant's content rather than about the last successful run.
 *
 * A store that cannot be reached leaves the question open rather than answering it wrongly in either direction.
 */
export async function detectContentDrift(shopDomain: string, graphql: Graphql): Promise<ContentDrift> {
  try {
    const [live, stored] = await Promise.all([readLiveFingerprint(graphql), readStoredFingerprint(shopDomain)])
    if (stored === null) {
      return "unknown"
    }
    return compareFingerprints(live, stored)
  } catch (error) {
    console.error("Could not compare the store's content against the last sync.", error)
    return "unknown"
  }
}
