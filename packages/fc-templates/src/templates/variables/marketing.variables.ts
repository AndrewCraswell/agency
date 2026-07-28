import type { TemplateVariables } from "../../types.ts"
import { customer, shop } from "./base.variables.ts"

/*
 * Shopify Email supplies a different set of drops than the transactional notifications: an
 * unsubscribe link, a tracking pixel block, and the abandoned checkout the customer left behind.
 */

export const abandonedVisit = {
  url: "https://fencing.club/checkouts/c/abandoned-preview",
  remaining_cart_products_count: 2,
  products_added_to_cart: [
    {
      title: "Standard Epee Body Cord",
      variant_title: "Default Title",
      quantity: 1,
      image_url:
        "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/EpeeScrews10-Photoroom_9fb7f4f1-6fb1-4c3d-8613-dcd94f0b52dd_compact_cropped.png?v=1709607194"
    },
    {
      title: "Premium Leather Case",
      variant_title: "Black",
      quantity: 1,
      image_url:
        "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/EpeeScrews10-Photoroom_9fb7f4f1-6fb1-4c3d-8613-dcd94f0b52dd_compact_cropped.png?v=1709607194"
    }
  ]
}

export const marketingVariables: TemplateVariables = {
  shop,
  customer: { first_name: customer.first_name, last_name: customer.last_name, email: customer.email },
  unsubscribe_link: '<a href="https://fencing.club/unsubscribe">Unsubscribe</a>',
  open_tracking_block: "",
  abandoned_visit: abandonedVisit
}
