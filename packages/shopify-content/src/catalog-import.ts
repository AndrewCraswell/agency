import { z } from "zod"
import { catalogSnapshotSchema } from "./catalog-snapshot.ts"
import type { AdminClient } from "./client.ts"

const text = z.string()
const nullableText = text.nullable()
const image = z.object({ url: z.url(), altText: nullableText.optional() })
const metafield = z.object({ namespace: text, key: text, type: text, value: text })
const variant = z.object({
  id: text,
  sku: nullableText,
  barcode: nullableText,
  price: text,
  compareAtPrice: nullableText,
  taxable: z.boolean(),
  inventoryPolicy: z.enum(["DENY", "CONTINUE"]),
  requiresComponents: z.boolean(),
  selectedOptions: z.array(z.object({ name: text, value: text })),
  image: image.nullable(),
  inventoryItem: z.object({
    requiresShipping: z.boolean(),
    tracked: z.boolean(),
    measurement: z.object({ weight: z.object({ value: z.number(), unit: text }).nullable() })
  })
})
const productSchema = z.object({
  id: text,
  handle: text,
  title: text,
  descriptionHtml: text,
  productType: text,
  vendor: text,
  tags: z.array(text),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED", "UNLISTED"]),
  isGiftCard: z.boolean(),
  requiresSellingPlan: z.boolean(),
  category: z.object({ id: text }).nullable(),
  seo: z.object({ title: nullableText, description: nullableText }),
  options: z.array(z.object({ name: text, position: z.number(), optionValues: z.array(z.object({ name: text })) })),
  variants: z.object({ nodes: z.array(variant), pageInfo: z.object({ hasNextPage: z.literal(false) }) }),
  media: z.object({
    nodes: z.array(z.object({ mediaContentType: z.literal("IMAGE"), alt: nullableText, image })),
    pageInfo: z.object({ hasNextPage: z.literal(false) })
  }),
  metafields: z.object({ nodes: z.array(metafield), pageInfo: z.object({ hasNextPage: z.literal(false) }) })
})
export const catalogImportSnapshotSchema = catalogSnapshotSchema.extend({ products: z.array(productSchema) })

export const catalogProductLookup = `query CatalogDestination($identifier: ProductIdentifierInput!) {
  product: productByIdentifier(identifier: $identifier) { id handle }
}`
export const catalogProductCreate = `mutation CreateCatalogProduct($input: ProductSetInput!) {
  result: productSet(input: $input, synchronous: true) {
    resource: product { id handle status variants(first: 100) { nodes { id sku selectedOptions { name value } } pageInfo { hasNextPage } }
      media(first: 100) { nodes { id status mediaContentType } pageInfo { hasNextPage } } }
    userErrors { field message }
  }
}`
const identityQuery = `query CatalogDestinationIdentity { shop { id myshopifyDomain currencyCode } }`
const identitySchema = z.object({ shop: z.object({ id: text, myshopifyDomain: text, currencyCode: text }) })
const lookupSchema = z.object({ product: z.object({ id: text, handle: text }).nullable() })
const createdSchema = z.object({
  result: z.object({
    resource: z
      .object({
        id: text,
        handle: text,
        status: z.literal("DRAFT"),
        variants: z.object({
          nodes: z.array(
            z.object({ id: text, sku: nullableText, selectedOptions: z.array(z.object({ name: text, value: text })) })
          ),
          pageInfo: z.object({ hasNextPage: z.literal(false) })
        }),
        media: z.object({
          nodes: z.array(z.object({ id: text, status: text, mediaContentType: text })),
          pageInfo: z.object({ hasNextPage: z.literal(false) })
        })
      })
      .nullable(),
    userErrors: z.array(z.object({ message: text }))
  })
})

export function brandCopy(value: string) {
  return value
    .replace(/\bmen(?:s)?['\u2019]s\b/gi, "Mens")
    .replace(/\bwomen(?:s)?['\u2019]s\b/gi, "Womens")
    .replace(/\bkids['\u2019](?=\s|$)/gi, "Kids")
}

export function catalogProductInput(input: unknown) {
  const product = productSchema.parse(input)
  if (product.isGiftCard || product.requiresSellingPlan) {
    throw new Error(`Unsupported gift card or subscription product: ${product.handle}.`)
  }
  const excluded: string[] = []
  const fields = product.metafields.nodes.filter((field) => {
    const allowed =
      ["custom", "structured_data", "reviews"].includes(field.namespace) &&
      !field.type.includes("reference") &&
      !field.value.includes("gid://shopify/") &&
      field.key !== "size_chart"
    if (!allowed) {
      excluded.push(`${field.namespace}.${field.key}`)
    }
    return allowed
  })
  const files = product.media.nodes.map((media) => ({
    originalSource: media.image.url,
    contentType: "IMAGE",
    alt: brandCopy(media.alt ?? "")
  }))
  const variants = product.variants.nodes.map((item) => {
    const file = files.find(
      (candidate) => new URL(candidate.originalSource).pathname === (item.image ? new URL(item.image.url).pathname : "")
    )
    if (item.image && !file) {
      throw new Error(`Variant image is missing from product media: ${product.handle}.`)
    }
    return {
      sku: item.sku ?? "",
      barcode: item.barcode ?? "",
      price: item.price,
      compareAtPrice: item.compareAtPrice,
      taxable: item.taxable,
      inventoryPolicy: item.inventoryPolicy,
      requiresComponents: item.requiresComponents,
      optionValues: item.selectedOptions.map((option) => ({
        optionName: brandCopy(option.name),
        name: brandCopy(option.value)
      })),
      inventoryItem: {
        requiresShipping: item.inventoryItem.requiresShipping,
        tracked: true,
        ...(item.inventoryItem.measurement.weight ? { measurement: item.inventoryItem.measurement } : {})
      },
      ...(file ? { file } : {})
    }
  })
  return {
    excluded,
    input: {
      handle: product.handle,
      title: brandCopy(product.title),
      descriptionHtml: brandCopy(product.descriptionHtml),
      productType: product.productType,
      vendor: product.vendor,
      tags: product.tags,
      status: "DRAFT",
      templateSuffix: "",
      ...(product.category ? { category: product.category.id } : {}),
      seo: {
        title: brandCopy(product.seo.title ?? product.title),
        description: brandCopy(product.seo.description ?? "")
      },
      productOptions: product.options.map((option) => ({
        name: brandCopy(option.name),
        position: option.position,
        values: option.optionValues.map((value) => ({ name: brandCopy(value.name) }))
      })),
      metafields: fields,
      files,
      variants
    }
  }
}

export async function importCatalog(
  snapshotInput: unknown,
  client: AdminClient,
  destination: string,
  apply: boolean,
  report?: (event: Record<string, unknown>) => void
) {
  if (destination !== "contosocamp.myshopify.com") {
    throw new Error("Catalog rehearsal writes are restricted to Contoso.")
  }
  const snapshot = catalogImportSnapshotSchema.parse(snapshotInput)
  if (
    snapshot.shop.myshopifyDomain !== "8f3f5f-3.myshopify.com" ||
    snapshot.shop.primaryDomain.host !== "fencing.club"
  ) {
    throw new Error("Expected the confirmed Fencing Club source snapshot.")
  }
  const destinationShop = identitySchema.parse(await client(identityQuery)).shop
  if (
    destinationShop.myshopifyDomain !== destination ||
    destinationShop.id === snapshot.shop.id ||
    destinationShop.currencyCode !== snapshot.shop.currencyCode
  ) {
    throw new Error("Destination identity or currency differs.")
  }
  const handles = new Set<string>()
  const plan = []
  for (const product of snapshot.products) {
    if (handles.has(product.handle)) {
      throw new Error(`Duplicate product handle: ${product.handle}.`)
    }
    handles.add(product.handle)
    const prepared = catalogProductInput(product)
    const existing = lookupSchema.parse(
      await client(catalogProductLookup, { identifier: { handle: product.handle } })
    ).product
    if (existing && existing.handle !== product.handle) {
      throw new Error("Destination returned a different handle.")
    }
    const item = { handle: product.handle, prepared, existing }
    plan.push(item)
    report?.({
      phase: "plan",
      handle: product.handle,
      action: existing ? "keep" : "create",
      excluded: prepared.excluded
    })
  }
  if (!apply) {
    return plan.map((item) => ({ handle: item.handle, action: item.existing ? "keep" : "create" }))
  }
  for (const item of plan) {
    const current = lookupSchema.parse(
      await client(catalogProductLookup, { identifier: { handle: item.handle } })
    ).product
    if (current?.id !== item.existing?.id) {
      throw new Error(`Destination changed: ${item.handle}. Plan again.`)
    }
    if (current) {
      continue
    }
    const result = createdSchema.parse(await client(catalogProductCreate, { input: item.prepared.input }, true)).result
    if (result.userErrors.length) {
      throw new Error(result.userErrors.map((error) => error.message).join("; "))
    }
    if (!result.resource || result.resource.handle !== item.handle) {
      throw new Error(`Unexpected creation result for ${item.handle}; inspect before retrying.`)
    }
    if (result.resource.variants.nodes.length !== item.prepared.input.variants.length) {
      throw new Error(`Variant count differs for ${item.handle}.`)
    }
    if (result.resource.media.nodes.some((media) => media.status === "FAILED")) {
      throw new Error(`Media processing failed for ${item.handle}.`)
    }
    report?.({ phase: "created", handle: item.handle, resource: result.resource })
  }
  return plan.map((item) => ({ handle: item.handle, action: item.existing ? "kept" : "created" }))
}
