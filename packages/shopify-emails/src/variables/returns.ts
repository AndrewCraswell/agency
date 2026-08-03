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

/** A restocking or return-shipping charge, which comes off what the customer gets back. */
export type ReturnFee = {
  readonly subtotal: Cents
  readonly title: string
}

/*
 * Read from the stock return templates rather than probed: the admin's preview renderer ignores a
 * supplied body for all four of them, so nothing here has been confirmed against live data.
 */
export type ReturnDrop = {
  readonly checkout_payment_collection_url: string | null
  /** A hash in Liquid, but `note` is the only key any template reads, so it is named here. */
  readonly decline: { readonly note: string } | null
  readonly deliveries: readonly ReturnDelivery[]
  readonly exchange_line_items: readonly LineItem[]
  readonly fees: readonly ReturnFee[]
  readonly line_items: readonly LineItem[]
  /** Negative where the return credits the customer, so do not print it beside a minus sign. */
  readonly line_items_subtotal_price: Cents
  readonly order_total_outstanding: Cents
  /** What the order still owed before the return was counted, so the two can be shown apart. */
  readonly pre_return_order_total_outstanding: Cents | null
  readonly total_tax_price: Cents | null
}

/** Also unprobeable, and read from `change_requested` and `requested_edit_declined`. */
export type RequestedEdit = {
  readonly affected_line_items: readonly LineItem[]
  readonly decline_note: string | null
  readonly line_items: readonly LineItem[]
}
