import { parseArgs } from "node:util"
import { z } from "zod"
import { stageReviewedFrPdfRegions } from "../../src/ingestion/regulations/fr-pdf-regions.js"
const { values } = parseArgs({ options: { pdf: { type: "string" }, output: { type: "string" } } })
const result = await stageReviewedFrPdfRegions(
  z.string().min(1).parse(values.pdf),
  z.string().min(1).parse(values.output)
)
process.stdout.write(
  JSON.stringify({
    path: result.path,
    generation: result.artifact.generation,
    reused: result.reused,
    documents: result.artifact.result.documents.map((row) => ({
      nativeIdentity: row.nativeIdentity,
      characters: row.text.length,
      textHash: row.textHash
    })),
    publicationReady: false
  })
)
