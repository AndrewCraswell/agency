import type { Fulfillment } from "../variables/fulfillment.ts"
import type {
  DeliveryAgreement,
  DiscountApplication,
  LineItem,
  ShippingMethod,
  TaxLine,
  Transaction
} from "../variables/order.ts"
import type { LiquidTime, OrderAddress } from "../variables/primitives.ts"
import type { Product, ProductVariant } from "../variables/product.ts"
import type { OrderSummaryVariables, PlacedOrderVariables } from "../variables/shared.ts"
import { customerSample, shopSample } from "./store.ts"

/*
 * One order, previewed by every template that describes a purchase. A single fixture rather than
 * one per template, because these messages describe the same purchase at different moments and a
 * divergent sample would hide a difference that matters.
 *
 * Two lines, one of them discounted and one of them bought twice, so a template that totals or
 * pluralises is exercised by the default preview rather than only in production.
 */

const orderedAt: LiquidTime = [0, 14, 10, 3, 3, 2026, 2, 62, false, "PST"]

const clubDiscount: DiscountApplication = {
  target_selection: "all",
  target_type: "line_item",
  title: "CLUB10",
  total_allocated_amount: 1890,
  value: "10.0",
  value_type: "percentage"
}

const backpackVariant: ProductVariant = {
  available: true,
  barcode: null,
  compare_at_price: null,
  featured_image: null,
  id: 44_101_223_119,
  inventory_management: "shopify",
  name: "Ridgeline Backpack - Slate / 28L",
  option1: "Slate",
  option2: "28L",
  option3: null,
  options: ["Slate", "28L"],
  price: 18_890,
  public_title: "Slate / 28L",
  requires_selling_plan: false,
  requires_shipping: true,
  sku: "RB-28-SLT",
  taxable: true,
  title: "Slate / 28L",
  weight: 1200
}

const backpack: Product = {
  available: true,
  compare_at_price: null,
  compare_at_price_max: 0,
  compare_at_price_min: 0,
  compare_at_price_varies: false,
  content: "<p>A 28 litre pack that carries a laptop, a change of clothes and a week of stubbornness.</p>",
  created_at: "2025-11-02T09:00:00-08:00",
  description: "A 28 litre pack that carries a laptop, a change of clothes and a week of stubbornness.",
  featured_image: "//example-store.com/cdn/shop/files/ridgeline-backpack.png?v=1",
  handle: "ridgeline-backpack",
  id: 8_412_334_991,
  images: ["//example-store.com/cdn/shop/files/ridgeline-backpack.png?v=1"],
  media: [],
  options: ["Colour", "Size"],
  price: 18_890,
  price_max: 18_890,
  price_min: 18_890,
  price_varies: false,
  published_at: "2025-11-04T09:00:00-08:00",
  requires_selling_plan: false,
  selling_plan_groups: [],
  tags: ["bags"],
  title: "Ridgeline Backpack",
  type: "Bags",
  variants: [backpackVariant],
  vendor: "Example Store"
}

const sockVariant: ProductVariant = {
  available: true,
  barcode: null,
  compare_at_price: null,
  featured_image: null,
  id: 44_101_224_887,
  inventory_management: "shopify",
  name: "Merino Crew Sock - Charcoal / Medium",
  option1: "Charcoal",
  option2: "Medium",
  option3: null,
  options: ["Charcoal", "Medium"],
  price: 2200,
  public_title: "Charcoal / Medium",
  requires_selling_plan: false,
  requires_shipping: true,
  sku: "MS-CH-M",
  taxable: true,
  title: "Charcoal / Medium",
  weight: 90
}

const sock: Product = {
  available: true,
  compare_at_price: null,
  compare_at_price_max: 0,
  compare_at_price_min: 0,
  compare_at_price_varies: false,
  content: "<p>Merino, reinforced where it wears through first.</p>",
  created_at: "2025-09-18T09:00:00-07:00",
  description: "Merino, reinforced where it wears through first.",
  featured_image: "//example-store.com/cdn/shop/files/merino-crew-sock.png?v=1",
  handle: "merino-crew-sock",
  id: 8_412_336_204,
  images: ["//example-store.com/cdn/shop/files/merino-crew-sock.png?v=1"],
  media: [],
  options: ["Colour", "Size"],
  price: 2200,
  price_max: 2200,
  price_min: 2200,
  price_varies: false,
  published_at: "2025-09-20T09:00:00-07:00",
  requires_selling_plan: false,
  selling_plan_groups: [],
  tags: ["socks"],
  title: "Merino Crew Sock",
  type: "Socks",
  variants: [sockVariant],
  vendor: "Example Store"
}

const backpackLine: LineItem = {
  aggregated_update: null,
  applied_discounts: [],
  current_quantity: 1,
  discount_allocations: [{ amount: 1890, discount_application: clubDiscount }],
  final_line_price: 17_000,
  gift_card: false,
  grams: 1200,
  groups: [],
  id: 15_923_884_113,
  image: "//example-store.com/cdn/shop/files/ridgeline-backpack.png?v=1",
  item_updates: [],
  line_price: 18_890,
  original_line_price: 18_890,
  presentment_title: "Ridgeline Backpack",
  price: 18_890,
  product: backpack,
  properties: [{ first: "Monogram", last: "A.R." }],
  quantity: 1,
  requires_shipping: true,
  selling_plan_allocation: null,
  sku: "RB-28-SLT",
  tax_lines: [{ price: 1496, rate: 0.088, rate_percentage: 8.8, title: "State Tax" }],
  taxable: true,
  title: "Ridgeline Backpack",
  title_without_variant: "Ridgeline Backpack",
  unit_price: null,
  unit_price_measurement: null,
  url: "/products/ridgeline-backpack?variant=44101223119",
  variant: backpackVariant,
  variant_id: 44_101_223_119,
  variant_title: "Slate / 28L",
  vendor: "Example Store"
}

const sockLine: LineItem = {
  aggregated_update: null,
  applied_discounts: [],
  current_quantity: 2,
  discount_allocations: [],
  final_line_price: 4400,
  gift_card: false,
  grams: 180,
  groups: [],
  id: 15_923_884_297,
  image: "//example-store.com/cdn/shop/files/merino-crew-sock.png?v=1",
  item_updates: [],
  line_price: 4400,
  original_line_price: 4400,
  presentment_title: "Merino Crew Sock",
  price: 2200,
  product: sock,
  properties: [],
  quantity: 2,
  requires_shipping: true,
  selling_plan_allocation: null,
  sku: "MS-CH-M",
  tax_lines: [{ price: 388, rate: 0.088, rate_percentage: 8.8, title: "State Tax" }],
  taxable: true,
  title: "Merino Crew Sock",
  title_without_variant: "Merino Crew Sock",
  unit_price: null,
  unit_price_measurement: null,
  url: "/products/merino-crew-sock?variant=44101224887",
  variant: sockVariant,
  variant_id: 44_101_224_887,
  variant_title: "Charcoal / Medium",
  vendor: "Example Store"
}

export const lineItemsSample: readonly LineItem[] = [backpackLine, sockLine]

const shippingAddress: OrderAddress = {
  address1: "17190 128th Place NE",
  address2: null,
  city: "Woodinville",
  company: null,
  country: "United States",
  country_code: "US",
  first_name: "Alex",
  last_name: "Rivera",
  latitude: 47.754_23,
  longitude: -122.163_11,
  name: "Alex Rivera",
  phone: null,
  province: "Washington",
  province_code: "WA",
  zip: "98072"
}

const shippingMethod: ShippingMethod = {
  handle: "shopify-standard-12.00",
  price: 1200,
  title: "Standard shipping"
}

const taxLines: readonly TaxLine[] = [{ price: 1884, rate: 0.088, rate_percentage: 8.8, title: "State Tax" }]

const transactions: readonly Transaction[] = [
  {
    amount: 24_484,
    amount_rounding: null,
    created_at: orderedAt,
    gateway: "visa",
    gateway_display_name: "Visa",
    id: 6_318_442_007_112,
    kind: "sale",
    payment_details: {
      credit_card_company: "Visa",
      credit_card_last_four_digits: "4242",
      credit_card_number: "•••• •••• •••• 4242",
      gift_card_last_four_digits: null,
      "local_payment?": false,
      payment_method_name: "visa",
      type: "card"
    },
    receipt: {},
    status: "success"
  }
]

const deliveryAgreements: readonly DeliveryAgreement[] = [
  { delivery_method_name: "Shipping", delivery_method_type: "shipping", line_items: lineItemsSample }
]

const orderStatusUrl = "https://example-store.com/84825276713/orders/9f1c0e4a7b2d/authenticate?key=8c2b1f"

/** Everything a draft order and a placed order agree on. */
export const orderSummarySample: OrderSummaryVariables = {
  "b2b?": false,
  billing_address: shippingAddress,
  created_at: orderedAt,
  customer: customerSample,
  discount_applications: [clubDiscount],
  discounts: [],
  discounts_amount: 1890,
  discounts_savings: -1890,
  email: "alex@example.com",
  id: 5_231_889_002_311,
  item_count: 3,
  line_items: lineItemsSample,
  metafields: {},
  name: "#1001",
  order: { name: "#1001", order_status_url: orderStatusUrl, transactions },
  payment_methods: [],
  requires_shipping: true,
  shipping_address: shippingAddress,
  shipping_method: shippingMethod,
  shipping_price: 1200,
  shop: shopSample,
  shop_name: "Example Store",
  subtotal_line_items: lineItemsSample,
  subtotal_price: 21_400,
  tags: [],
  tax_lines: taxLines,
  tax_price: 1884,
  total_discounts: 1890,
  total_duties: 0,
  total_outstanding: 0,
  total_price: 24_484
}

export const placedOrderSample: PlacedOrderVariables = {
  ...orderSummarySample,
  "apc_currency_converted?": false,
  attributes: {},
  cancel_reason: null,
  cancelled: false,
  cancelled_at: null,
  checkout_payment_collection_url: "https://example-store.com/84825276713/orders/9f1c0e4a7b2d/pay",
  confirmation_number: "4KPQZ1RTM",
  currency: "USD",
  customer_order_url: orderStatusUrl,
  delivery_agreements: deliveryAgreements,
  financial_status: "paid",
  fulfilled_line_items: [],
  fulfillment_status: "unfulfilled",
  "has_high_risks?": false,
  line_item_groups: [],
  order_name: "#1001",
  order_number: 1001,
  order_status_url: orderStatusUrl,
  pickup_methods: [],
  retail_delivery_only: false,
  shipping_methods: [shippingMethod],
  total_tip: 0,
  transactions,
  unfulfilled_line_items: lineItemsSample,
  unique_gateways: ["visa"],
  void_transactions: []
}

/** The shipment the fulfilment notifications describe, covering both lines in one parcel. */
export const fulfillmentSample: Fulfillment = {
  created_at: [0, 5, 16, 4, 3, 2026, 3, 63, false, "PST"],
  estimated_delivery_at: [0, 0, 12, 9, 3, 2026, 1, 68, false, "PDT"],
  fulfillment_line_items: [
    { line_item: backpackLine, quantity: 1 },
    { line_item: sockLine, quantity: 2 }
  ],
  item_count: 3,
  name: "#1001.1",
  requires_shipping: true,
  tracking_company: "UPS",
  tracking_numbers: ["1Z999AA10123456784"],
  tracking_url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
  tracking_urls: ["https://www.ups.com/track?tracknum=1Z999AA10123456784"]
}
