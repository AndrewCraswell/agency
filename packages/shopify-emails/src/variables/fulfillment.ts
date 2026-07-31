import type { LineItem } from "./order.ts"
import type { LiquidTime } from "./primitives.ts"

export type FulfillmentLineItem = {
  readonly line_item: LineItem
  readonly quantity: number
}

/*
 * `json` refuses the drop, so every property below was probed by name against the shipment
 * notifications. `tracking_url` is the first of `tracking_urls`, which the stock templates ignore.
 */
export type Fulfillment = {
  readonly created_at: LiquidTime | null
  readonly estimated_delivery_at: LiquidTime | null
  readonly fulfillment_line_items: readonly FulfillmentLineItem[]
  /** How many units this shipment covers, which a template compares against the order's total. */
  readonly item_count: number
  readonly name: string | null
  readonly requires_shipping: boolean
  readonly tracking_company: string | null
  readonly tracking_numbers: readonly string[]
  readonly tracking_url: string | null
  readonly tracking_urls: readonly string[]
}
