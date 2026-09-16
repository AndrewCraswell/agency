import { loadEnvFile } from "node:process"
import { configure, tasks } from "@trigger.dev/sdk"
import { Command } from "commander"
import {
  backfillControllerPayloadSchema,
  backfillIdempotencyKey,
  backfillPhases,
  createBackfillUnits
} from "../../src/trigger/backfill-contract.js"

const program = new Command()
  .name("run-trigger-backfill")
  .description("Plan or explicitly start the resumable Trigger.dev legislation backfill")
  .requiredOption("--end-congress <number>")
  .requiredOption("--manifest-blob <path>")
  .requiredOption("--rebuild-id <id>")
  .requiredOption("--start-congress <number>")
  .option("--apply", "trigger the backfill; without this flag the command only prints a local plan")
  .option("--bill-types <types>", "comma-separated GovInfo bill types")
  .option("--jurisdictions <codes>", "comma-separated OpenStates jurisdiction codes")
  .option("--phases <phases>", `comma-separated phases: ${backfillPhases.join(", ")}`)
  .action(run)

try {
  loadLocalEnvironment()
  await program.parseAsync()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Trigger.dev backfill command failed"}\n`)
  process.exitCode = 1
}

async function run(options: {
  apply?: boolean
  billTypes?: string
  endCongress: string
  jurisdictions?: string
  manifestBlob: string
  phases?: string
  rebuildId: string
  startCongress: string
}) {
  const payload = backfillControllerPayloadSchema.parse({
    ...(options.billTypes === undefined ? {} : { billTypes: commaSeparated(options.billTypes) }),
    endCongress: positiveInteger(options.endCongress, "end Congress"),
    ...(options.jurisdictions === undefined ? {} : { jurisdictions: commaSeparated(options.jurisdictions) }),
    openStatesManifestBlob: options.manifestBlob,
    ...(options.phases === undefined ? {} : { phases: commaSeparated(options.phases) }),
    rebuildId: options.rebuildId,
    startCongress: positiveInteger(options.startCongress, "start Congress")
  })
  const units = createBackfillUnits(payload)
  if (options.apply !== true) {
    process.stdout.write(
      `${JSON.stringify({ payload, status: "planned", unitKeys: units.map((unit) => unit.key), units: units.length }, null, 2)}\n`
    )
    return
  }

  const accessToken = process.env.TRIGGER_DEV_API_KEY?.trim() || process.env.TRIGGER_SECRET_KEY?.trim()
  if (accessToken === undefined) {
    throw new Error("TRIGGER_SECRET_KEY or TRIGGER_DEV_API_KEY is required with --apply")
  }
  configure({ accessToken })
  const handle = await tasks.trigger("legislation-backfill", payload, {
    idempotencyKey: backfillIdempotencyKey(payload.rebuildId, "controller")
  })
  process.stdout.write(
    `${JSON.stringify({ rebuildId: payload.rebuildId, runId: handle.id, status: "triggered", units: units.length }, null, 2)}\n`
  )
}

function commaSeparated(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function positiveInteger(value: string, label: string): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

function loadLocalEnvironment(): void {
  try {
    loadEnvFile(new URL("../../.env", import.meta.url))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error
    }
  }
}
