import { resolve } from "node:path"
import { z } from "zod"
import { extractReviewedFrPdfRegions } from "../fr-pdf-regions.js"

process.stdout.write(
  JSON.stringify(await extractReviewedFrPdfRegions(resolve(z.string().min(1).parse(process.argv[2]))))
)
