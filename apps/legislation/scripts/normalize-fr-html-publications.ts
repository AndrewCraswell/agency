import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { z } from "zod"
import { loadFrHtmlPublications } from "../src/ingestion/regulations/fr-publication-files.js"
const { values } = parseArgs({
  options: {
    metadata: { type: "string" },
    date: { type: "string" },
    html: { type: "string" },
    pdf: { type: "string" },
    validation: { type: "string" },
    output: { type: "string" }
  }
})
const path = (value: unknown) => resolve(z.string().min(1).parse(value))
const { metadata, date, publications, bytes, normalizerHash, quarantine, coverage } = await loadFrHtmlPublications({
  metadata: path(values.metadata),
  date: z.iso.date().parse(values.date),
  html: path(values.html),
  pdf: path(values.pdf),
  validation: path(values.validation)
})
await writeFile(
  path(values.output),
  JSON.stringify(
    {
      metadataManifestId: metadata.id,
      date,
      publications,
      quarantine,
      coverage,
      normalizerHash,
      canonicalWrites: false,
      publicationReady: false,
      externalRequests: false
    },
    null,
    2
  ),
  { flag: "wx" }
)
process.stdout.write(
  JSON.stringify({
    publications: publications.length,
    coverage,
    bytes,
    canonicalWrites: false,
    publicationReady: false
  })
)
