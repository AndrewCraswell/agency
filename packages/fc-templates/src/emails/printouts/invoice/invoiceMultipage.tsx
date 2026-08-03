import { definePrintoutPreview } from "../printoutPreview.tsx"
import { multipageVariables } from "./invoice.variables.ts"

/* Enough items to run to a second sheet, where the repeated header and footer have to hold up. */
export default definePrintoutPreview({
  file: "src/emails/printouts/invoice/invoice.liquid",
  name: "invoiceMultipage",
  variables: multipageVariables
})
