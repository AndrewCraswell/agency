import type { TemplateVariables } from "../../types.ts"
import { baseVariables, customer, shop } from "./base.variables.ts"

/*
 * The sample order every customer notification renders against, plus the assorted drops Shopify
 * exposes to individual notifications (gift card, return, payment schedule, account URLs). Shopify
 * only populates the subset each template needs, but supplying all of them keeps one order fixture
 * serving all 46 templates.
 */

export const lineItem = {
  title: "Epee Body Screws - 10 Pack",
  variant_title: "Standard",
  presentment_title: "Epee Body Screws - 10 Pack",
  quantity: 1,
  sku: "JKT-FIE-800N-40R",
  original_price: 18_900,
  final_price: 17_010,
  original_line_price: 18_900,
  final_line_price: 17_010,
  line_price: 17_010,
  image:
    "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/EpeeScrews10-Photoroom_9fb7f4f1-6fb1-4c3d-8613-dcd94f0b52dd_compact_cropped.png?v=1709607194",
  groups: [],
  delivery_agreement: null,
  "nested_line_child?": false,
  "nested_line_parent?": false,
  "bundle_parent?": false,
  gift_card: false,
  variant: { title: "Standard" },
  product: {
    title: "Epee Body Screws - 10 Pack",
    featured_image:
      "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/EpeeScrews10-Photoroom_9fb7f4f1-6fb1-4c3d-8613-dcd94f0b52dd_compact_cropped.png?v=1709607194"
  },
  discount_allocations: [{ amount: 1890, discount_application: { title: "CLUB10" } }],
  properties: []
}

const returnLineItem = {
  title_without_variant: lineItem.title,
  quantity: 1,
  variant: { title: "Standard" },
  image: lineItem.image,
  original_line_price: lineItem.original_line_price,
  final_line_price: lineItem.final_line_price,
  discount_allocations: []
}

const transaction = {
  id: 1000,
  kind: "sale",
  status: "success",
  amount: 18_148,
  gateway: "shopify_payments",
  gateway_display_name: "Shopify Payments",
  payment_details: { credit_card_company: "Visa", credit_card_last_four_digits: "4242" }
}

/* The shipment Shopify would have created. Fulfillment notifications read it for tracking. */
const fulfillment = {
  fulfillment_line_items: [{ line_item: lineItem, quantity: lineItem.quantity }],
  tracking_company: "UPS",
  tracking_number: "1Z999AA10123456784",
  tracking_numbers: ["1Z999AA10123456784"],
  tracking_url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
  tracking_urls: ["https://www.ups.com/track?tracknum=1Z999AA10123456784"]
}

export const orderVariables: TemplateVariables = {
  ...baseVariables,

  name: "#FC-1042",
  order_name: "#FC-1042",
  order_number: 1042,
  confirmation_number: "FC1042TEST",
  created_at: "2026-07-25T14:30:00-04:00",
  order_status_url: "https://fencing.club/account/orders/FC1042TEST",

  requires_shipping: true,
  has_pending_payment: false,
  buyer_action_required: false,
  payment_charged_on_fulfillment: false,
  delivery_method: "shipping",
  split_cart_delivery_method: "shipping",
  delivery_agreements: [{ delivery_method_type: "shipping" }],
  source_name: "web",
  location_name: "Fencing Club — Boston",

  line_items: [lineItem],
  subtotal_line_items: [lineItem],
  subtotal_price: 17_010,
  total_discounts: 1890,
  shipping_price: 0,
  shipping_method: { title: "Free shipping", price: 0 },
  shipping_methods: [{ title: "Free shipping", price: 0, original_price: 0 }],
  tax_lines: [{ title: "MA Sales Tax", rate: 0.0625, price: 1138 }],
  tax_price: 1138,
  total_tax: 1138,
  total_price: 18_148,
  total_outstanding: 0,
  amount_due_now: 18_148,
  net_payment: 0,
  item_count: 1,
  financial_status: "paid",
  cancel_reason: "customer",

  transactions: [transaction],
  transaction_id: transaction.id,
  void_transactions: [],

  /* A few templates reach through `order.` rather than the top-level drops. */
  order: {
    name: "#FC-1042",
    order_status_url: "https://fencing.club/account/orders/FC1042TEST",
    total_outstanding: 0,
    transactions: [transaction]
  },
  address: baseVariables.billing_address,
  fulfillment,

  discount_applications: [],
  discounts: [],
  duties: [],
  tips: 0,
  total_tip: 0,
  attributes: [],
  note: "Please leave the package at the front desk.",
  po_number: "",
  company: null,
  company_location: null,
  location: null,
  b2b: false,
  gift_card_line_item: false,
  apc_wallet_name: null,

  custom_message: "",
  email_title: "",
  url: "https://fencing.club/cart/c/FC1042TEST",
  invoice_url: "https://fencing.club/invoices/FC1042TEST",
  checkout_payment_collection_url: "https://fencing.club/checkout/pay/FC1042TEST",
  account_link: "https://fencing.club/account",
  account_activation_url: customer.account_activation_url,
  email_confirmation_url: "https://fencing.club/account/payment/confirm/FC1042TEST",
  reserve_inventory_until: "2026-07-28T14:30:00-04:00",
  previous_email: "alex.old@example.com",
  new_email: customer.email,

  issued_store_credit: { amount: 2500 },

  payment_schedule: {
    amount_due: 18_148,
    due_at: "2026-08-08T14:30:00-04:00",
    "overdue?": false,
    "due_later?": true,
    due_in_days: 3,
    number_of_days_overdue: 0
  },

  gift_card: {
    code: "H7QP4M2KX9AB",
    initial_value: 5000,
    balance: 5000,
    currency: "USD",
    url: "https://fencing.club/gift_cards/FC1042TEST",
    pass_url: null,
    expires_on: null,
    send_on: null,
    message: "Congratulations on your first tournament — go get 'em!",
    customer: { name: "Jordan Lee", email: "jordan@example.com" },
    recipient: { name: customer.name, nickname: customer.first_name, email: customer.email }
  },

  return: { line_items: [returnLineItem] },
  requested_edit: { line_items: [returnLineItem] },

  shop_name: shop.name
}
