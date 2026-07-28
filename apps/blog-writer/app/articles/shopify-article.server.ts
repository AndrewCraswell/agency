import { z } from "zod"

type Graphql = (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>

const BlogSchema = z.object({ id: z.string(), title: z.string(), handle: z.string() })
const ArticleSchema = z.object({
  id: z.string(),
  handle: z.string(),
  isPublished: z.boolean(),
  blog: z.object({ handle: z.string() })
})
const UserErrorsSchema = z.array(z.object({ field: z.array(z.string()).nullable(), message: z.string() }))
const ThrownGraphqlErrorSchema = z.object({
  body: z.object({
    errors: z.object({ graphQLErrors: z.array(z.object({ message: z.string() })).min(1) })
  })
})

const blogQuery = `#graphql
  query DestinationBlog($id: ID!) {
    blog(id: $id) { id title handle }
    shop { name }
  }`

const articleCreateMutation = `#graphql
  mutation CreateArticle($article: ArticleCreateInput!) {
    articleCreate(article: $article) {
      article { id handle isPublished blog { handle } }
      userErrors { field message }
    }
  }`

const articleUpdateMutation = `#graphql
  mutation UpdateArticle($id: ID!, $article: ArticleUpdateInput!) {
    articleUpdate(id: $id, article: $article) {
      article { id handle isPublished blog { handle } }
      userErrors { field message }
    }
  }`

const articleDeleteMutation = `#graphql
  mutation DeleteArticle($id: ID!) {
    articleDelete(id: $id) {
      deletedArticleId
      userErrors { field message }
    }
  }`

export type ShopifyArticleWrite = {
  shopifyArticleGid: string
  shopifyArticleUrl: string
  handle: string
  isPublished: boolean
}

/** Raised when Shopify rejects a write so the caller can show the merchant what to fix instead of a generic failure. */
export class ShopifyArticleWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ShopifyArticleWriteError"
  }
}

/**
 * Runs one Admin API call.
 * The Shopify client throws on GraphQL errors, so they are converted here to keep the merchant-facing
 * message specific instead of collapsing into a generic failure.
 */
async function runGraphql(graphql: Graphql, query: string, variables: Record<string, unknown>) {
  try {
    return await graphql(query, { variables })
  } catch (error) {
    const thrown = ThrownGraphqlErrorSchema.safeParse(error)
    if (thrown.success) {
      throw new ShopifyArticleWriteError(thrown.data.body.errors.graphQLErrors.map(({ message }) => message).join("; "))
    }
    throw error
  }
}

async function readPayload<Schema extends z.ZodType>(response: Response, schema: Schema): Promise<z.output<Schema>> {
  const payload = z
    .object({ data: z.unknown(), errors: z.array(z.object({ message: z.string() })).optional() })
    .parse(await response.json())
  if (payload.errors?.length) {
    throw new ShopifyArticleWriteError(payload.errors.map(({ message }) => message).join("; "))
  }
  return schema.parse(payload.data)
}

function storefrontUrl(shopDomain: string, blogHandle: string, articleHandle: string) {
  return new URL(`/blogs/${blogHandle}/${articleHandle}`, `https://${shopDomain}`).href
}

/**
 * Builds the metafields the online store reads for the search engine listing.
 * Themes render `global.title_tag` and `global.description_tag`, so an empty value is sent to clear the override
 * rather than omitted, which would leave a stale listing behind.
 */
function seoMetafields(seoTitle: string, seoDescription: string) {
  if (seoTitle === "" && seoDescription === "") {
    return {}
  }
  return {
    metafields: [
      { namespace: "global", key: "title_tag", type: "single_line_text_field", value: seoTitle },
      { namespace: "global", key: "description_tag", type: "single_line_text_field", value: seoDescription }
    ]
  }
}

/**
 * Creates or updates the Shopify article for one revision.
 * The destination blog is verified first so a deleted blog fails before the mutation half-writes the article.
 */
export async function writeShopifyArticle(
  graphql: Graphql,
  input: {
    shopDomain: string
    shopifyArticleGid: string | null
    destinationBlogGid: string
    title: string
    body: string
    summary: string
    tags: string[]
    author: string
    handle: string
    seoTitle: string
    seoDescription: string
    imageUrl: string | null
    imageAltText: string
    isPublished: boolean
  }
): Promise<ShopifyArticleWrite> {
  const blogPayload = await readPayload(
    await runGraphql(graphql, blogQuery, { id: input.destinationBlogGid }),
    z.object({ blog: BlogSchema.nullable(), shop: z.object({ name: z.string() }) })
  )
  if (blogPayload.blog === null) {
    throw new ShopifyArticleWriteError("The destination blog no longer exists in this store")
  }

  const article = {
    title: input.title,
    body: input.body,
    summary: input.summary,
    tags: input.tags,
    isPublished: input.isPublished,
    author: { name: input.author === "" ? blogPayload.shop.name : input.author },
    ...(input.handle === "" ? {} : { handle: input.handle }),
    ...(input.imageUrl === null ? {} : { image: { url: input.imageUrl, altText: input.imageAltText } }),
    ...seoMetafields(input.seoTitle, input.seoDescription)
  }
  const [mutation, variables, resultKey] =
    input.shopifyArticleGid === null
      ? ([
          articleCreateMutation,
          { article: { ...article, blogId: input.destinationBlogGid } },
          "articleCreate"
        ] as const)
      : ([
          articleUpdateMutation,
          { id: input.shopifyArticleGid, article: { ...article, redirectNewHandle: true } },
          "articleUpdate"
        ] as const)

  const payload = await readPayload(
    await runGraphql(graphql, mutation, variables),
    z.object({
      [resultKey]: z.object({ article: ArticleSchema.nullable(), userErrors: UserErrorsSchema })
    })
  )
  const result = payload[resultKey]
  if (result.userErrors.length > 0) {
    throw new ShopifyArticleWriteError(result.userErrors.map(({ message }) => message).join("; "))
  }
  if (result.article === null) {
    throw new ShopifyArticleWriteError("Shopify did not return the saved article")
  }

  return {
    shopifyArticleGid: result.article.id,
    shopifyArticleUrl: storefrontUrl(input.shopDomain, result.article.blog.handle, result.article.handle),
    handle: result.article.handle,
    isPublished: result.article.isPublished
  }
}

/** Removes the article from the store, so a post deleted in the app stops serving on the online store. */
export async function deleteShopifyArticle(graphql: Graphql, shopifyArticleGid: string) {
  const payload = await readPayload(
    await runGraphql(graphql, articleDeleteMutation, { id: shopifyArticleGid }),
    z.object({
      articleDelete: z.object({ deletedArticleId: z.string().nullable(), userErrors: UserErrorsSchema })
    })
  )
  if (payload.articleDelete.userErrors.length > 0) {
    throw new ShopifyArticleWriteError(payload.articleDelete.userErrors.map(({ message }) => message).join("; "))
  }
}
