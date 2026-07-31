import type { Cents } from "./primitives.ts"

export type ProductImage = {
  readonly alt: string | null
  readonly aspect_ratio: number
  readonly height: number
  readonly id: number
  readonly src: string
  readonly width: number
}

export type ProductMedia = ProductImage & {
  readonly media_type: string
  readonly position: number
  readonly preview_image: Omit<ProductImage, "alt" | "id">
}

export type ProductVariant = {
  readonly available: boolean
  readonly barcode: string | null
  readonly compare_at_price: Cents | null
  /** Present only where the variant has its own picture, so a caller has to test for it. */
  readonly featured_image?: ProductImage | null
  readonly id: number
  readonly inventory_management: string | null
  readonly name: string
  readonly option1: string | null
  readonly option2: string | null
  readonly option3: string | null
  readonly options: readonly string[]
  readonly price: Cents
  /** Null where the product has a single unnamed variant, which Shopify titles `Default Title`. */
  readonly public_title: string | null
  readonly requires_selling_plan: boolean
  readonly requires_shipping: boolean
  readonly sku: string
  readonly taxable: boolean
  readonly title: string
  readonly weight: number
}

export type Product = {
  readonly available: boolean
  readonly compare_at_price: Cents | null
  readonly compare_at_price_max: Cents
  readonly compare_at_price_min: Cents
  readonly compare_at_price_varies: boolean
  /** The description again, which is what a theme reads. Both are raw HTML. */
  readonly content: string
  readonly created_at: string
  readonly description: string
  readonly featured_image: string
  readonly handle: string
  readonly id: number
  /** Protocol-relative, unlike every other URL a notification receives. */
  readonly images: readonly string[]
  readonly media: readonly ProductMedia[]
  readonly options: readonly string[]
  readonly price: Cents
  readonly price_max: Cents
  readonly price_min: Cents
  readonly price_varies: boolean
  readonly published_at: string
  readonly requires_selling_plan: boolean
  readonly selling_plan_groups: readonly unknown[]
  readonly tags: readonly string[]
  readonly title: string
  readonly type: string
  readonly variants: readonly ProductVariant[]
  readonly vendor: string
}
