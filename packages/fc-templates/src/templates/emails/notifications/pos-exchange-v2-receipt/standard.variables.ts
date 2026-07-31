import { orderVariables } from "../../../variables/order.variables.ts"

/**
 * POS exchange receipt sample. Shopify hands exchange notifications a returned set and an added set
 * plus their totals; the shared order fixture does not, so the design's exchange is described here.
 */
const returnedLineItems = [
  {
    title: "Novus Men's Competition Jacket",
    title_without_variant: "Novus Men's Competition Jacket",
    quantity: 1,
    image: null,
    variant: { title: "Size 46 · Right-handed" },
    original_line_price: 18_900,
    final_line_price: 18_900,
    discount_allocations: []
  }
]

const addedLineItems = [
  {
    title: "Novus Men's Competition Jacket",
    title_without_variant: "Novus Men's Competition Jacket",
    quantity: 1,
    image: null,
    variant: { title: "Size 48 · Right-handed" },
    original_line_price: 21_500,
    final_line_price: 21_500,
    discount_allocations: []
  }
]

export const variables = {
  ...orderVariables,
  return_line_items: returnedLineItems,
  added_line_items: addedLineItems,
  return_total: 18_900,
  added_total: 21_500,
  exchange_total: 2600
}
