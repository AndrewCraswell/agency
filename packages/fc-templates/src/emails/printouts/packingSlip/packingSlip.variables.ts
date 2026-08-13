import type { TemplateVariables } from "../../../types.ts"
import { printoutShop, repeatLineItems } from "../variables.ts"

/*
 * A six-item, ten-unit shipment. Quantities vary and half the items have no image, so the layout is
 * exercised against both. The packing slip carries no prices, so none are supplied.
 *
 * The packing slip editor hands the template one shipment at a time, so the fixtures mirror that:
 * `line_items_in_shipment` rather than the order's lines, and a `shipping_quantity` per line.
 */

export const packingSlipLineItems = [
  {
    title:
      "Fencing Club Fencing Glove, 3-Weapon Washable, Pro-Grip Silicone Design, Foil Epee and Saber, Competition Approved",
    variant_title: "8.5 / Left",
    quantity: 1,
    shipping_quantity: 1,
    image: "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/Fencing_Club-05.png"
  },
  {
    title: "Novus Men's Fencing Jacket — 350N",
    variant_title: "52",
    quantity: 1,
    shipping_quantity: 1,
    image: "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/Fencing_Club-05.png"
  },
  {
    title: "Novus Men's Fencing Pants — 350N",
    variant_title: "52",
    quantity: 2,
    shipping_quantity: 2,
    image: null
  },
  {
    title: "Novus Underarm Protector — 350N",
    variant_title: "Medium",
    quantity: 1,
    shipping_quantity: 1,
    image: null
  },
  {
    title: "Standard Epee Body Cord",
    variant_title: null,
    quantity: 3,
    shipping_quantity: 3,
    image: null
  },
  {
    title: "Standard Foil/Saber Mask Cord",
    variant_title: null,
    quantity: 2,
    shipping_quantity: 2,
    image: null
  }
]

export const packingSlipOrder = {
  name: "#8438",
  order_number: 8438,
  created_at: "2026-07-26T09:15:00-07:00",
  note: "Please include a handwritten thank-you for my son Lucas — first tournament next week!"
}

const shipmentContext = {
  shop: printoutShop,
  order: packingSlipOrder,
  customer: {
    first_name: "Steve",
    last_name: "Shipper",
    name: "Steve Shipper",
    email: "steve@shipping.example"
  },
  billing_address: {
    name: "Bob Biller",
    first_name: "Bob",
    last_name: "Biller",
    company: "My Company",
    address1: "123 Billing Street",
    address2: "Apt 4B",
    city: "Billtown",
    province: "Kentucky",
    province_code: "KY",
    zip: "40004",
    country: "United States",
    phone: "555-555-2455"
  },
  shipping_address: {
    name: "Steve Shipper",
    first_name: "Steve",
    last_name: "Shipper",
    company: "Shipping Company",
    address1: "123 Shipping Street",
    address2: "Apt 12A",
    city: "Shippington",
    province: "Kentucky",
    province_code: "KY",
    zip: "40003",
    country: "United States",
    phone: "555-555-7447"
  }
}

export const standardVariables: TemplateVariables = {
  ...shipmentContext,
  line_items_in_shipment: packingSlipLineItems,
  includes_all_line_items_in_order: true
}

/* Six times the items, so the slip runs to a second sheet and repeats its footer. */
export const multipageVariables: TemplateVariables = {
  ...shipmentContext,
  line_items_in_shipment: repeatLineItems(packingSlipLineItems, 6),
  includes_all_line_items_in_order: true
}

/* One box of two: three of the six lines, one of them split down the middle. */
export const partialVariables: TemplateVariables = {
  ...shipmentContext,
  line_items_in_shipment: [
    packingSlipLineItems[0],
    packingSlipLineItems[1],
    { ...packingSlipLineItems[2], shipping_quantity: 1 }
  ],
  includes_all_line_items_in_order: false
}
