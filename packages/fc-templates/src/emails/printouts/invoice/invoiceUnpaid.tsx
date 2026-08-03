import { definePrintoutPreview } from "../printoutPreview.tsx"
import { unpaidVariables } from "./invoice.variables.ts"

/* The same invoice with a balance still outstanding, which is the copy the amount due depends on. */
export default definePrintoutPreview({
  file: "src/emails/printouts/invoice/invoice.liquid",
  name: "invoiceUnpaid",
  variables: unpaidVariables
})
