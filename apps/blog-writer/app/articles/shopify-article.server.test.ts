import { describe, expect, it, vi } from "vitest"
import { ShopifyArticleWriteError, writeShopifyArticle } from "./shopify-article.server"

const blog = { id: "gid://shopify/Blog/1", title: "Field notes", handle: "field-notes" }
const shop = { name: "Contoso Camp" }
const article = {
  id: "gid://shopify/Article/9",
  handle: "trail-food",
  isPublished: false,
  blog: { handle: "field-notes" }
}

type Graphql = Parameters<typeof writeShopifyArticle>[0]

function response(data: unknown) {
  return new Response(JSON.stringify({ data }))
}

const writeInput = {
  shopDomain: "contosocamp.myshopify.com",
  shopifyArticleGid: null,
  destinationBlogGid: blog.id,
  title: "Trail food",
  body: "<p>Pack calories.</p>",
  summary: "What to pack",
  tags: ["camping"],
  author: "",
  handle: "",
  seoTitle: "",
  seoDescription: "",
  imageUrl: null,
  imageAltText: "",
  isPublished: false
}

describe("writeShopifyArticle", () => {
  it("creates an article and derives its storefront address", async () => {
    const graphql = vi.fn<Graphql>(async (query) =>
      query.includes("DestinationBlog")
        ? response({ blog, shop })
        : response({ articleCreate: { article, userErrors: [] } })
    )

    await expect(writeShopifyArticle(graphql, writeInput)).resolves.toEqual({
      shopifyArticleGid: article.id,
      shopifyArticleUrl: "https://contosocamp.myshopify.com/blogs/field-notes/trail-food",
      handle: "trail-food",
      isPublished: false
    })
    expect(graphql.mock.calls[1]?.[1]).toEqual({
      variables: {
        article: {
          blogId: blog.id,
          author: { name: shop.name },
          title: "Trail food",
          body: "<p>Pack calories.</p>",
          summary: "What to pack",
          tags: ["camping"],
          isPublished: false
        }
      }
    })
  })

  it("updates the existing article when it was already saved to Shopify", async () => {
    const graphql = vi.fn<Graphql>(async (query) =>
      query.includes("DestinationBlog")
        ? response({ blog, shop })
        : response({ articleUpdate: { article: { ...article, isPublished: true }, userErrors: [] } })
    )

    const result = await writeShopifyArticle(graphql, {
      ...writeInput,
      shopifyArticleGid: article.id,
      isPublished: true
    })

    expect(result.isPublished).toBe(true)
    expect(graphql.mock.calls[1]?.[0]).toContain("UpdateArticle")
    expect(graphql.mock.calls[1]?.[1]).toEqual({
      variables: {
        id: article.id,
        article: {
          title: "Trail food",
          body: "<p>Pack calories.</p>",
          summary: "What to pack",
          tags: ["camping"],
          author: { name: shop.name },
          isPublished: true,
          redirectNewHandle: true
        }
      }
    })
  })

  it("sends the author, address, image, and search engine listing the merchant chose", async () => {
    const graphql = vi.fn<Graphql>(async (query) =>
      query.includes("DestinationBlog")
        ? response({ blog, shop })
        : response({ articleCreate: { article, userErrors: [] } })
    )

    await writeShopifyArticle(graphql, {
      ...writeInput,
      author: "Dana Reed",
      handle: "trail-food",
      seoTitle: "Trail food that travels",
      seoDescription: "What to pack for three days out.",
      imageUrl: "https://cdn.shopify.com/trail-food.jpg",
      imageAltText: "A packed food bag"
    })

    expect(graphql.mock.calls[1]?.[1]).toEqual({
      variables: {
        article: {
          blogId: blog.id,
          author: { name: "Dana Reed" },
          handle: "trail-food",
          image: { url: "https://cdn.shopify.com/trail-food.jpg", altText: "A packed food bag" },
          metafields: [
            {
              namespace: "global",
              key: "title_tag",
              type: "single_line_text_field",
              value: "Trail food that travels"
            },
            {
              namespace: "global",
              key: "description_tag",
              type: "single_line_text_field",
              value: "What to pack for three days out."
            }
          ],
          title: "Trail food",
          body: "<p>Pack calories.</p>",
          summary: "What to pack",
          tags: ["camping"],
          isPublished: false
        }
      }
    })
  })

  it("fails before writing when the destination blog is gone", async () => {
    const graphql = vi.fn<Graphql>(async () => response({ blog: null, shop }))
    await expect(writeShopifyArticle(graphql, writeInput)).rejects.toThrow(ShopifyArticleWriteError)
    expect(graphql).toHaveBeenCalledTimes(1)
  })

  it("surfaces the errors Shopify reports for the mutation", async () => {
    const graphql = vi.fn<Graphql>(async (query) =>
      query.includes("DestinationBlog")
        ? response({ blog, shop })
        : response({
            articleCreate: { article: null, userErrors: [{ field: ["title"], message: "Title is too long" }] }
          })
    )
    await expect(writeShopifyArticle(graphql, writeInput)).rejects.toThrow("Title is too long")
  })
})
