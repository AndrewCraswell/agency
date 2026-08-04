import type { CampaignVariables } from "../variables/campaign.ts"
import type { GiftCard, IssuedStoreCredit, PaymentSchedule, PaymentTerms } from "../variables/payments.ts"
import type { RefundLineItem, RequestedEdit, RequestedEditLine, ReturnDrop } from "../variables/returns.ts"
import type {
  AccountVariables,
  BuyerMessageVariables,
  EditRequestVariables,
  GiftCardVariables,
  OrderHistoryVariables,
  OrderVariables,
  ReturnVariables,
  ShipmentVariables
} from "../variables/shared.ts"
import type { TemplateType, TemplateVariables, VariablesFor } from "../variables/templates.ts"
import { fulfillmentSample, lineItemsSample, orderSummarySample, placedOrderSample } from "./order.ts"
import { customerSample, routesSample, shopSample } from "./store.ts"

/*
 * What a template is previewed against when nothing else is supplied. One sample per set of
 * variables rather than one per template, so the twelve notifications that share a shape also
 * share a fixture and cannot drift apart in preview while staying identical in production.
 *
 * Every sample is complete: the value render treats a name it was not given as an error,
 * because Liquid would print it as nothing on Shopify and say so nowhere.
 */

const accountSample: AccountVariables = {
  customer: customerSample,
  shop: shopSample
}

const orderSample: OrderVariables = {
  ...placedOrderSample,
  custom_message: "",
  delivery_method_for_subtotal: "shipping"
}

const buyerMessageSample: BuyerMessageVariables = {
  ...orderSample,
  custom_message: "Thanks for the order. Anything you need, just reply to this message and it reaches us.",
  has_multiple_delivery_methods: false
}

const shipmentSample: ShipmentVariables = {
  ...placedOrderSample,
  fulfilled_line_items: lineItemsSample,
  fulfillment: fulfillmentSample,
  fulfillment_status: "fulfilled",
  items_to_fulfill: [],
  items_to_fulfill_count: 0,
  service_name: "UPS",
  unfulfilled_line_items: []
}

const orderHistorySample: OrderHistoryVariables = {
  ...placedOrderSample,
  line_items_including_zero_quantity: lineItemsSample
}

const giftCard: GiftCard = {
  balance: 10_000,
  code: "A1B23C4D5E6F7G8H",
  currency: "USD",
  customer: null,
  expires_on: null,
  initial_value: 10_000,
  last_four_characters: "7g8h",
  masked_code: null,
  message: null,
  pass_url: null,
  product_title: null,
  qr_identifier: "0f9c1a4e8b7d",
  recipient: null,
  send_on: null,
  url: "https://example-store.com/gift_cards/84825276713/a1b23c4d5e6f7g8h"
}

const giftCardSample: GiftCardVariables = {
  gift_card: giftCard,
  shop: shopSample
}

const issuedStoreCredit: IssuedStoreCredit = {
  amount: 1000,
  balance_after_transaction: 11_000,
  expires_at: null
}

const paymentSchedule: PaymentSchedule = {
  amount_due: 24_484,
  completed_at: null,
  due_at: [0, 0, 0, 10, 3, 2026, 2, 69, false, "PDT"],
  "due_later?": false,
  issued_at: [0, 14, 10, 3, 3, 2026, 2, 62, false, "PST"],
  number_of_days_overdue: 3,
  "overdue?": true
}

const paymentTerms: PaymentTerms = {
  automatic_capture_at_fulfillment: false,
  due_in_days: 7,
  next_payment: null,
  payment_terms_name: null,
  translated_name: "Net 7",
  type: "net"
}

const refundLineItems: readonly RefundLineItem[] = [
  { line_item: lineItemsSample[0]!, quantity: 1, restock_type: "return", subtotal: 17_000 }
]

/* Inferred rather than probed, like the types themselves: no live render has ever returned one. */
const returnDrop: ReturnDrop = {
  checkout_payment_collection_url: null,
  decline: null,
  deliveries: [
    {
      carrier_name: "UPS",
      return_label: { public_file_url: "https://example-store.com/returns/labels/9f1c0e4a7b2d.pdf" },
      tracking_number: "1Z999AA10123456791",
      tracking_url: "https://www.ups.com/track?tracknum=1Z999AA10123456791",
      type: "shopify_label"
    }
  ],
  exchange_line_items: [],
  fees: [{ subtotal: 750, title: "Restocking fee" }],
  line_items: [lineItemsSample[0]!],
  line_items_subtotal_price: -17_000,
  order_total_outstanding: 0,
  pre_return_order_total_outstanding: 0,
  total_tax_price: -1105
}

const returnSample: ReturnVariables = {
  ...placedOrderSample,
  po_number: null,
  return: returnDrop
}

const editedLine: RequestedEditLine = {
  ...lineItemsSample[1]!,
  variant: { ...lineItemsSample[1]!.variant, product: lineItemsSample[1]!.product }
}

const requestedEdit: RequestedEdit = {
  affected_line_items: [editedLine],
  decline_note: null,
  line_items: [editedLine]
}

const editRequestSample: EditRequestVariables = {
  ...placedOrderSample,
  po_number: null,
  requested_edit: requestedEdit,
  return: null
}

const draftOrderInvoiceSample: VariablesFor<"draft_order_invoice"> = {
  ...orderSummarySample,
  amount_due_now: 24_484,
  custom_message: "",
  invoice_url: "https://example-store.com/84825276713/invoices/9f1c0e4a7b2d",
  number: 24,
  payment_terms: paymentTerms,
  reserve_inventory_until: [0, 0, 0, 17, 3, 2026, 2, 76, false, "PDT"]
}

const campaignSample: CampaignVariables = {
  customer: customerSample,
  shop: shopSample,
  unsubscribe_url: "https://example-store.com/unsubscribe?id=9f1c0e4a7b2d"
}

const confirmationUrl = "https://example-store.com/account/payment_methods/9f1c0e4a7b2d/confirm"

const paymentMethodSample: VariablesFor<"customer_add_payment_method"> = {
  ...orderSample,
  email_confirmation_url: confirmationUrl
}

/** Keyed by the same name a template declares as its `type`. */
export const templateSamples: TemplateVariables = {
  abandonment: {
    ...campaignSample,
    abandoned_visit: {
      products_added_to_cart: [
        {
          image_url: "https://example-store.com/cdn/shop/products/ridgeline-backpack.jpg?width=96",
          quantity: 1,
          title: "Ridgeline Backpack",
          variant_title: "Slate / 28L"
        },
        {
          image_url: "https://example-store.com/cdn/shop/products/merino-crew-sock.jpg?width=96",
          quantity: 2,
          title: "Merino Crew Sock",
          variant_title: "Charcoal / Medium"
        }
      ],
      remaining_cart_products_count: 1,
      url: "https://example-store.com/checkouts/cn/9f1c0e4a7b2d/recover"
    }
  },
  buy_online: { ...orderSample, invoice_url: "https://example-store.com/84825276713/invoices/9f1c0e4a7b2d" },
  campaign: campaignSample,
  change_requested: editRequestSample,
  company_contact_welcome_email: {
    ...orderSample,
    account_link: "https://example-store.com/account",
    shop_link: "https://example-store.com"
  },
  company_location_update_payment_method: {
    ...orderSample,
    email_confirmation_url: confirmationUrl,
    location_name: "Example Store Downtown"
  },
  contact_buyer: buyerMessageSample,
  customer_account_activate: {
    ...accountSample,
    custom_message: "",
    customer: { ...customerSample, account_activation_url: "https://example-store.com/account/activate/9f1c0e4a7b2d" }
  },
  customer_account_reset: {
    ...accountSample,
    customer: { ...customerSample, reset_password_url: "https://example-store.com/account/reset/9f1c0e4a7b2d" }
  },
  customer_account_welcome: accountSample,
  customer_add_payment_method: paymentMethodSample,
  customer_email_address_changed_confirmation: {
    ...accountSample,
    new_email: "alex@example.com",
    previous_email: "alex.rivera@example.com"
  },
  customer_marketing_confirmation: {
    ...accountSample,
    customer: { ...customerSample, subscribe_url: "https://example-store.com/account/subscribe/9f1c0e4a7b2d" },
    unsubscribe_link: "https://example-store.com/unsubscribe?id=9f1c0e4a7b2d"
  },
  customer_restore_payment_method: paymentMethodSample,
  customer_update_payment_method: paymentMethodSample,
  draft_order_invoice: draftOrderInvoiceSample,
  failed_payment_processing: {
    ...placedOrderSample,
    financial_status: "pending",
    url: "https://example-store.com/84825276713/orders/9f1c0e4a7b2d/pay"
  },
  gift_card_confirmation: giftCardSample,
  gift_card_notification: giftCardSample,
  local_delivered: shipmentSample,
  local_missed_delivery: shipmentSample,
  local_out_for_delivery: shipmentSample,
  order_cancelled: {
    ...orderSample,
    cancel_reason: "customer",
    cancelled: true,
    cancelled_at: [0, 21, 11, 5, 3, 2026, 4, 64, false, "PST"],
    financial_status: "refunded"
  },
  order_confirmation: orderSample,
  order_edited: { ...orderHistorySample, routes: routesSample },
  order_invoice: orderHistorySample,
  order_link: orderSample,
  order_payment_receipt: { ...orderSample, transaction_id: 6_318_442_007_112 },
  payment_reminder: { ...placedOrderSample, custom_message: "", payment_schedule: paymentSchedule },
  pending_payment_failure: { ...buyerMessageSample, financial_status: "pending", po_number: null },
  pending_payment_success: orderSample,
  pickup_receipt: orderSample,
  pos_exchange_v2_receipt: {
    ...placedOrderSample,
    added_line_items: [lineItemsSample[1]!],
    added_total: 4400,
    exchange_total: -12_600,
    return_line_items: [lineItemsSample[0]!],
    return_total: -17_000
  },
  pos_send_cart: { ...orderSample, invoice_url: "https://example-store.com/84825276713/invoices/9f1c0e4a7b2d" },
  ready_for_pickup: { ...orderSample, location_name: "Example Store Downtown" },
  refund_notification: {
    ...orderHistorySample,
    amount: 17_000,
    financial_status: "partially_refunded",
    refund_line_items: refundLineItems,
    routes: routesSample
  },
  requested_edit_declined: {
    ...editRequestSample,
    requested_edit: {
      ...requestedEdit,
      decline_note: "This order had already been packed when your cancellation request reached us."
    }
  },
  return_approved: returnSample,
  return_created: returnSample,
  return_declined: {
    ...returnSample,
    return: { ...returnDrop, decline: { note: "The window for this return closed on 20 March." }, deliveries: [] }
  },
  return_label_notification: {
    ...orderSample,
    return_label: { public_file_url: "https://example-store.com/returns/labels/9f1c0e4a7b2d.pdf" }
  },
  return_requested: returnSample,
  shipment_delivered: shipmentSample,
  shipment_out_for_delivery: shipmentSample,
  shipping_confirmation: shipmentSample,
  shipping_update: shipmentSample,
  store_credit_issued: {
    company_location: { company: { name: "Piste Academy" }, name: "Boston" },
    customer: customerSample,
    issued_store_credit: issuedStoreCredit,
    routes: routesSample,
    shop: shopSample
  },
  store_receipt: orderSample
}

export const sampleFor = <TType extends TemplateType>(type: TType): VariablesFor<TType> => templateSamples[type]
