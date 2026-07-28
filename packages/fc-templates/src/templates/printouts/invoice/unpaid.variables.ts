import type { TemplateVariables } from "../../../types.ts"
import { authorization, invoiceOrder, printoutShop } from "../../variables/printout.variables.ts"

/* Card authorized but never captured, so the invoice shows a balance due and no payments section. */
export const variables: TemplateVariables = {
  shop: printoutShop,
  order: {
    ...invoiceOrder,
    financial_status: "pending",
    financial_status_label: "Pending",
    net_payment: 0,
    total_outstanding: 7909,
    transactions: [authorization]
  }
}
