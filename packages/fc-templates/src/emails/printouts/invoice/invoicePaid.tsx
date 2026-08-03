import { definePrintoutPreview } from "../printoutPreview.tsx"
import { paidVariables } from "./invoice.variables.ts"

/* The invoice as it prints once the authorization has been captured. */
export default definePrintoutPreview({
  file: "src/emails/printouts/invoice/invoice.liquid",
  name: "invoicePaid",
  variables: paidVariables
})
