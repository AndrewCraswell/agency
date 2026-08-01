import type { Cents, LiquidTime, OpaqueDrop } from "./primitives.ts"
import type { Product, ProductVariant } from "./product.ts"

export type DiscountApplication = {
  readonly target_selection: "all" | "entitled" | "explicit"
  readonly target_type: "line_item" | "shipping_line"
  readonly title: string
  readonly total_allocated_amount: Cents
  /** A decimal string, so `5.0` for both five dollars and five percent. */
  readonly value: string
  readonly value_type: "fixed_amount" | "percentage"
}

export type DiscountAllocation = {
  readonly amount: Cents
  readonly discount_application: DiscountApplication
}

export type TaxLine = {
  readonly price: Cents
  /** The fraction, where `rate_percentage` is the same number scaled for display. */
  readonly rate: number
  readonly rate_percentage: number
  readonly title: string
}

export type PaymentDetails = {
  readonly credit_card_company: string | null
  readonly credit_card_last_four_digits: string | null
  /** Already masked by Shopify, so it is safe to print. */
  readonly credit_card_number: string | null
  readonly gift_card_last_four_digits: string | null
  readonly "local_payment?": boolean
  readonly payment_method_name: string | null
  readonly type: string | null
}

export type Transaction = {
  readonly amount: Cents
  /** Non-null only where the gateway rounds cash payments, and it can be negative. */
  readonly amount_rounding: Cents | null
  readonly created_at: LiquidTime
  readonly gateway: string
  readonly gateway_display_name: string
  /** Computed rather than serialised, and what `transaction_id` is matched against. */
  readonly id: number
  readonly kind: "authorization" | "capture" | "change" | "refund" | "sale" | "void"
  readonly payment_details: PaymentDetails
  readonly receipt: Readonly<Record<string, unknown>>
  readonly status: "error" | "failure" | "pending" | "success"
}

export type ShippingMethod = {
  /** Shopify's own handle, which is a price string rather than anything readable. */
  readonly handle: string
  readonly price: Cents
  readonly title: string
}

export type PickupMethod = {
  readonly address: OpaqueDrop | null
  readonly instructions: string | null
}

/*
 * One parcel's worth of an order that arrives in several. `json` only reports the method type, but
 * Shopify's own `order-edited` template reads the name and the lines off the same drop, so both are
 * settled even though a dump of the order does not show them.
 */
export type DeliveryAgreement = {
  readonly delivery_method_type: string
  /** How the buyer would say it: `Shipping`, `Local delivery`, `Pickup in store`. */
  readonly delivery_method_name: string
  readonly line_items: readonly LineItem[]
}

export type LineItemGroup = {
  /** A group that ships on its own is labelled `For:`; one that is part of a bundle, `Part of:`. */
  readonly "deliverable?": boolean
  readonly display_title: string
  readonly title: string
}

/*
 * A customer-supplied line property, such as an engraving or a gift message. Liquid iterates a hash
 * as name/value pairs rather than as objects, so the name is `first` and the value is `last`.
 * Shopify's own machinery writes here too, and names those properties with a leading underscore.
 */
export type LineItemProperty = {
  readonly first: string
  readonly last: string
}

export type LineItem = {
  readonly aggregated_update: unknown | null
  readonly applied_discounts: readonly OpaqueDrop[]
  /** What is still owed on the line after an edit, so a cancelled order reports zero. */
  readonly current_quantity: number
  readonly discount_allocations: readonly DiscountAllocation[]
  /** After discounts, and computed rather than serialised, so a probe dump omits it. */
  readonly final_line_price: Cents
  readonly gift_card: boolean
  readonly grams: number
  readonly groups: readonly LineItemGroup[]
  readonly id: number
  /** Protocol-relative CDN URL, and computed rather than serialised. */
  readonly image: string
  readonly item_updates: readonly unknown[]
  readonly line_price: Cents
  readonly original_line_price: Cents
  readonly price: Cents
  /** The title as the buyer saw it at checkout, which a translated storefront makes differ. */
  readonly presentment_title: string | null
  readonly product: Product
  readonly properties: readonly LineItemProperty[]
  readonly quantity: number
  readonly requires_shipping: boolean
  readonly selling_plan_allocation: OpaqueDrop | null
  readonly sku: string
  readonly tax_lines: readonly TaxLine[]
  readonly taxable: boolean
  readonly title: string
  /** The product name on its own, so a variant can be printed on its own line. Computed. */
  readonly title_without_variant: string
  /** Set only where the shop prices by measure, and meaningless without the measurement beside it. */
  readonly unit_price: Cents | null
  readonly unit_price_measurement: OpaqueDrop | null
  readonly url: string
  readonly variant: ProductVariant
  readonly variant_id: number
  /** Null where the variant is the product's only one, which Shopify titles `Default Title`. */
  readonly variant_title: string | null
  readonly vendor: string | null
}

/*
 * The same order the surrounding variables already describe, re-exposed as a drop. `json` refuses it,
 * so only the properties the stock templates read are verified.
 */
export type OrderRef = {
  readonly name: string
  readonly order_status_url: string
  readonly transactions: readonly Transaction[]
}
