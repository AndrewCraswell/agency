import { createHash } from "node:crypto"
import { z } from "zod"

const PageInfoSchema = z.object({
  endCursor: z.string().nullable(),
  hasNextPage: z.boolean()
})

const ShopSchema = z.object({
  name: z.string(),
  primaryLocale: z.string().min(1),
  // Where the store bills from, which is the closest thing Shopify reports to the market it sells into. Keyword
  // figures are meaningless without a country, so this is what resolves one before any of them are bought.
  billingAddress: z.object({ countryCodeV2: z.string().nullable() }).nullable(),
  // Shopify reports the myshopify domain alongside every custom domain and alias attached to the
  // storefront, which is what lets the app recognize a store's own blog however it is addressed.
  myshopifyDomain: z.string().min(1),
  domains: z.array(z.object({ host: z.string().min(1) }))
})

const ShopLocaleSchema = z.object({
  locale: z.string().min(1),
  primary: z.boolean(),
  published: z.boolean()
})

const ProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  description: z.string(),
  descriptionHtml: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  productType: z.string(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT", "UNLISTED"]),
  tags: z.array(z.string()),
  totalInventory: z.number().int(),
  vendor: z.string(),
  priceRangeV2: z.object({
    minVariantPrice: z.object({ amount: z.string(), currencyCode: z.string() }),
    maxVariantPrice: z.object({ amount: z.string(), currencyCode: z.string() })
  })
})

const CollectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  description: z.string(),
  descriptionHtml: z.string(),
  updatedAt: z.iso.datetime(),
  productsCount: z.object({ count: z.number().int().nonnegative() })
})

/**
 * The identifiers of the collections that shoppers can actually reach.
 * A collection carries no storefront address of its own, and the field that reports its publications costs an extra
 * access scope, so the live ones are gathered by asking Shopify for that subset by name.
 */
const PublishedCollectionSchema = z.object({ id: z.string() })

const BlogSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  commentPolicy: z.string(),
  tags: z.array(z.string())
})

const ArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  body: z.string(),
  summary: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  isPublished: z.boolean(),
  tags: z.array(z.string()),
  author: z.object({ name: z.string() }).nullable(),
  blog: z.object({ id: z.string(), handle: z.string(), title: z.string() })
})

const PageSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  body: z.string(),
  bodySummary: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  isPublished: z.boolean()
})

const connections = {
  products: ProductSchema,
  collections: CollectionSchema,
  publishedCollections: PublishedCollectionSchema,
  blogs: BlogSchema,
  articles: ArticleSchema,
  pages: PageSchema
}

type ConnectionName = keyof typeof connections
type Graphql = (query: string, options: { variables: { after: string | null } }) => Promise<Response>

export type ScannedShopifyResource = {
  shopifyGid: string
  resourceType: "product" | "collection" | "blog" | "article" | "page"
  title: string
  handle: string
  canonicalUrl: string
  locale: string
  description: string
  content: string
  metadata: Record<string, unknown>
  isPublished: boolean
  isAvailable: boolean
  contentHash: string
  sourceCreatedAt: Date | null
  sourceUpdatedAt: Date | null
}

const queries: Record<ConnectionName, string> = {
  products: `#graphql
    query SyncProducts($after: String) {
      products(first: 100, after: $after, sortKey: ID) {
        nodes {
          id title handle description descriptionHtml createdAt updatedAt publishedAt
          productType status tags totalInventory vendor
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
        }
        pageInfo { endCursor hasNextPage }
      }
    }`,
  collections: `#graphql
    query SyncCollections($after: String) {
      collections(first: 100, after: $after, sortKey: ID) {
        nodes { id title handle description descriptionHtml updatedAt productsCount { count } }
        pageInfo { endCursor hasNextPage }
      }
    }`,
  publishedCollections: `#graphql
    query SyncPublishedCollections($after: String) {
      collections(first: 100, after: $after, sortKey: ID, query: "published_status:published") {
        nodes { id }
        pageInfo { endCursor hasNextPage }
      }
    }`,
  blogs: `#graphql
    query SyncBlogs($after: String) {
      blogs(first: 100, after: $after, sortKey: ID) {
        nodes { id title handle createdAt updatedAt commentPolicy tags }
        pageInfo { endCursor hasNextPage }
      }
    }`,
  articles: `#graphql
    query SyncArticles($after: String) {
      articles(first: 100, after: $after, sortKey: ID) {
        nodes {
          id title handle body summary createdAt updatedAt publishedAt isPublished tags
          author { name }
          blog { id handle title }
        }
        pageInfo { endCursor hasNextPage }
      }
    }`,
  pages: `#graphql
    query SyncPages($after: String) {
      pages(first: 100, after: $after, sortKey: ID) {
        nodes { id title handle body bodySummary createdAt updatedAt publishedAt isPublished }
        pageInfo { endCursor hasNextPage }
      }
    }`
}

function hashRepresentation(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function canonicalUrl(shopDomain: string, path: string) {
  return new URL(path, `https://${shopDomain}`).href
}

function normalizeProduct(
  shopDomain: string,
  locale: string,
  product: z.infer<typeof ProductSchema>
): ScannedShopifyResource {
  const metadata = {
    productType: product.productType,
    status: product.status,
    tags: product.tags,
    totalInventory: product.totalInventory,
    vendor: product.vendor,
    priceRange: product.priceRangeV2
  }
  const isPublished = product.publishedAt !== null

  return {
    shopifyGid: product.id,
    resourceType: "product",
    title: product.title,
    handle: product.handle,
    canonicalUrl: canonicalUrl(shopDomain, `/products/${product.handle}`),
    locale,
    description: product.description,
    content: product.descriptionHtml,
    metadata,
    isPublished,
    isAvailable: isPublished && product.status === "ACTIVE",
    contentHash: hashRepresentation({
      title: product.title,
      description: product.description,
      content: product.descriptionHtml,
      metadata
    }),
    sourceCreatedAt: new Date(product.createdAt),
    sourceUpdatedAt: new Date(product.updatedAt)
  }
}

const shopQuery = `#graphql
  query SyncShopProfile {
    shop { name myshopifyDomain domains { host } billingAddress { countryCodeV2 } }
    shopLocales { locale primary published }
  }`

function normalizeCollection(
  shopDomain: string,
  locale: string,
  collection: z.infer<typeof CollectionSchema>,
  isPublished: boolean
): ScannedShopifyResource {
  const metadata = { productCount: collection.productsCount.count }
  return {
    shopifyGid: collection.id,
    resourceType: "collection",
    title: collection.title,
    handle: collection.handle,
    canonicalUrl: canonicalUrl(shopDomain, `/collections/${collection.handle}`),
    locale,
    description: collection.description,
    content: collection.descriptionHtml,
    metadata,
    isPublished,
    // An empty collection is a dead end for a reader even when its page is live, so it stays out of suggestions.
    isAvailable: isPublished && collection.productsCount.count > 0,
    contentHash: hashRepresentation({
      title: collection.title,
      description: collection.description,
      content: collection.descriptionHtml,
      metadata
    }),
    sourceCreatedAt: null,
    sourceUpdatedAt: new Date(collection.updatedAt)
  }
}

function normalizeBlog(shopDomain: string, locale: string, blog: z.infer<typeof BlogSchema>): ScannedShopifyResource {
  const metadata = { commentPolicy: blog.commentPolicy, tags: blog.tags }
  return {
    shopifyGid: blog.id,
    resourceType: "blog",
    title: blog.title,
    handle: blog.handle,
    canonicalUrl: canonicalUrl(shopDomain, `/blogs/${blog.handle}`),
    locale,
    description: "",
    content: "",
    metadata,
    isPublished: true,
    isAvailable: true,
    contentHash: hashRepresentation({ title: blog.title, metadata }),
    sourceCreatedAt: new Date(blog.createdAt),
    sourceUpdatedAt: new Date(blog.updatedAt)
  }
}

function normalizeArticle(
  shopDomain: string,
  locale: string,
  article: z.infer<typeof ArticleSchema>
): ScannedShopifyResource {
  const metadata = {
    blogGid: article.blog.id,
    blogHandle: article.blog.handle,
    blogTitle: article.blog.title,
    // Kept so the editor can offer the names this store already publishes under.
    authorName: article.author?.name ?? "",
    tags: article.tags
  }
  return {
    shopifyGid: article.id,
    resourceType: "article",
    title: article.title,
    handle: article.handle,
    canonicalUrl: canonicalUrl(shopDomain, `/blogs/${article.blog.handle}/${article.handle}`),
    locale,
    description: article.summary ?? "",
    content: article.body,
    metadata,
    isPublished: article.isPublished,
    isAvailable: article.isPublished,
    contentHash: hashRepresentation({
      title: article.title,
      description: article.summary ?? "",
      content: article.body,
      metadata
    }),
    sourceCreatedAt: new Date(article.createdAt),
    sourceUpdatedAt: article.updatedAt === null ? null : new Date(article.updatedAt)
  }
}

function normalizePage(shopDomain: string, locale: string, page: z.infer<typeof PageSchema>): ScannedShopifyResource {
  const metadata = {}
  return {
    shopifyGid: page.id,
    resourceType: "page",
    title: page.title,
    handle: page.handle,
    canonicalUrl: canonicalUrl(shopDomain, `/pages/${page.handle}`),
    locale,
    description: page.bodySummary,
    content: page.body,
    metadata,
    isPublished: page.isPublished,
    isAvailable: page.isPublished,
    contentHash: hashRepresentation({
      title: page.title,
      description: page.bodySummary,
      content: page.body,
      metadata
    }),
    sourceCreatedAt: new Date(page.createdAt),
    sourceUpdatedAt: new Date(page.updatedAt)
  }
}

async function readConnection<NodeSchema extends z.ZodType>(
  graphql: Graphql,
  connectionName: ConnectionName,
  nodeSchema: NodeSchema
) {
  // Two of the queries read the same Shopify connection, so the reply is keyed by the connection rather than the query.
  const responseField = connectionName === "publishedCollections" ? "collections" : connectionName
  const nodes: z.output<NodeSchema>[] = []
  let after: string | null = null

  do {
    const response = await graphql(queries[connectionName], { variables: { after } })
    const payload = z
      .object({
        data: z.record(z.string(), z.unknown()),
        errors: z.array(z.object({ message: z.string() })).optional()
      })
      .parse(await response.json())
    if (payload.errors?.length) {
      throw new Error(payload.errors.map(({ message }) => message).join("; "))
    }

    const connection = z
      .object({ nodes: z.array(nodeSchema), pageInfo: PageInfoSchema })
      .parse(payload.data[responseField])
    nodes.push(...connection.nodes)
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null
    if (connection.pageInfo.hasNextPage && after === null) {
      throw new Error(`${connectionName} returned hasNextPage without an endCursor`)
    }
  } while (after !== null)

  return nodes
}

export async function scanShopifyResources(shopDomain: string, graphql: Graphql) {
  const shopResponse = await graphql(shopQuery, { variables: { after: null } })
  const shopPayload = z
    .object({
      data: z.object({
        shop: ShopSchema.omit({ primaryLocale: true }),
        shopLocales: z.array(ShopLocaleSchema)
      })
    })
    .parse(await shopResponse.json())
  const primaryLocale = shopPayload.data.shopLocales.find(({ primary }) => primary)
  if (primaryLocale === undefined) {
    throw new Error("Shopify did not return a primary shop locale")
  }
  const shop = ShopSchema.parse({ ...shopPayload.data.shop, primaryLocale: primaryLocale.locale })
  const [products, collections, publishedCollections, blogs, articles, pages] = await Promise.all([
    readConnection(graphql, "products", ProductSchema),
    readConnection(graphql, "collections", CollectionSchema),
    readConnection(graphql, "publishedCollections", PublishedCollectionSchema),
    readConnection(graphql, "blogs", BlogSchema),
    readConnection(graphql, "articles", ArticleSchema),
    readConnection(graphql, "pages", PageSchema)
  ])
  const liveCollectionGids = new Set(publishedCollections.map(({ id }) => id))

  return {
    shop,
    resources: [
      ...products.map((product) => normalizeProduct(shopDomain, shop.primaryLocale, product)),
      ...collections.map((collection) =>
        normalizeCollection(shopDomain, shop.primaryLocale, collection, liveCollectionGids.has(collection.id))
      ),
      ...blogs.map((blog) => normalizeBlog(shopDomain, shop.primaryLocale, blog)),
      ...articles.map((article) => normalizeArticle(shopDomain, shop.primaryLocale, article)),
      ...pages.map((page) => normalizePage(shopDomain, shop.primaryLocale, page))
    ]
  }
}
