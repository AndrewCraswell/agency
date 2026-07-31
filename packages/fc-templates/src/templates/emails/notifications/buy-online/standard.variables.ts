import { orderVariables } from "../../../variables/order.variables.ts"

/**
 * POS "buy online" abandoned-cart sample. The shared order fixture supplies the shop, customer and
 * links; the cart the customer left behind at the counter is described here so the branded item
 * list and totals render the way the design shows them.
 */
const cartLineItems = [
  {
    title: "Novus Men's Competition Jacket",
    quantity: 1,
    image: null,
    variant: { title: "Size 46 · Right-handed" },
    original_line_price: 18_900,
    final_line_price: 17_010,
    discount_allocations: [{ amount: 1890, discount_application: { title: "CLUB10" } }]
  },
  {
    title: "Leon Paul Contour Fencing Mask",
    quantity: 1,
    image: null,
    variant: { title: "Medium · CE 350N" },
    original_line_price: 21_500,
    final_line_price: 21_500,
    discount_allocations: []
  },
  {
    title: "Standard Epee Body Cord",
    quantity: 1,
    image: null,
    variant: { title: "2-prong · 2m" },
    original_line_price: 2990,
    final_line_price: 2990,
    discount_allocations: []
  }
]

export const variables = {
  ...orderVariables,
  subtotal_line_items: cartLineItems,
  line_items: cartLineItems,
  subtotal_price: 43_390,
  total_discounts: 1890,
  shipping_price: 1200,
  total_price: 42_700,
  custom_message: ""
}
