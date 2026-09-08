import { createHash } from "node:crypto"
import { z } from "zod"
import { brandCopy } from "./catalog-import.ts"
import {
  activateProductMutation,
  bundleUpdates,
  bundlePriceUpdates,
  catalogMutation,
  catalogSetupQuery,
  catalogSetupSchema,
  collectionMembershipSource,
  createCollectionMutation,
  importedProductQuery,
  importedProductSchema,
  mapImportedVariants,
  publishResourceMutation,
  restoreBundlesMutation,
  setStockMutation,
  stockSeed,
  updateCollectionMutation
} from "./catalog-setup.ts"
import { catalogSnapshotSchema } from "./catalog-snapshot.ts"
import type { AdminClient } from "./client.ts"
import { setMetafields } from "./queries.ts"

const collectionSchema = z.object({
  handle: z.string(),
  title: z.string(),
  descriptionHtml: z.string(),
  sortOrder: z.string(),
  image: z.object({ url: z.string(), altText: z.string().nullable() }).nullable(),
  productHandles: z.array(z.string()).optional()
})
const productResponse = z.object({ product: importedProductSchema.nullable() })
const chartsQuery = `query CatalogCharts { metaobjects(type: "size_chart", first: 100) { nodes { id handle capabilities { publishable { status } } } pageInfo { hasNextPage } } }`
const chartResponse = z.object({
  metaobjects: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        handle: z.string(),
        capabilities: z.object({ publishable: z.object({ status: z.string() }) })
      })
    ),
    pageInfo: z.object({ hasNextPage: z.literal(false) })
  })
})

export async function finalizeCatalog(
  client: AdminClient,
  sourceInput: unknown,
  contentInput: unknown,
  bundles: unknown,
  assignmentsInput: unknown,
  destination: string,
  locationId: string,
  publicationId: string,
  report?: (event: Record<string, unknown>) => void
) {
  if (destination !== "contosocamp.myshopify.com") {
    throw new Error("Catalog setup is restricted to Contoso.")
  }
  const source = catalogSnapshotSchema.parse(sourceInput)
  if (source.shop.myshopifyDomain !== "8f3f5f-3.myshopify.com" || source.shop.primaryDomain.host !== "fencing.club") {
    throw new Error("Unexpected source snapshot.")
  }
  const setup = catalogSetupSchema.parse(await client(catalogSetupQuery))
  if (setup.shop.myshopifyDomain !== destination || setup.shop.id === source.shop.id) {
    throw new Error("Unexpected destination.")
  }
  if (!setup.locations.nodes.some((location) => location.id === locationId && location.isActive)) {
    throw new Error("Test location is unavailable.")
  }
  if (
    !setup.publications.nodes.some(
      (publication) => publication.id === publicationId && publication.name === "Online Store"
    )
  ) {
    throw new Error("Only the Online Store publication is supported.")
  }
  const collections = z
    .object({
      collections: z.object({ nodes: z.array(collectionSchema), pageInfo: z.object({ hasNextPage: z.literal(false) }) })
    })
    .parse(contentInput).collections.nodes
  const assignments = z.record(z.string(), z.string()).parse(assignmentsInput)
  const imported: z.infer<typeof importedProductSchema>[] = []
  for (const product of source.products) {
    const current = productResponse.parse(
      await client(importedProductQuery, { identifier: { handle: product.handle } })
    ).product
    if (!current || current.handle !== product.handle) {
      throw new Error(`Missing product: ${product.handle}.`)
    }
    if (
      current.title !== brandCopy(product.title) ||
      current.descriptionHtml !== brandCopy(z.string().parse(product.descriptionHtml))
    ) {
      throw new Error(`Product content differs: ${product.handle}.`)
    }
    if (
      current.media.nodes.length !== product.media.nodes.length ||
      current.media.nodes.some((media) => media.status !== "READY" || !media.image?.url)
    ) {
      throw new Error(`Product images are not ready: ${product.handle}. Run setup again after processing.`)
    }
    imported.push(current)
    report?.({ phase: "verified", handle: product.handle })
  }
  const variants = mapImportedVariants(source, imported)
  const updates = bundleUpdates(bundles, variants, imported)
  for (let start = 0; start < updates.length; start += 20) {
    await catalogMutation(client, restoreBundlesMutation, { input: updates.slice(start, start + 20) })
  }
  const bundled = new Set(updates.map((item) => item.parentProductVariantId))
  for (const product of imported) {
    if (!product.variants.nodes.some((variant) => bundled.has(variant.id))) {
      continue
    }
    const current = productResponse.parse(
      await client(importedProductQuery, { identifier: { handle: product.handle } })
    ).product
    if (!current) {
      throw new Error("Bundle disappeared after update.")
    }
    Object.assign(product, current)
  }
  if (bundleUpdates(bundles, variants, imported).length) {
    throw new Error("Bundle relationships are incomplete.")
  }
  report?.({ phase: "bundles", updated: updates.length })
  const priceUpdates = bundlePriceUpdates(source, imported, variants)
  for (const update of priceUpdates) {
    await catalogMutation(
      client,
      `mutation RestoreBundlePrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) { productVariants { id price compareAtPrice } userErrors { field message } }
    }`,
      update
    )
    const product = imported.find((item) => item.id === update.productId)
    if (!product) {
      throw new Error("Bundle product disappeared.")
    }
    const fresh = productResponse.parse(
      await client(importedProductQuery, { identifier: { handle: product.handle } })
    ).product
    if (!fresh) {
      throw new Error("Bundle price verification failed.")
    }
    Object.assign(product, fresh)
  }
  if (bundlePriceUpdates(source, imported, variants).length) {
    throw new Error("Bundle prices did not match the source after restoration.")
  }
  const productsByHandle = new Map(imported.map((product) => [product.handle, product]))
  const chartRecords = chartResponse.parse(await client(chartsQuery)).metaobjects.nodes
  for (const [handle, chartHandle] of Object.entries(assignments)) {
    const product = productsByHandle.get(handle)
    const chart = chartRecords.find(
      (record) => record.handle === chartHandle && record.capabilities.publishable.status === "ACTIVE"
    )
    if (!product || !chart) {
      throw new Error(`Missing product or active chart: ${handle}/${chartHandle}.`)
    }
    if (product.metafield?.value === chart.id && product.metafield.type === "metaobject_reference") {
      continue
    }
    if (product.metafield) {
      throw new Error(`Unexpected existing chart assignment: ${handle}.`)
    }
    await catalogMutation(client, setMetafields, {
      metafields: [
        {
          ownerId: product.id,
          namespace: "custom",
          key: "size_chart",
          type: "metaobject_reference",
          value: chart.id,
          compareDigest: null
        }
      ]
    })
    report?.({ phase: "assigned", handle, chart: chartHandle })
  }
  const quantityPlan = stockSeed(imported, locationId)
  for (let start = 0; start < quantityPlan.quantities.length; start += 100) {
    const quantities = quantityPlan.quantities.slice(start, start + 100)
    const key = createHash("sha256").update(JSON.stringify(quantities)).digest("hex")
    await catalogMutation(client, setStockMutation, {
      input: {
        name: "available",
        reason: "correction",
        referenceDocumentUri: "gid://fencing-club/TestCatalog/contoso",
        quantities
      },
      key
    })
  }
  report?.({ phase: "test-stock", items: quantityPlan.quantities.length })
  for (const collection of collections) {
    const members =
      collection.productHandles ??
      source.products
        .filter((product) => product.collections.nodes.some((item) => item.handle === collection.handle))
        .map((product) => product.handle)
    const ids = members.map((handle) => {
      const product = productsByHandle.get(handle)
      if (!product) {
        throw new Error(`Collection product not imported: ${handle}.`)
      }
      return product.id
    })
    const title = "Fencing Club catalog snapshot"
    const memberSource = collectionMembershipSource(title, ids)
    const existing = setup.collections.nodes.find((item) => item.handle === collection.handle)
    let id = existing?.id
    if (existing && ids.length && !existing.sources.some((item) => item.title === title)) {
      await catalogMutation(client, updateCollectionMutation, {
        collection: { id: existing.id, sourcesToCreate: [memberSource] }
      })
    } else if (!existing) {
      const response = await catalogMutation(client, createCollectionMutation, {
        collection: {
          handle: collection.handle,
          title: brandCopy(collection.title),
          descriptionHtml: brandCopy(collection.descriptionHtml),
          sortOrder: collection.sortOrder,
          ...(collection.image
            ? { image: { src: collection.image.url, altText: brandCopy(collection.image.altText ?? "") } }
            : {}),
          sources: ids.length ? [memberSource] : []
        }
      })
      id = z
        .object({ collection: z.object({ id: z.string(), handle: z.literal(collection.handle) }) })
        .parse(response.collectionCreate).collection.id
    }
    if (!id) {
      throw new Error(`Missing collection ID: ${collection.handle}.`)
    }
    await catalogMutation(client, publishResourceMutation, { id, input: [{ publicationId }] })
    report?.({ phase: "collection", handle: collection.handle, members: ids.length })
  }
  for (const original of source.products) {
    const product = productsByHandle.get(original.handle)
    if (!product) {
      throw new Error("Imported product disappeared.")
    }
    const status = z.enum(["ACTIVE", "DRAFT", "ARCHIVED", "UNLISTED"]).parse(original.status)
    if (product.status !== status) {
      await catalogMutation(client, activateProductMutation, { product: { id: product.id, status } })
    }
    if (status === "ACTIVE" || status === "UNLISTED") {
      await catalogMutation(client, publishResourceMutation, { id: product.id, input: [{ publicationId }] })
    }
    report?.({ phase: "ready", handle: original.handle, status })
  }
  return {
    products: imported.length,
    collections: collections.length,
    assignments: Object.keys(assignments).length,
    bundleVariants: updates.length
  }
}
