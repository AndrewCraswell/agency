import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtemp, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { archiveScraperAttempt, readArchivedScraperAttempt } from "./scraper-archive.js"
import { scraperAttemptDirectory } from "./scraper-attempt-directory.js"
import { readScraperBillPlan } from "./scraper-batches.js"
import { readScraperBillDispatch } from "./scraper-dispatch.js"
import type { executeScraperBillBatch } from "./scraper-execution.js"
import { ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

const execute = promisify(execFile)
export async function getLocalDockerRuntimeId() {
  try {
    const result = await execute("docker", ["info", "--format", "{{.ID}}"], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true
    })
    return z.string().trim().min(1).parse(result.stdout)
  } catch {
    throw new Error("Docker runtime identity could not be confirmed")
  }
}
type DockerCommand = (args: string[], timeout: number) => Promise<string>
const docker: DockerCommand = async (args, timeout) => {
  const result = await execute("docker", args, { timeout, maxBuffer: 1024 * 1024, windowsHide: true })
  return result.stdout
}

/** Local acceptance adapter only. No image pulls, production activation, DB secrets or upstream importer. */
export function createScraperDockerAdapter(
  options: { store: ArtifactStore; imageId: string; network: "none" | "bridge" },
  command: DockerCommand = docker
): Parameters<typeof executeScraperBillBatch>[1]["extractAndArchive"] {
  z.string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .parse(options.imageId)
  z.enum(["none", "bridge"]).parse(options.network)
  return async (request) => {
    const dispatch = await readScraperBillDispatch(options.store, request.dispatchPath, new Date())
    const plan = await readScraperBillPlan(options.store, dispatch.planPath)
    const batch = plan.batches.find((entry) => entry.id === dispatch.batchId)
    if (dispatch.runId !== request.runId || JSON.stringify(batch?.billIds) !== JSON.stringify(request.billIds)) {
      throw new Error("Docker request does not match retained dispatch")
    }
    return runScraperContainer(
      options,
      request,
      {
        jurisdiction: plan.jurisdiction,
        domain: "bills",
        session: plan.session,
        bill_ids: request.billIds
      },
      command
    )
  }
}

/** Event admission owns selection and leases; this boundary owns resource limits and confirmed shutdown. */
export async function extractAlaskaEventsDocker(
  options: { store: ArtifactStore; imageId: string; network: "none" | "bridge" },
  request: { runId: string; runtimeId: string; maxDurationSeconds: number; eventKeys: string[] },
  command: DockerCommand = docker
) {
  const keys = z
    .array(z.string().regex(/^[HSJ]:[A-Z0-9&]+:[0-9T:+.-]+$/))
    .min(1)
    .max(10)
    .parse(request.eventKeys)
  if (new Set(keys).size !== keys.length) {
    throw new Error("Duplicate event selection")
  }
  return runScraperContainer(
    options,
    request,
    { jurisdiction: "ak", domain: "events", session: "34", bill_ids: null, event_keys: keys },
    command
  )
}

async function runScraperContainer(
  options: { store: ArtifactStore; imageId: string; network: "none" | "bridge" },
  request: { runId: string; runtimeId?: string; maxDurationSeconds: number },
  scope: {
    jurisdiction: "nc" | "ak"
    domain: "bills" | "events"
    session: string
    bill_ids: readonly string[] | null
    event_keys?: string[]
  },
  command: DockerCommand
) {
  z.string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .parse(options.imageId)
  z.enum(["none", "bridge"]).parse(options.network)
  z.string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/)
    .parse(request.runId)
  z.number().int().min(1).max(1500).parse(request.maxDurationSeconds)
  const runtimeId = z.string().trim().min(1).parse(request.runtimeId)
  const matchesRuntime = async () => {
    try {
      return (await command(["info", "--format", "{{.ID}}"], 30_000)).trim() === runtimeId
    } catch {
      return false
    }
  }
  if (!(await matchesRuntime())) {
    throw new Error("Docker runtime does not match claimed ownership; extraction was not started")
  }
  const directory = await mkdtemp(join(tmpdir(), "openstates-attempt-"))
  const name = `openstates-attempt-${randomUUID()}`
  const payload = {
    ...scope,
    timeout_seconds: request.maxDurationSeconds,
    revision: "d43f853796ceeeb49205f7d144790647764ce105"
  }
  try {
    // A nonzero exit can contain a valid failed-attempt manifest. Retain it after confirming shutdown.
    await command(
      [
        "run",
        "--name",
        name,
        "--label",
        `io.agency.openstates.run-id=${request.runId}`,
        "--pull=never",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--cpus=1",
        "--memory=2g",
        "--pids-limit=128",
        "--network",
        options.network,
        "--tmpfs",
        "/tmp:rw,nosuid,size=256m",
        "--mount",
        `type=bind,source=${directory},target=/staging`,
        options.imageId,
        "python",
        "/opt/openstates/adapter/openstates_runner.py",
        JSON.stringify(payload),
        "/opt/openstates/inputs/source",
        "/staging"
      ],
      (request.maxDurationSeconds + 60) * 1000
    )
  } catch {
    // Never expose raw child output or host credentials through an execution error.
  }
  // Both successful and failed Docker exits reach the same mandatory shutdown confirmation.
  {
    if (!(await matchesRuntime())) {
      throw new ScraperWorkerStopUnconfirmedError()
    }
    try {
      await command(["rm", "--force", name], 30_000)
    } catch {
      // Failed startup may leave no container; failed Docker connectivity is not proof of shutdown.
    }
    let remaining: string
    try {
      remaining = await command(
        ["container", "ls", "--all", "--filter", `name=^/${name}$`, "--format", "{{.ID}}"],
        30_000
      )
    } catch {
      throw new ScraperWorkerStopUnconfirmedError()
    }
    if (remaining.trim()) {
      throw new ScraperWorkerStopUnconfirmedError()
    }
    if (!(await matchesRuntime())) {
      throw new ScraperWorkerStopUnconfirmedError()
    }
  }
  const entries = await readdir(directory, { withFileTypes: true })
  const [attempt] = entries
  if (
    entries.length !== 1 ||
    !attempt?.isDirectory() ||
    !new RegExp(`^openstates-${scope.jurisdiction}-[a-zA-Z0-9_-]+$`).test(attempt.name)
  ) {
    throw new Error("Stopped scraper did not produce one inspectable attempt directory")
  }
  const archived = await archiveScraperAttempt(
    scraperAttemptDirectory(join(directory, attempt.name)),
    options.store,
    request.runId
  )
  await readArchivedScraperAttempt(options.store, archived.manifestPath)
  return { manifestPath: archived.manifestPath }
}
