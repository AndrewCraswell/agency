import { z } from "zod"
import type { AdminClient } from "./client.ts"

export const catalogProductsQuery = `query CatalogProducts($after: String) {
  shop { id name myshopifyDomain primaryDomain { host } currencyCode }
  products(first: 1, after: $after, sortKey: ID) {
    nodes {
      id handle title descriptionHtml productType vendor tags status templateSuffix isGiftCard requiresSellingPlan
      category { id } seo { title description } options { name position optionValues { name } }
      variants(first: 100) {
        nodes { id title sku barcode price compareAtPrice taxable inventoryPolicy requiresComponents
          selectedOptions { name value }
          inventoryItem { requiresShipping tracked measurement { weight { value unit } } }
          image { url altText }
        }
        pageInfo { hasNextPage }
      }
      media(first: 100) {
        nodes { id mediaContentType alt ... on MediaImage { image { url } } ... on ExternalVideo { originUrl } }
        pageInfo { hasNextPage }
      }
      metafields(first: 100) { nodes { namespace key type value } pageInfo { hasNextPage } }
      collections(first: 100) { nodes { id handle } pageInfo { hasNextPage } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`

const completeConnection = z.object({
  nodes: z.array(z.record(z.string(), z.unknown())),
  pageInfo: z.object({ hasNextPage: z.literal(false) })
})
export const catalogProductSchema = z
  .object({
    id: z.string(),
    handle: z.string(),
    title: z.string(),
    variants: completeConnection,
    media: completeConnection,
    metafields: completeConnection,
    collections: completeConnection
  })
  .passthrough()
const shopSchema = z.object({
  id: z.string(),
  name: z.string(),
  myshopifyDomain: z.string(),
  primaryDomain: z.object({ host: z.string() }),
  currencyCode: z.string()
})
const responseSchema = z.object({
  shop: shopSchema,
  products: z.object({
    nodes: z.array(catalogProductSchema),
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() })
  })
})
export const catalogSnapshotSchema = z.object({
  shop: shopSchema,
  products: z.array(catalogProductSchema),
  capturedAt: z.iso.datetime()
})

export async function snapshotCatalog(client: AdminClient, store: string, progress?: (count: number) => void) {
  const products: z.infer<typeof catalogProductSchema>[] = []
  const cursors = new Set<string>()
  const handles = new Set<string>()
  let after: string | undefined
  let shop: z.infer<typeof shopSchema> | undefined
  while (true) {
    const response = responseSchema.parse(await client(catalogProductsQuery, { after }))
    if (response.shop.myshopifyDomain !== store || (shop && shop.id !== response.shop.id)) {
      throw new Error("Catalog source identity changed.")
    }
    shop = response.shop
    for (const product of response.products.nodes) {
      if (handles.has(product.handle)) {
        throw new Error(`Duplicate source product: ${product.handle}.`)
      }
      handles.add(product.handle)
      products.push(product)
    }
    progress?.(products.length)
    if (!response.products.pageInfo.hasNextPage) {
      return { shop, products, capturedAt: new Date().toISOString() }
    }
    const cursor = response.products.pageInfo.endCursor
    if (!cursor || cursors.has(cursor)) {
      throw new Error("Catalog pagination did not advance.")
    }
    cursors.add(cursor)
    after = cursor
  }
}
