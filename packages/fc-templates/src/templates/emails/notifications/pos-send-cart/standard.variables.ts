import { orderVariables } from "../../../variables/order.variables.ts"

/**
 * POS "send cart" sample. A staffer built this cart for the customer at the shop; the branded item
 * list and totals below mirror the design so the preview matches what ships to the customer.
 */
const cartLineItems = [
  {
    title: "Uhlmann Foil Blade",
    quantity: 1,
    image: null,
    variant: { title: "Maraging · FIE" },
    original_line_price: 9200,
    final_line_price: 9200,
    discount_allocations: []
  },
  {
    title: "Allstar Fencing Glove",
    quantity: 1,
    image: null,
    variant: { title: "Size 9 · Right" },
    original_line_price: 6800,
    final_line_price: 6120,
    discount_allocations: [{ amount: 680, discount_application: { title: "CLUB10" } }]
  }
]

export const variables = {
  ...orderVariables,
  subtotal_line_items: cartLineItems,
  line_items: cartLineItems,
  subtotal_price: 16_000,
  total_discounts: 680,
  shipping_price: 1200,
  total_price: 16_520,
  checkout_url: "https://fencing.club/cart/c/FC1042TEST",
  custom_message: ""
}
