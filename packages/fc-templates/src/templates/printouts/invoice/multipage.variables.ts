import type { TemplateVariables } from "../../../types.ts"
import { lineItems, printoutShop, repeatLineItems } from "../../variables/printout.variables.ts"
import { paidOrder } from "./paid.variables.ts"

/* Enough line items to spill onto a second sheet, which is where the repeated footer earns itself. */
export const variables: TemplateVariables = {
  shop: printoutShop,
  order: { ...paidOrder, line_items: repeatLineItems(lineItems, 8) }
}
