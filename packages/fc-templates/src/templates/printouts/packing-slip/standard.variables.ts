import type { TemplateVariables } from "../../../types.ts"
import { printoutShop } from "../../variables/printout.variables.ts"

/*
 * A six-item, ten-unit order. Quantities vary and half the items have no image, so the layout is
 * exercised against both. The packing slip carries no prices, so none are supplied.
 */

export const packingSlipLineItems = [
  {
    title:
      "Fencing Club Fencing Glove, 3-Weapon Washable, Pro-Grip Silicone Design, Foil Epee and Saber, Competition Approved",
    quantity: 1,
    image: "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/Fencing_Club-05.png",
    product: { has_only_default_variant: false },
    options_with_values: [
      { name: "Size", value: "8.5" },
      { name: "Hand", value: "Left" }
    ]
  },
  {
    title: "Novus Men's Fencing Jacket — 350N",
    quantity: 1,
    image: "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/Fencing_Club-05.png",
    product: { has_only_default_variant: false },
    options_with_values: [{ name: "Size", value: "52" }]
  },
  {
    title: "Novus Men's Fencing Pants — 350N",
    quantity: 2,
    image: null,
    product: { has_only_default_variant: false },
    options_with_values: [{ name: "Size", value: "52" }]
  },
  {
    title: "Novus Underarm Protector — 350N",
    quantity: 1,
    image: null,
    product: { has_only_default_variant: false },
    options_with_values: [{ name: "Size", value: "Medium" }]
  },
  {
    title: "Standard Epee Body Cord",
    quantity: 3,
    image: null,
    product: { has_only_default_variant: true },
    options_with_values: [{ name: "Title", value: "Default Title" }]
  },
  {
    title: "Standard Foil/Saber Mask Cord",
    quantity: 2,
    image: null,
    product: { has_only_default_variant: true },
    options_with_values: [{ name: "Title", value: "Default Title" }]
  }
]

export const packingSlipOrder = {
  name: "#8438",
  order_number: 8438,
  created_at: "2026-07-26T09:15:00-07:00",
  email: "steve@shipping.example",
  requires_shipping: true,
  note: "Please include a handwritten thank-you for my son Lucas — first tournament next week!",
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
  },
  shipping_methods: [{ title: "Amazon Expedited" }],
  line_items: packingSlipLineItems
}

export const variables: TemplateVariables = {
  shop: printoutShop,
  order: packingSlipOrder
}
