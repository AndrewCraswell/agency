import type { TemplateVariables } from "../../../types.ts"
import { printoutShop, repeatLineItems } from "../../variables/printout.variables.ts"
import { packingSlipLineItems, packingSlipOrder } from "./standard.variables.ts"

/* Six times the items, so the slip runs to a second sheet and repeats its footer. */
export const variables: TemplateVariables = {
  shop: printoutShop,
  order: { ...packingSlipOrder, line_items: repeatLineItems(packingSlipLineItems, 6) }
}
