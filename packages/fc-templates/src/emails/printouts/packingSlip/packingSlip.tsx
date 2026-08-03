import { definePrintoutPreview } from "../printoutPreview.tsx"
import { standardVariables } from "./packingSlip.variables.ts"

/* Six items, ten units, half of them without an image, on a single sheet. */
export default definePrintoutPreview({
  file: "src/emails/printouts/packingSlip/packing-slip.liquid",
  name: "packingSlip",
  variables: standardVariables
})
