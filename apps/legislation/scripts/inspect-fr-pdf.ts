import { resolve } from "node:path"
import { z } from "zod"
import { normalizeFrDocumentNumber } from "../src/ingestion/regulations/fr-metadata-contract.js"
import { inspectFrPdf } from "../src/ingestion/regulations/fr-pdf-validation.js"

const path = resolve(z.string().min(1).parse(process.argv[2]))
const number = normalizeFrDocumentNumber(z.string().min(1).parse(process.argv[3]))
process.stdout.write(JSON.stringify(await inspectFrPdf(path, number)))
