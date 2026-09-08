import { createHash } from "node:crypto"
import { z } from "zod"
import { brandCopy } from "./catalog-import.ts"
import { catalogSnapshotSchema } from "./catalog-snapshot.ts"
import type { AdminClient } from "./client.ts"

const optionSchema = z.object({ name: z.string(), value: z.string() })
const componentSchema = z.object({
  quantity: z.number().int().positive(),
  productVariant: z.object({ id: z.string() })
})
const complete = z.object({ hasNextPage: z.literal(false) })
export const importedProductQuery = `query ImportedProduct($identifier: ProductIdentifierInput!) {
  product: productByIdentifier(identifier: $identifier) {
    id handle status title descriptionHtml options { name optionValues { name } }
    metafield(namespace: "custom", key: "size_chart") { id value type compareDigest }
    variants(first: 100) { nodes { id sku price compareAtPrice selectedOptions { name value }
      inventoryItem { id tracked inventoryLevels(first: 10) { nodes { id location { id } quantities(names: ["available"]) { name quantity } } pageInfo { hasNextPage } } }
      productVariantComponents(first: 30) { nodes { quantity productVariant { id } } pageInfo { hasNextPage } }
    } pageInfo { hasNextPage } }
    media(first: 100) { nodes { id status ... on MediaImage { image { url } } } pageInfo { hasNextPage } }
  }
}`
export const importedProductSchema = z.object({
  id: z.string(),
  handle: z.string(),
  status: z.string(),
  title: z.string(),
  descriptionHtml: z.string(),
  options: z.array(z.object({ name: z.string(), optionValues: z.array(z.object({ name: z.string() })) })),
  metafield: z
    .object({ id: z.string(), value: z.string(), type: z.string(), compareDigest: z.string().nullable() })
    .nullable(),
  variants: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        sku: z.string().nullable(),
        price: z.string(),
        compareAtPrice: z.string().nullable(),
        selectedOptions: z.array(optionSchema),
        inventoryItem: z.object({
          id: z.string(),
          tracked: z.boolean(),
          inventoryLevels: z.object({
            nodes: z.array(
              z.object({
                id: z.string(),
                location: z.object({ id: z.string() }),
                quantities: z.array(z.object({ name: z.string(), quantity: z.number() }))
              })
            ),
            pageInfo: complete
          })
        }),
        productVariantComponents: z.object({ nodes: z.array(componentSchema), pageInfo: complete })
      })
    ),
    pageInfo: complete
  }),
  media: z.object({
    nodes: z.array(
      z.object({ id: z.string(), status: z.string(), image: z.object({ url: z.string() }).nullable().optional() })
    ),
    pageInfo: complete
  })
})
export const catalogSetupQuery = `query CatalogSetup {
  shop { id myshopifyDomain }
  locations(first: 20) { nodes { id name isActive } }
  publications(first: 20) { nodes { id name } }
  collections(first: 250) { nodes { id handle sources { ... on CollectionConditionsSource { id title } } } pageInfo { hasNextPage } }
}`
export const catalogSetupSchema = z.object({
  shop: z.object({ id: z.string(), myshopifyDomain: z.string() }),
  locations: z.object({ nodes: z.array(z.object({ id: z.string(), name: z.string(), isActive: z.boolean() })) }),
  publications: z.object({ nodes: z.array(z.object({ id: z.string(), name: z.string() })) }),
  collections: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        handle: z.string(),
        sources: z.array(z.object({ id: z.string().optional(), title: z.string().optional() }))
      })
    ),
    pageInfo: complete
  })
})
export const restoreBundlesMutation = `mutation RestoreBundles($input: [ProductVariantRelationshipUpdateInput!]!) {
  productVariantRelationshipBulkUpdate(input: $input) { parentProductVariants { id } userErrors { field message } }
}`
export const createCollectionMutation = `mutation CreateCatalogCollection($collection: CollectionCreateInput!) {
  collectionCreate(collection: $collection) { collection { id handle } userErrors { field message } }
}`
export const updateCollectionMutation = `mutation AddCatalogCollectionSource($collection: CollectionUpdateInput!) {
  collectionUpdate(collection: $collection) { collection { id handle } userErrors { field message } }
}`
export const activateProductMutation = `mutation ActivateCatalogProduct($product: ProductUpdateInput!) {
  productUpdate(product: $product) { product { id handle status } userErrors { field message } }
}`
export const publishResourceMutation = `mutation PublishCatalogResource($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) { userErrors { field message } }
}`
export const setStockMutation = `mutation SetTestStock($input: InventorySetQuantitiesInput!, $key: String!) {
  inventorySetQuantities(input: $input) @idempotent(key: $key) { inventoryAdjustmentGroup { reason } userErrors { field message } }
}`

export async function catalogMutation(client: AdminClient, query: string, variables: Record<string, unknown>) {
  const response = z
    .record(z.string(), z.object({ userErrors: z.array(z.object({ message: z.string() })) }).passthrough())
    .parse(await client(query, variables, true))
  for (const result of Object.values(response)) {
    if (result.userErrors.length) {
      throw new Error(result.userErrors.map((error) => error.message).join("; "))
    }
  }
  return response
}

function optionKey(options: z.infer<typeof optionSchema>[]) {
  return JSON.stringify(options.map((option) => [brandCopy(option.name), brandCopy(option.value)]))
}

export function mapImportedVariants(sourceInput: unknown, destinationInput: unknown) {
  const snapshot = catalogSnapshotSchema.parse(sourceInput)
  const destination = z.array(importedProductSchema).parse(destinationInput)
  const result = new Map<string, string>()
  for (const source of snapshot.products) {
    const matches = destination.filter((product) => product.handle === source.handle)
    const product = matches[0]
    if (matches.length !== 1 || !product) {
      throw new Error(`Missing or ambiguous imported product: ${source.handle}.`)
    }
    if (product.variants.nodes.length !== source.variants.nodes.length) {
      throw new Error(`Variant count differs: ${source.handle}.`)
    }
    for (const originalInput of source.variants.nodes) {
      const original = z
        .object({
          id: z.string(),
          sku: z.string().nullable(),
          price: z.string(),
          compareAtPrice: z.string().nullable(),
          requiresComponents: z.boolean().optional(),
          selectedOptions: z.array(optionSchema)
        })
        .parse(originalInput)
      const candidates = product.variants.nodes.filter(
        (variant) => optionKey(variant.selectedOptions) === optionKey(original.selectedOptions)
      )
      const match = candidates[0]
      if (
        candidates.length !== 1 ||
        !match ||
        (match.sku ?? "") !== (original.sku ?? "") ||
        ((!original.requiresComponents || !match.productVariantComponents.nodes.length) &&
          (match.price !== original.price || match.compareAtPrice !== original.compareAtPrice))
      ) {
        throw new Error(`Imported variant differs: ${source.handle}/${original.sku}.`)
      }
      result.set(original.id, match.id)
    }
  }
  return result
}

export async function loadBundleCaptures(sourceInput: unknown, read: (filename: string) => Promise<unknown>) {
  const source = catalogSnapshotSchema.parse(sourceInput)
  const captures: unknown[] = []
  for (const product of source.products) {
    if (!product.variants.nodes.some((variant) => variant.requiresComponents === true)) {
      continue
    }
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(product.handle)) {
      throw new Error(`Unsupported bundle capture filename: ${product.handle}.`)
    }
    const capture = await read(`migration-bundle-${product.handle}.json`)
    const identity = z.object({ product: z.object({ id: z.string(), handle: z.string() }) }).parse(capture).product
    if (identity.id !== product.id || identity.handle !== product.handle) {
      throw new Error(`Bundle capture does not match the source: ${product.handle}.`)
    }
    captures.push(capture)
  }
  return captures
}

export function bundlePriceUpdates(sourceInput: unknown, destinationInput: unknown, variants: Map<string, string>) {
  const source = catalogSnapshotSchema.parse(sourceInput)
  const destination = z.array(importedProductSchema).parse(destinationInput)
  return source.products.flatMap((original) => {
    const product = destination.find((item) => item.handle === original.handle)
    if (!product) {
      throw new Error(`Missing bundle product: ${original.handle}.`)
    }
    const prices = original.variants.nodes.flatMap((input) => {
      const variant = z
        .object({
          id: z.string(),
          price: z.string(),
          compareAtPrice: z.string().nullable(),
          requiresComponents: z.boolean().optional()
        })
        .parse(input)
      if (!variant.requiresComponents) {
        return []
      }
      const current = product.variants.nodes.find((item) => item.id === variants.get(variant.id))
      if (!current?.productVariantComponents.nodes.length) {
        throw new Error(`Bundle components missing: ${original.handle}.`)
      }
      if (current.price === variant.price && current.compareAtPrice === variant.compareAtPrice) {
        return []
      }
      if (product.status !== "DRAFT") {
        throw new Error(`Refusing to reset an active bundle price: ${original.handle}.`)
      }
      return [{ id: current.id, price: variant.price, compareAtPrice: variant.compareAtPrice }]
    })
    return prices.length ? [{ productId: product.id, variants: prices }] : []
  })
}

export function bundleUpdates(bundleInput: unknown, variants: Map<string, string>, destinationInput: unknown) {
  const bundles = z
    .array(
      z.object({
        product: z.object({
          handle: z.string(),
          variants: z.object({
            nodes: z.array(
              z.object({
                id: z.string(),
                productVariantComponents: z.object({ nodes: z.array(componentSchema), pageInfo: complete })
              })
            ),
            pageInfo: complete
          })
        })
      })
    )
    .parse(bundleInput)
  const destination = z.array(importedProductSchema).parse(destinationInput)
  const current = new Map(
    destination.flatMap((product) => product.variants.nodes.map((variant) => [variant.id, variant] as const))
  )
  const mapped = (id: string) => {
    const value = variants.get(id)
    if (!value) {
      throw new Error(`Bundle variant was not imported: ${id}.`)
    }
    return value
  }
  return bundles.flatMap((bundle) =>
    bundle.product.variants.nodes.flatMap((parent) => {
      const parentProductVariantId = mapped(parent.id)
      const desired = parent.productVariantComponents.nodes.map((component) => ({
        id: mapped(component.productVariant.id),
        quantity: component.quantity
      }))
      const existing = current.get(parentProductVariantId)?.productVariantComponents.nodes ?? []
      for (const component of existing) {
        if (
          !desired.some((wanted) => wanted.id === component.productVariant.id && wanted.quantity === component.quantity)
        ) {
          throw new Error(`Conflicting bundle components: ${bundle.product.handle}.`)
        }
      }
      const missing = desired.filter((component) => !existing.some((found) => found.productVariant.id === component.id))
      return missing.length ? [{ parentProductVariantId, productVariantRelationshipsToCreate: missing }] : []
    })
  )
}

export function collectionMembershipSource(title: string, productIds: string[]) {
  return {
    source: { title, targetType: "PRODUCTS", inclusion: { selections: productIds.map((productId) => ({ productId })) } }
  }
}

export function stockSeed(destinationInput: unknown, locationId: string, count = 20) {
  const products = z.array(importedProductSchema).parse(destinationInput)
  const quantities = products.flatMap((product) =>
    product.variants.nodes.flatMap((variant) => {
      if (variant.productVariantComponents.nodes.length) {
        return []
      }
      const level = variant.inventoryItem.inventoryLevels.nodes.find((item) => item.location.id === locationId)
      if (!level) {
        throw new Error(`Inventory location missing for ${product.handle}/${variant.sku}.`)
      }
      const quantity = level.quantities.find((item) => item.name === "available")?.quantity
      if (quantity !== 0) {
        return []
      }
      return [{ inventoryItemId: variant.inventoryItem.id, locationId, quantity: count, changeFromQuantity: 0 }]
    })
  )
  return { quantities, key: createHash("sha256").update(JSON.stringify(quantities)).digest("hex") }
}
