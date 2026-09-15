import { resolve } from "node:path"
import { z } from "zod"
import { normalizeFrDocumentNumber } from "../src/ingestion/regulations/fr-metadata-contract.js"
import { extractFrPdfText } from "../src/ingestion/regulations/fr-pdf-text.js"

process.stdout.write(
  JSON.stringify(
    await extractFrPdfText(
      resolve(z.string().min(1).parse(process.argv[2])),
      normalizeFrDocumentNumber(z.string().min(1).parse(process.argv[3]))
    )
  )
)
