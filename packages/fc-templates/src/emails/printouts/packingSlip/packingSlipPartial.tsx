import { definePrintoutPreview } from "../printoutPreview.tsx"
import { partialVariables } from "./packingSlip.variables.ts"

/* One box of a split order, so the shipped-of-ordered counts and the split notice both show. */
export default definePrintoutPreview({
  file: "src/emails/printouts/packingSlip/packing-slip.liquid",
  name: "packingSlipPartial",
  variables: partialVariables
})
