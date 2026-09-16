import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { z } from "zod"
import { replayFrMetadata } from "../../src/ingestion/regulations/fr-metadata.js"
import {
  frSourceReferenceContract,
  projectFrSourceReferences
} from "../../src/ingestion/regulations/fr-source-references.js"

const { values } = parseArgs({ options: { metadata: { type: "string" }, output: { type: "string" } } })
const path = (value: unknown) => resolve(z.string().min(1).parse(value))
const metadata = await replayFrMetadata(JSON.parse(await readFile(path(values.metadata), "utf8")))
const records = metadata.records
  .filter((record) => record.type !== "Presidential Document")
  .map(projectFrSourceReferences)
const agencies = records.flatMap((record) => record.agencies)
const identifiers = records.flatMap((record) => [...record.rins, ...record.dockets])
const counts = {
  publications: records.length,
  agencyOccurrences: agencies.length,
  publisherAgencyIds: new Set(
    agencies.flatMap((agency) =>
      agency.identityBasis === "publisher_id" && agency.reference ? [agency.reference.sourceAgencyId] : []
    )
  ).size,
  unidentifiedAgencyOccurrences: agencies.filter((agency) => agency.identityBasis === "document_occurrence").length,
  unusableAgencyNames: agencies.filter((agency) => agency.reference === null).length,
  rinOccurrences: records.reduce((count, record) => count + record.rins.length, 0),
  docketOccurrences: records.reduce((count, record) => count + record.dockets.length, 0),
  emptyIdentifiers: identifiers.filter((identifier) => identifier.sourceReferenceId === null).length
}
await writeFile(
  path(values.output),
  JSON.stringify(
    {
      contract: frSourceReferenceContract,
      metadataManifestId: metadata.id,
      counts,
      records,
      canonicalWrites: false,
      externalRequests: false
    },
    null,
    2
  ),
  { flag: "wx" }
)
process.stdout.write(JSON.stringify(counts))
