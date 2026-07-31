import type { LineItem } from "./order.ts"
import type { Cents } from "./primitives.ts"

/** Probed on `refund_notification`, where `json` dumps it as key/value pairs rather than a hash. */
export type RefundLineItem = {
  readonly line_item: LineItem
  readonly quantity: number
  readonly restock_type: string | null
  readonly subtotal: Cents | null
}

export type ReturnLabel = {
  readonly public_file_url: string
}

export type ReturnDelivery = {
  readonly carrier_name: string | null
  readonly return_label: ReturnLabel | null
  readonly tracking_number: string | null
  readonly tracking_url: string | null
  readonly type: "manual" | "shopify_label"
}

/*
 * Read from the stock return templates rather than probed: the admin's preview renderer ignores a
 * supplied body for all four of them, so nothing here has been confirmed against live data.
 */
export type ReturnDrop = {
  readonly checkout_payment_collection_url: string | null
  /** Keyed access in the stock templates (`return.decline["note"]`), so it is a plain hash. */
  readonly decline: Readonly<Record<string, string>> | null
  readonly deliveries: readonly ReturnDelivery[]
  readonly exchange_line_items: readonly LineItem[]
  readonly line_items: readonly LineItem[]
  /** Negative where the return credits the customer, so do not print it beside a minus sign. */
  readonly line_items_subtotal_price: Cents
  readonly order_total_outstanding: Cents
}

/** Also unprobeable, and read from `change_requested` and `requested_edit_declined`. */
export type RequestedEdit = {
  readonly affected_line_items: readonly LineItem[]
  readonly decline_note: string | null
  readonly line_items: readonly LineItem[]
}
