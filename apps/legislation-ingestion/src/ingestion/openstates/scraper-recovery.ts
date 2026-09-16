import { execFile } from "node:child_process"
import { hostname } from "node:os"
import { promisify } from "node:util"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { and, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { releaseBillBatchOwnership, type BillBatchOwnership } from "../../persistence/bill-batch-ownership.js"
import { getLocalDockerRuntimeId } from "./scraper-docker.js"

const execute = promisify(execFile)
const held = z.object({
  ownershipStream: z.string().regex(/^ownership:(?:nc-bills:2025|ak-bills:34)(?::|$)/),
  token: z.string(),
  requiresConfirmedRelease: z.literal(true),
  released: z.literal(false),
  executor: z.object({ host: z.string().min(1), pid: z.number().int().positive(), runtimeId: z.string().min(1) })
})

async function readHeld(
  database: LegislationDatabase,
  owner: BillBatchOwnership
): Promise<Record<string, unknown> | null> {
  const rows = await database
    .select({ cursor: syncCheckpoints.cursor, stream: syncCheckpoints.stream })
    .from(syncCheckpoints)
    .where(
      and(
        eq(syncCheckpoints.source, owner.source),
        sql`starts_with(${syncCheckpoints.stream}, ${owner.stream})`,
        sql`${syncCheckpoints.cursor}->>'token' = ${owner.token}`
      )
    )
    .limit(2)
  if (rows.length !== 1) {
    throw new Error("Recovery requires one exact ownership record")
  }
  return { ...rows[0]!.cursor, ownershipStream: rows[0]!.stream }
}

async function hasExecutor(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") {
      return false
    }
    throw new Error("Executor absence could not be confirmed")
  }
}

async function hasContainer(token: string) {
  try {
    const result = await execute(
      "docker",
      ["container", "ls", "--all", "--filter", `label=io.agency.openstates.run-id=${token}`, "--format", "{{.ID}}"],
      {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        windowsHide: true
      }
    )
    return result.stdout.trim().length > 0
  } catch {
    throw new Error("Runtime absence could not be confirmed")
  }
}

/** Local recovery only. Never terminates a process/container, clears unknown provenance, or relies on age. */
export async function recoverLocalScraperOwnership(
  database: LegislationDatabase,
  token: string,
  dependencies = {
    read: readHeld,
    release: releaseBillBatchOwnership,
    host: hostname,
    runtimeId: getLocalDockerRuntimeId,
    hasExecutor,
    hasContainer
  }
) {
  z.string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/)
    .parse(token)
  const scope = { source: "openstates", stream: "ownership:", token }
  const record = held.parse(await dependencies.read(database, scope))
  const owner = { ...scope, stream: record.ownershipStream }
  if (record.token !== token || record.executor.host !== dependencies.host()) {
    throw new Error("Recovery requires the exact held attempt on its original host")
  }
  if (record.executor.runtimeId !== (await dependencies.runtimeId())) {
    throw new Error("Recovery requires the original Docker runtime")
  }
  if (await dependencies.hasExecutor(record.executor.pid)) {
    throw new Error("Original executor still exists; recovery is blocked")
  }
  if (await dependencies.hasContainer(token)) {
    throw new Error("Attempt container still exists; recovery is blocked")
  }
  if (!(await dependencies.release(database, owner))) {
    throw new Error("Ownership changed during recovery; nothing was released")
  }
  return { status: "released" as const, token, executorAbsent: true, containerAbsent: true }
}
