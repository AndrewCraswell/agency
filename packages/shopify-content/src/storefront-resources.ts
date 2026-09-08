import { z } from "zod"
import { catalogProductLookup } from "./catalog-import.ts"
import { catalogMutation, collectionMembershipSource, createCollectionMutation } from "./catalog-setup.ts"
import type { AdminClient } from "./client.ts"
import type { AdapterRegistry, InstalledResource } from "./installer.ts"

const handle = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/)
const productHandle = z
  .string()
  .min(1)
  .regex(/^[^/\\?#]+$/)
  .refine((value) => [...value].every((character) => character.codePointAt(0)! >= 32))
const collectionSchema = z.strictObject({
  handle,
  title: z.string(),
  descriptionHtml: z.string(),
  sortOrder: z.string(),
  productHandles: z.array(productHandle),
  image: z.object({ url: z.url(), altText: z.string().nullable() }).nullable()
})
const articleSchema = z.strictObject({
  handle,
  title: z.string(),
  body: z.string(),
  summary: z.string().nullable(),
  tags: z.array(z.string()),
  isPublished: z.boolean(),
  publishDate: z.string().nullable(),
  author: z.object({ name: z.string() }),
  image: z.object({ url: z.url(), altText: z.string().nullable() }).nullable()
})
const blogSchema = z.strictObject({ handle, title: z.string(), articles: z.array(articleSchema) })
const collectionsQuery = `query MigrationCollections($query: String!) { collections(first: 2, query: $query) { nodes { id handle updatedAt } pageInfo { hasNextPage } } }`
export const migrationBlogsQuery = `query MigrationBlogs { blogs(first: 100) { nodes { id handle title articles(first: 100) { nodes { id handle title body summary tags isPublished publishedAt author { name } image { url altText } } pageInfo { hasNextPage } } } pageInfo { hasNextPage } } }`
const createBlogMutation = `mutation CreateMigrationBlog($blog: BlogCreateInput!) { blogCreate(blog: $blog) { blog { id handle } userErrors { field message } } }`
const createArticleMutation = `mutation CreateMigrationArticle($article: ArticleCreateInput!) { articleCreate(article: $article) { article { id handle } userErrors { field message } } }`
const resourceSchema = z.object({ id: z.string(), handle: z.string() }).passthrough()
const complete = z.object({ hasNextPage: z.literal(false) })

function resource(input: unknown, expectedHandle: string, route: string): InstalledResource {
  const parsed = resourceSchema.parse(input)
  if (parsed.handle !== expectedHandle) {
    throw new Error(`Shopify changed the requested handle: ${expectedHandle}. Inspect before retrying.`)
  }
  return { id: parsed.id, url: `${route}/${parsed.handle}`, state: parsed }
}

export function storefrontAdapters(client: AdminClient): AdapterRegistry {
  return {
    collection: {
      identity: (input) => String(input.handle),
      validate: (input) => {
        collectionSchema.parse(input)
      },
      find: async (input) => {
        const data = collectionSchema.parse(input)
        const response = z
          .object({ collections: z.object({ nodes: z.array(resourceSchema), pageInfo: complete }) })
          .parse(await client(collectionsQuery, { query: `handle:${data.handle}` })).collections
        if (response.nodes.length > 1) {
          throw new Error(`Ambiguous collection: ${data.handle}.`)
        }
        const found = response.nodes[0]
        return found ? resource(found, data.handle, "/collections") : undefined
      },
      create: async (input) => {
        const data = collectionSchema.parse(input)
        const ids: string[] = []
        for (const productHandle of data.productHandles) {
          const found = z
            .object({ product: resourceSchema.nullable() })
            .parse(await client(catalogProductLookup, { identifier: { handle: productHandle } })).product
          if (!found || found.handle !== productHandle) {
            throw new Error(`Collection product is missing: ${productHandle}.`)
          }
          ids.push(found.id)
        }
        const result = await catalogMutation(client, createCollectionMutation, {
          collection: {
            handle: data.handle,
            title: data.title,
            descriptionHtml: data.descriptionHtml,
            sortOrder: data.sortOrder,
            ...(data.image ? { image: { src: data.image.url, altText: data.image.altText ?? "" } } : {}),
            sources: ids.length ? [collectionMembershipSource("Fencing Club catalog snapshot", ids)] : []
          }
        })
        return resource(result.collectionCreate?.collection, data.handle, "/collections")
      }
    },
    blog: {
      identity: (input) => String(input.handle),
      validate: (input) => {
        blogSchema.parse(input)
      },
      find: async (input) => {
        const data = blogSchema.parse(input)
        const response = z
          .object({
            blogs: z.object({
              nodes: z.array(
                resourceSchema.extend({ articles: z.object({ nodes: z.array(resourceSchema), pageInfo: complete }) })
              ),
              pageInfo: complete
            })
          })
          .parse(await client(migrationBlogsQuery)).blogs
        const found = response.nodes.filter((blog) => blog.handle === data.handle)
        if (found.length > 1) {
          throw new Error(`Ambiguous blog: ${data.handle}.`)
        }
        return found[0] ? resource(found[0], data.handle, "/blogs") : undefined
      },
      conflict: (existing, input) => {
        const data = blogSchema.parse(input)
        const state = z.object({ articles: z.object({ nodes: z.array(resourceSchema) }) }).parse(existing.state)
        if (data.articles.some((article) => !state.articles.nodes.some((item) => item.handle === article.handle))) {
          return "Existing blog is missing packaged articles. Reconcile the blog before migration."
        }
        return undefined
      },
      create: async (input) => {
        const data = blogSchema.parse(input)
        const result = await catalogMutation(client, createBlogMutation, {
          blog: { handle: data.handle, title: data.title }
        })
        const blog = resource(result.blogCreate?.blog, data.handle, "/blogs")
        for (const item of data.articles) {
          const { image, publishDate, ...article } = item
          await catalogMutation(client, createArticleMutation, {
            article: {
              ...article,
              blogId: blog.id,
              summary: article.summary ?? "",
              ...(publishDate ? { publishDate } : {}),
              ...(image ? { image: { url: image.url, altText: image.altText ?? "" } } : {})
            }
          })
        }
        return blog
      }
    }
  }
}
