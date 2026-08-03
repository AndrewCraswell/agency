import type { Fulfillment } from "./fulfillment.ts"
import type {
  DeliveryAgreement,
  DiscountApplication,
  LineItem,
  LineItemGroup,
  OrderRef,
  PickupMethod,
  ShippingMethod,
  TaxLine,
  Transaction
} from "./order.ts"
import type { GiftCard } from "./payments.ts"
import type { Cents, LiquidTime, Metafields, OpaqueDrop, OrderAddress } from "./primitives.ts"
import type { RequestedEdit, ReturnDrop } from "./returns.ts"
import type { Customer, Shop } from "./store.ts"

/*
 * The variables Shopify supplies when it renders a customer notification, grouped by the sets
 * that more than one template shares. What a single notification gets is in `notifications.ts`.
 *
 * Every name below was read back from the admin's preview renderer, which evaluates a supplied body
 * against synthetic sample data without saving it. Thirty-four of the forty-six templates answered;
 * the rest ignore a supplied body, so the groups marked as inferred were read from Shopify's stock
 * Liquid instead.
 *
 * A variable absent from a type came back `null` against the sample data, which means either that
 * the notification does not expose it or that the sample simply had none. Treat a present name as
 * settled and an absent one as unproven.
 */

/** The only thing every notification agrees on. */
export type ShopVariables = {
  readonly shop: Shop
}

export type CustomerVariables = ShopVariables & {
  readonly customer: Customer
}

/** What an order-shaped notification carries before its own status variables are layered on. */
export type OrderSummaryVariables = CustomerVariables & {
  readonly "b2b?": boolean
  readonly billing_address: OrderAddress
  readonly created_at: LiquidTime
  readonly discount_applications: readonly DiscountApplication[]
  readonly discounts: readonly OpaqueDrop[]
  readonly discounts_amount: Cents
  /** The negative of `discounts_amount`, so a template must not print it beside a minus sign. */
  readonly discounts_savings: Cents
  readonly email: string
  readonly id: number
  readonly item_count: number
  readonly line_items: readonly LineItem[]
  readonly metafields: Metafields
  /** The order's display name, `#9999`, which `order_name` repeats. */
  readonly name: string
  readonly order: OrderRef
  readonly payment_methods: readonly OpaqueDrop[]
  readonly requires_shipping: boolean
  readonly shipping_address: OrderAddress
  readonly shipping_method: ShippingMethod
  readonly shipping_price: Cents
  readonly shop_name: string
  readonly subtotal_line_items: readonly LineItem[]
  readonly subtotal_price: Cents
  readonly tags: readonly string[]
  readonly tax_lines: readonly TaxLine[]
  readonly tax_price: Cents
  readonly total_discounts: Cents
  readonly total_duties: Cents
  /** Negative where the order is owed money back, so it is not a balance to collect. */
  readonly total_outstanding: Cents
  readonly total_price: Cents
}

/** A placed order, with the payment and fulfilment state a draft does not have yet. */
export type PlacedOrderVariables = OrderSummaryVariables & {
  readonly "apc_currency_converted?": boolean
  readonly attributes: Readonly<Record<string, string>>
  readonly cancel_reason: string | null
  readonly cancelled: boolean
  readonly cancelled_at: LiquidTime | null
  readonly checkout_payment_collection_url: string
  readonly confirmation_number: string
  readonly currency: string
  readonly customer_order_url: string
  readonly delivery_agreements: readonly DeliveryAgreement[]
  readonly financial_status: string
  readonly fulfilled_line_items: readonly LineItem[]
  readonly fulfillment_status: string
  readonly "has_high_risks?": boolean
  readonly line_item_groups: readonly LineItemGroup[]
  readonly order_name: string
  /** The sequence number without the prefix, which is not what `name` shows. */
  readonly order_number: number
  readonly order_status_url: string
  readonly pickup_methods: readonly PickupMethod[]
  readonly retail_delivery_only: boolean
  readonly shipping_methods: readonly ShippingMethod[]
  /** Which of the two Shop labels to show, and the only thing that tells them apart. */
  readonly shop_app_tracking_button_variant_key: string | null
  readonly shop_app_tracking_url: string | null
  readonly total_tip: Cents
  readonly transactions: readonly Transaction[]
  readonly unfulfilled_line_items: readonly LineItem[]
  readonly unique_gateways: readonly string[]
  readonly void_transactions: readonly OpaqueDrop[]
}

/** The notifications that report a change, which need the lines an edit reduced to nothing. */
export type OrderHistoryVariables = PlacedOrderVariables & {
  readonly line_items_including_zero_quantity: readonly LineItem[]
}

/** Twelve templates share this exactly, which makes it the one worth building a layout around. */
export type OrderVariables = PlacedOrderVariables & {
  /** Whatever the merchant typed into the admin before sending. */
  readonly custom_message: string
  readonly delivery_method_for_subtotal: string
}

/** `contact_buyer` and `pending_payment_failure`, which also let the merchant write a message. */
export type BuyerMessageVariables = OrderVariables & {
  readonly has_multiple_delivery_methods: boolean
}

/** The seven shipment notifications, which describe one fulfilment rather than the whole order. */
export type ShipmentVariables = PlacedOrderVariables & {
  readonly fulfillment: Fulfillment
  readonly items_to_fulfill: readonly LineItem[]
  readonly items_to_fulfill_count: number
  readonly service_name: string
}

/** Five account notifications, which carry no order at all. */
export type AccountVariables = CustomerVariables

/** Both gift card notifications, which carry neither a customer nor an order. */
export type GiftCardVariables = ShopVariables & {
  readonly gift_card: GiftCard
}

/*
 * Inferred from Shopify's stock Liquid, not probed: the preview renderer ignores a supplied body
 * for the templates below, so none of these variables has been seen live.
 */

/** The four return notifications. */
export type ReturnVariables = PlacedOrderVariables & {
  readonly po_number: string | null
  readonly return: ReturnDrop
}

/** `change_requested` and `requested_edit_declined`, where a return may accompany the edit. */
export type EditRequestVariables = PlacedOrderVariables & {
  readonly po_number: string | null
  readonly requested_edit: RequestedEdit
  readonly return: ReturnDrop | null
}
