import type { LineItem } from "./order.ts"
import type { IssuedStoreCredit, PaymentSchedule, PaymentTerms } from "./payments.ts"
import type { Cents, LiquidTime } from "./primitives.ts"
import type { RefundLineItem, ReturnLabel } from "./returns.ts"
import type {
  AccountVariables,
  BuyerMessageVariables,
  CustomerVariables,
  EditRequestVariables,
  GiftCardVariables,
  OrderHistoryVariables,
  OrderSummaryVariables,
  OrderVariables,
  PlacedOrderVariables,
  ReturnVariables,
  ShipmentVariables
} from "./shared.ts"
import type { CompanyLocation, Customer, Routes } from "./store.ts"

/*
 * What each customer notification is rendered with, named after the template id Shopify itself uses
 * in the admin URL and in `gid://shopify/EmailTemplate/<id>`.
 *
 * Most are a bare alias of a set shared by several templates, because within such a set the probe
 * came back identical. Give one its own members the moment it diverges rather than widening what
 * the others share.
 */

export type BuyOnlineVariables = OrderVariables & {
  readonly invoice_url: string
}

export type ChangeRequestedVariables = EditRequestVariables

/** B2B, so the links point at the company's account rather than at an order. */
export type CompanyContactWelcomeEmailVariables = OrderVariables & {
  readonly account_link: string
  readonly shop_link: string
}

export type CompanyLocationUpdatePaymentMethodVariables = OrderVariables & {
  readonly email_confirmation_url: string
  readonly location_name: string | null
}
export type ContactBuyerVariables = BuyerMessageVariables

export type CustomerAccountActivateVariables = AccountVariables & {
  readonly custom_message: string | null
  readonly customer: Customer & { readonly account_activation_url: string }
}

export type CustomerAccountResetVariables = AccountVariables & {
  readonly customer: Customer & { readonly reset_password_url: string }
}

export type CustomerAccountWelcomeVariables = AccountVariables

/** The three payment-method notifications differ only in why they were sent. */
export type CustomerAddPaymentMethodVariables = OrderVariables & {
  readonly email_confirmation_url: string
}

export type CustomerEmailAddressChangedConfirmationVariables = AccountVariables & {
  readonly new_email: string
  readonly previous_email: string
}

export type CustomerMarketingConfirmationVariables = AccountVariables & {
  readonly customer: Customer & { readonly subscribe_url: string }
  readonly unsubscribe_link: string
}

export type CustomerRestorePaymentMethodVariables = CustomerAddPaymentMethodVariables
export type CustomerUpdatePaymentMethodVariables = CustomerAddPaymentMethodVariables

/** The only notification for an order that has not been placed yet. */
export type DraftOrderInvoiceVariables = OrderSummaryVariables & {
  readonly amount_due_now: Cents
  /** Whatever the merchant typed into the admin before sending. */
  readonly custom_message: string
  readonly invoice_url: string
  /** The draft's own sequence number, unrelated to any order number. */
  readonly number: number
  readonly payment_terms: PaymentTerms
  readonly reserve_inventory_until: LiquidTime
}

/** Inferred from stock Liquid, not probed. */
export type FailedPaymentProcessingVariables = PlacedOrderVariables & {
  /** Where the buyer goes to retry, and the only variable this notification adds. */
  readonly url: string
}

export type GiftCardConfirmationVariables = GiftCardVariables
export type GiftCardNotificationVariables = GiftCardVariables
export type LocalDeliveredVariables = ShipmentVariables
export type LocalMissedDeliveryVariables = ShipmentVariables
export type LocalOutForDeliveryVariables = ShipmentVariables
export type OrderCancelledVariables = OrderVariables
export type OrderConfirmationVariables = OrderVariables

export type OrderEditedVariables = OrderHistoryVariables & {
  readonly routes: Routes
}

export type OrderInvoiceVariables = OrderHistoryVariables
export type OrderLinkVariables = OrderVariables

export type OrderPaymentReceiptVariables = OrderVariables & {
  /** Names which of `transactions` this receipt is for, matched against `transaction.id`. */
  readonly transaction_id: number
}

export type PaymentReminderVariables = PlacedOrderVariables & {
  readonly custom_message: string | null
  readonly payment_schedule: PaymentSchedule
}

export type PendingPaymentFailureVariables = BuyerMessageVariables & {
  readonly po_number: string | null
}
export type PendingPaymentSuccessVariables = OrderVariables
export type PickupReceiptVariables = OrderVariables

/** Inferred from stock Liquid, not probed. */
export type PosExchangeV2ReceiptVariables = PlacedOrderVariables & {
  readonly added_line_items: readonly LineItem[]
  readonly added_total: Cents
  readonly exchange_total: Cents
  readonly return_line_items: readonly LineItem[]
  readonly return_total: Cents
}

export type PosSendCartVariables = OrderVariables & {
  readonly invoice_url: string
}

export type ReadyForPickupVariables = OrderVariables & {
  /** The pickup location, which is the only thing this notification adds to an order. */
  readonly location_name: string | null
}

export type RefundNotificationVariables = OrderHistoryVariables & {
  readonly amount: Cents
  readonly refund_line_items: readonly RefundLineItem[]
  readonly routes: Routes
}

export type RequestedEditDeclinedVariables = EditRequestVariables
export type ReturnApprovedVariables = ReturnVariables
export type ReturnCreatedVariables = ReturnVariables
export type ReturnDeclinedVariables = ReturnVariables

/** The label is the whole point of this one, and it arrives on its own rather than on a delivery. */
export type ReturnLabelNotificationVariables = OrderVariables & {
  readonly return_label: ReturnLabel
}
export type ReturnRequestedVariables = ReturnVariables
export type ShipmentDeliveredVariables = ShipmentVariables
export type ShipmentOutForDeliveryVariables = ShipmentVariables
export type ShippingConfirmationVariables = ShipmentVariables
export type ShippingUpdateVariables = ShipmentVariables

export type StoreCreditIssuedVariables = CustomerVariables & {
  /** Set when the credit belongs to a business account, which is named instead of the customer. */
  readonly company_location: CompanyLocation | null
  readonly issued_store_credit: IssuedStoreCredit
  readonly routes: Routes
}

export type StoreReceiptVariables = OrderVariables

/** Keyed by the template id, so a caller can look a notification up from a URL or a gid. */
export type NotificationVariables = {
  readonly buy_online: BuyOnlineVariables
  readonly change_requested: ChangeRequestedVariables
  readonly company_contact_welcome_email: CompanyContactWelcomeEmailVariables
  readonly company_location_update_payment_method: CompanyLocationUpdatePaymentMethodVariables
  readonly contact_buyer: ContactBuyerVariables
  readonly customer_account_activate: CustomerAccountActivateVariables
  readonly customer_account_reset: CustomerAccountResetVariables
  readonly customer_account_welcome: CustomerAccountWelcomeVariables
  readonly customer_add_payment_method: CustomerAddPaymentMethodVariables
  readonly customer_email_address_changed_confirmation: CustomerEmailAddressChangedConfirmationVariables
  readonly customer_marketing_confirmation: CustomerMarketingConfirmationVariables
  readonly customer_restore_payment_method: CustomerRestorePaymentMethodVariables
  readonly customer_update_payment_method: CustomerUpdatePaymentMethodVariables
  readonly draft_order_invoice: DraftOrderInvoiceVariables
  readonly failed_payment_processing: FailedPaymentProcessingVariables
  readonly gift_card_confirmation: GiftCardConfirmationVariables
  readonly gift_card_notification: GiftCardNotificationVariables
  readonly local_delivered: LocalDeliveredVariables
  readonly local_missed_delivery: LocalMissedDeliveryVariables
  readonly local_out_for_delivery: LocalOutForDeliveryVariables
  readonly order_cancelled: OrderCancelledVariables
  readonly order_confirmation: OrderConfirmationVariables
  readonly order_edited: OrderEditedVariables
  readonly order_invoice: OrderInvoiceVariables
  readonly order_link: OrderLinkVariables
  readonly order_payment_receipt: OrderPaymentReceiptVariables
  readonly payment_reminder: PaymentReminderVariables
  readonly pending_payment_failure: PendingPaymentFailureVariables
  readonly pending_payment_success: PendingPaymentSuccessVariables
  readonly pickup_receipt: PickupReceiptVariables
  readonly pos_exchange_v2_receipt: PosExchangeV2ReceiptVariables
  readonly pos_send_cart: PosSendCartVariables
  readonly ready_for_pickup: ReadyForPickupVariables
  readonly refund_notification: RefundNotificationVariables
  readonly requested_edit_declined: RequestedEditDeclinedVariables
  readonly return_approved: ReturnApprovedVariables
  readonly return_created: ReturnCreatedVariables
  readonly return_declined: ReturnDeclinedVariables
  readonly return_label_notification: ReturnLabelNotificationVariables
  readonly return_requested: ReturnRequestedVariables
  readonly shipment_delivered: ShipmentDeliveredVariables
  readonly shipment_out_for_delivery: ShipmentOutForDeliveryVariables
  readonly shipping_confirmation: ShippingConfirmationVariables
  readonly shipping_update: ShippingUpdateVariables
  readonly store_credit_issued: StoreCreditIssuedVariables
  readonly store_receipt: StoreReceiptVariables
}

export type NotificationTemplateId = keyof NotificationVariables

/*
 * The templates whose variables were read from Shopify's stock Liquid rather than probed: the
 * admin's preview renderer ignores a supplied body for these, so it never reports what they expose.
 */
export const inferredNotificationTemplateIds = [
  "change_requested",
  "company_location_update_payment_method",
  "failed_payment_processing",
  "pickup_receipt",
  "pos_exchange_v2_receipt",
  "pos_send_cart",
  "ready_for_pickup",
  "requested_edit_declined",
  "return_approved",
  "return_created",
  "return_declined",
  "return_requested"
] as const satisfies readonly NotificationTemplateId[]
