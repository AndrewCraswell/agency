import { resolve } from "node:path"
import { z } from "zod"
import { normalizeFrDocumentNumber } from "../fr-metadata-contract.js"
import { extractFrPdfText } from "../fr-pdf-text.js"

process.stdout.write(
  JSON.stringify(
    await extractFrPdfText(
      resolve(z.string().min(1).parse(process.argv[2])),
      normalizeFrDocumentNumber(z.string().min(1).parse(process.argv[3]))
    )
  )
)
