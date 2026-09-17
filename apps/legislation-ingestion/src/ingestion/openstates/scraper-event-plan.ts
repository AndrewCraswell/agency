import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { parseAlaskaEventPlan, readAlaskaEventPlan, type AlaskaEventPlan } from "./scraper-event-cycle.js"

const sourceUrl = "https://www.akleg.gov/publicservice/basis/meetings?session=34"
const plannerPath = fileURLToPath(new URL("../../../python/plan_alaska_events.py", import.meta.url))
const executeFile = promisify(execFile)

async function planWithPython(source: Uint8Array): Promise<AlaskaEventPlan> {
  const directory = await mkdtemp(join(tmpdir(), "alaska-event-plan-"))
  const sourcePath = join(directory, "meetings.xml")
  const planPath = join(directory, "plan.json")
  try {
    await writeFile(sourcePath, source, { flag: "wx" })
    await executeFile("python", [plannerPath, sourcePath, planPath], {
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true
    })
    const raw: unknown = JSON.parse(await readFile(planPath, "utf8"))
    return parseAlaskaEventPlan(raw)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}

async function fetchOfficialInventory(request: typeof fetch): Promise<Uint8Array> {
  const response = await request(sourceUrl, {
    headers: { Accept: "text/xml" },
    redirect: "error",
    signal: AbortSignal.timeout(45_000)
  })
  if (!response.ok) throw new Error(`Alaska meeting inventory returned status ${response.status}`)
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("text/xml")) {
    throw new Error("Alaska meeting inventory returned an unexpected content type")
  }
  const declared = Number(response.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > 16 * 1024 * 1024) {
    throw new Error("Alaska meeting inventory exceeds the source size limit")
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.length || bytes.length > 16 * 1024 * 1024) {
    throw new Error("Alaska meeting inventory has an invalid source size")
  }
  return bytes
}

async function putExact(store: ArtifactStore, path: string, bytes: Uint8Array) {
  await store.put(path, bytes)
  if (!Buffer.from(await store.read(path)).equals(bytes)) {
    throw new Error("Frozen Alaska meeting inventory conflicts with retained evidence")
  }
}

/** Acquire, validate, and immutably retain one complete publisher inventory before dispatching any batch. */
export async function acquireAlaskaEventPlan(
  store: ArtifactStore,
  dependencies: {
    fetch?: typeof fetch
    plan?: (source: Uint8Array) => Promise<AlaskaEventPlan>
  } = {}
) {
  const source = await fetchOfficialInventory(dependencies.fetch ?? fetch)
  const sourceSha256 = createHash("sha256").update(source).digest("hex")
  const plan = await (dependencies.plan ?? planWithPython)(source)
  if (plan.source_sha256 !== sourceSha256) {
    throw new Error("Alaska event plan does not identify the acquired source")
  }
  const prefix = `openstates/scraper-plans/ak/events/${sourceSha256}`
  const sourcePath = `${prefix}.xml`
  const planPath = `${prefix}.json`
  await putExact(store, sourcePath, source)
  await putExact(store, planPath, Buffer.from(JSON.stringify(plan)))
  const retained = await readAlaskaEventPlan(store, planPath)
  return {
    sourcePath,
    planPath,
    inventoryId: retained.source_sha256,
    batches: retained.batches.length,
    occurrences: retained.partition.accepted_occurrences,
    quarantined: retained.partition.quarantined.length
  }
}
