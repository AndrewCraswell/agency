import { shop } from "./base.variables.ts"

/*
 * The sample order behind the printouts. Billing and shipping deliberately name different people
 * so the templates are exercised against an order that ships somewhere other than it bills.
 */

export const billingAddress = {
  name: "Bob Biller",
  first_name: "Bob",
  last_name: "Biller",
  company: "My Company",
  address1: "123 Billing Street",
  city: "Billtown",
  province: "Kentucky",
  province_code: "KY",
  zip: "40004",
  country: "United States"
}

export const shippingAddress = {
  name: "Steve Shipper",
  first_name: "Steve",
  last_name: "Shipper",
  company: "Shipping Company",
  address1: "123 Shipping Street",
  city: "Shippington",
  province: "Kentucky",
  province_code: "KY",
  zip: "40003",
  country: "United States",
  phone: "555-555-7447"
}

/* A mix of variant and default-variant products, one of them discounted at the line level. */
export const lineItems = [
  {
    title: "Standard Epee Body Cord",
    quantity: 1,
    product: { has_only_default_variant: false },
    options_with_values: [
      { name: "Connector", value: "2-prong" },
      { name: "Length", value: "1.5 m" }
    ],
    original_price: 1495,
    final_price: 1495,
    original_line_price: 1495,
    final_line_price: 1495,
    line_level_total_discount: 0,
    line_level_discount_allocations: []
  },
  {
    title: "Lens Protection Plan (2 Year)",
    quantity: 1,
    product: { has_only_default_variant: true },
    options_with_values: [{ name: "Title", value: "Default Title" }],
    original_price: 1999,
    final_price: 1999,
    original_line_price: 1999,
    final_line_price: 1999,
    line_level_total_discount: 0,
    line_level_discount_allocations: []
  },
  {
    title: "Premium Leather Case",
    quantity: 1,
    product: { has_only_default_variant: false },
    options_with_values: [{ name: "Color", value: "Black" }],
    original_price: 2499,
    final_price: 2499,
    original_line_price: 2499,
    final_line_price: 2499,
    line_level_total_discount: 0,
    line_level_discount_allocations: []
  },
  {
    title: "Standard Foil/Saber Body Cord",
    quantity: 1,
    product: { has_only_default_variant: false },
    options_with_values: [
      { name: "Connector", value: "Bayonet" },
      { name: "Length", value: "2 m" },
      { name: "Jacket", value: "Braided" }
    ],
    original_price: 1495,
    final_price: 995,
    original_line_price: 1495,
    final_line_price: 995,
    line_level_total_discount: 500,
    line_level_discount_allocations: [
      {
        amount: 500,
        discount_application: {
          title: "PROD5",
          target_selection: "entitled",
          target_type: "line_item",
          value_type: "fixed_amount",
          value: 500
        }
      }
    ]
  },
  {
    title: "Standard Foil/Saber Mask Cord",
    quantity: 1,
    product: { has_only_default_variant: true },
    options_with_values: [{ name: "Title", value: "Default Title" }],
    original_price: 695,
    final_price: 695,
    original_line_price: 695,
    final_line_price: 695,
    line_level_total_discount: 0,
    line_level_discount_allocations: []
  }
]

export const taxLines = [
  { title: "WA State Tax", rate: 0.065, rate_percentage: 6.5, price: 467 },
  { title: "King County Tax", rate: 0.036, rate_percentage: 3.6, price: 259 }
]

/*
 * An authorization is not a payment: the card has been held but nothing has settled. The invoice
 * counts only sale, capture, and refund transactions, so this alone leaves an order unpaid.
 */
export const authorization = {
  kind: "authorization",
  status: "success",
  status_label: "Success",
  amount: 7909,
  gateway: "shopify_payments",
  gateway_display_name: "Shopify Payments",
  created_at: "2026-07-25T14:30:00-07:00",
  payment_details: { credit_card_company: "Visa", credit_card_last_four: "4242" }
}

export const capture = {
  ...authorization,
  kind: "capture",
  created_at: "2026-07-25T14:32:11-07:00"
}

/** Everything the two invoice states share. Money is in cents, as Shopify supplies it. */
export const invoiceOrder = {
  name: "#FC-1042",
  order_number: 1042,
  created_at: "2026-07-25T14:30:00-07:00",
  po_number: "PO-88213",
  email: "bob@mycompany.example",
  requires_shipping: true,
  note: null,
  line_items_subtotal_price: 7683,
  subtotal_price: 7183,
  total_discounts: 1000,
  tax_price: 726,
  total_duties: 0,
  shipping_price: 0,
  total_price: 7909,
  fees: [],
  billing_address: billingAddress,
  shipping_address: shippingAddress,
  shipping_methods: [{ title: "Standard ground", original_price: 0, price_with_discounts: 0 }],
  line_items: lineItems,
  cart_level_discount_applications: [
    {
      title: "ORDER5",
      target_selection: "all",
      target_type: "line_item",
      value_type: "fixed_amount",
      value: 500,
      total_allocated_amount: 500
    }
  ],
  tax_lines: taxLines
}

export const printoutShop = shop

/** Repeat the line items to push a printout past one page, so the repeated footer is exercised. */
export function repeatLineItems<T>(items: readonly T[], times: number): T[] {
  return Array.from({ length: times }, () => items).flat()
}
