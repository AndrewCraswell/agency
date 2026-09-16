import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { configure, tasks } from "@trigger.dev/sdk"
import { Command } from "commander"
import { z } from "zod"
import { requireStateRepairScope, stateContentControllerPayload } from "../../src/trigger/tasks/state-content-policy.js"

const options = new Command()
  .name("run-state-extraction-repairs")
  .requiredOption("--payload <path>", "retained repair payload file")
  .requiredOption("--sha256 <digest>", "expected retained payload checksum")
  .requiredOption("--version <deployment>", "explicit Trigger deployment version; never use the moving default")
  .option("--apply", "submit the verified payload to Trigger; otherwise print a plan")
  .parse()
  .opts<{ payload: string; sha256: string; version: string; apply?: boolean }>()

const version = z
  .string()
  .regex(/^\d{8}\.\d+$/)
  .parse(options.version)
const digest = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .parse(options.sha256)
const bytes = await readFile(options.payload)
if (createHash("sha256").update(bytes).digest("hex") !== digest) {
  throw new Error("Repair payload checksum mismatch")
}
const payload = stateContentControllerPayload.parse(JSON.parse(bytes.toString("utf8")))
const repairs = payload.extractionRepairs ?? []
if (repairs.length === 0) {
  throw new Error("Repair dispatch requires at least one audited target")
}
requireStateRepairScope(payload.state, payload.session, repairs)
const idempotencyKey = `state-extraction-repair:${payload.state}:${version}:${digest}`
const plan = {
  state: payload.state,
  session: payload.session,
  candidates: repairs.length,
  payloadHash: digest,
  version,
  idempotencyKey
}
if (options.apply !== true) {
  process.stdout.write(JSON.stringify({ ...plan, dispatched: false }) + "\n")
} else {
  const accessToken = process.env.TRIGGER_DEV_API_KEY?.trim() || process.env.TRIGGER_SECRET_KEY?.trim()
  if (!accessToken) {
    throw new Error("TRIGGER_SECRET_KEY or TRIGGER_DEV_API_KEY is required with --apply")
  }
  configure({ accessToken })
  const handle = await tasks.trigger("openstates-content-controller", payload, {
    version,
    idempotencyKey,
    concurrencyKey: `${payload.state}:${payload.session}`
  })
  process.stdout.write(JSON.stringify({ ...plan, dispatched: true, runId: handle.id }) + "\n")
}
