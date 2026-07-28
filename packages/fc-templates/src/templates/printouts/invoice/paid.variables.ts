import type { TemplateVariables } from "../../../types.ts"
import { authorization, capture, invoiceOrder, printoutShop } from "../../variables/printout.variables.ts"

/* The same order once the authorization has been captured: paid in full, one payment listed. */
export const paidOrder = {
  ...invoiceOrder,
  financial_status: "paid",
  financial_status_label: "Paid",
  net_payment: 7909,
  total_outstanding: 0,
  transactions: [authorization, capture]
}

export const variables: TemplateVariables = {
  shop: printoutShop,
  order: paidOrder
}
