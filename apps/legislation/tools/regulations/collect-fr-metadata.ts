import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { z } from "zod"
import { frMetadataScopeSchema } from "../../src/ingestion/regulations/fr-metadata-contract.js"
import { collectFrMetadataToDirectory, replayFrMetadata } from "../../src/ingestion/regulations/fr-metadata.js"

const { values } = parseArgs({
  options: {
    start: { type: "string" },
    end: { type: "string" },
    cutoff: { type: "string" },
    output: { type: "string" },
    replay: { type: "string" },
    "page-size": { type: "string", default: "200" },
    "max-requests": { type: "string", default: "200" },
    apply: { type: "boolean", default: false }
  }
})
if (values.replay) {
  const manifest = await replayFrMetadata(JSON.parse(await readFile(resolve(values.replay), "utf8")))
  const directory = resolve(z.string().min(1).parse(values.output))
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx" })
  process.stdout.write(
    `${JSON.stringify({ mode: "offline_replay", manifestId: manifest.id, pages: manifest.pages.length, records: manifest.records.length })}\n`
  )
} else {
  const scope = frMetadataScopeSchema.parse({ start: values.start, end: values.end, cutoff: values.cutoff })
  const pageSize = z.coerce.number().int().min(1).max(1000).parse(values["page-size"])
  const maximumRequests = z.coerce.number().int().min(1).max(1000).parse(values["max-requests"])
  if (!values.apply) {
    process.stdout.write(
      `${JSON.stringify({ mode: "preview", scope, pageSize, maximumRequests, networkRequests: 0, canonicalWrites: false })}\n`
    )
  } else {
    const directory = resolve(z.string().min(1).parse(values.output))
    const manifest = await collectFrMetadataToDirectory(directory, scope, { pageSize, maximumRequests })
    process.stdout.write(
      `${JSON.stringify({
        mode: "acquired",
        manifestId: manifest.id,
        pages: manifest.pages.length,
        records: manifest.records.length,
        partitions: manifest.partitions.length,
        canonicalWrites: false,
        output: join(directory, "manifest.json")
      })}\n`
    )
  }
}
