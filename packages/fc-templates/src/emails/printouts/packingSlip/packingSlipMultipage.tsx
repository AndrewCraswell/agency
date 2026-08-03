import { definePrintoutPreview } from "../printoutPreview.tsx"
import { multipageVariables } from "./packingSlip.variables.ts"

/* Six times the items, so the slip runs over and repeats its footer on every sheet. */
export default definePrintoutPreview({
  file: "src/emails/printouts/packingSlip/packing-slip.liquid",
  name: "packingSlipMultipage",
  variables: multipageVariables
})
