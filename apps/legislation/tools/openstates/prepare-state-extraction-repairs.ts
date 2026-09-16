import { createHash } from "node:crypto"
import { z } from "zod"
import { LocalArtifactStore } from "../../src/ingestion/documents/artifact-store.js"
import { requireStateRepairScope, stateContentControllerPayload } from "../../src/trigger/tasks/state-content-policy.js"

const [stateArg, sessionArg, digestArg, offsetArg = "0"] = process.argv.slice(2)
const state = z.enum(["nc", "ak"]).parse(stateArg)
const session = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/)
  .parse(sessionArg)
const digest = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .parse(digestArg)
const offset = z.coerce.number().int().min(0).parse(offsetArg)
const store = new LocalArtifactStore("artifacts/openstates-runtime/production-ocr-audit")
const bytes = await store.read(`${state}/${digest}.json`)
if (createHash("sha256").update(bytes).digest("hex") !== digest) {
  throw new Error("Repair inventory checksum mismatch")
}
const audit = z
  .object({
    state: z.literal(state),
    differences: z.array(
      z.object({
        productionId: z.string(),
        billId: z.string(),
        sourceUrl: z.url(),
        sourceSha256: z.string(),
        productionTextHash: z.string()
      })
    )
  })
  .parse(JSON.parse(Buffer.from(bytes).toString("utf8")))
const selected = audit.differences.slice(offset, offset + 10)
if (selected.length === 0) {
  throw new Error("No repair candidates at requested offset")
}
const extractionRepairs = selected.map((row) => ({
  documentId: row.productionId,
  billId: row.billId,
  sourceUrl: row.sourceUrl,
  sourceSha256: row.sourceSha256,
  previousTextHash: row.productionTextHash
}))
requireStateRepairScope(state, session, extractionRepairs)
const payload = stateContentControllerPayload.parse({
  state,
  session,
  billConcurrency: 1,
  billLimit: 2,
  maxContinuations: 10,
  extractionRepairs
})
const payloadBytes = Buffer.from(JSON.stringify(payload))
const payloadHash = createHash("sha256").update(payloadBytes).digest("hex")
const path = `${state}/payloads/${payloadHash}.json`
await store.put(path, payloadBytes)
if (
  createHash("sha256")
    .update(await store.read(path))
    .digest("hex") !== payloadHash
) {
  throw new Error("Repair payload checksum mismatch")
}
process.stdout.write(
  JSON.stringify({
    path,
    payloadHash,
    candidates: selected.length,
    nextOffset: offset + selected.length,
    inventoryTotal: audit.differences.length,
    dispatched: false,
    productionWrites: false
  }) + "\n"
)
