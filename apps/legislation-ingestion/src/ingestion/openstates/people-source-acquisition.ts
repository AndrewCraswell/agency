import { createHash } from "node:crypto"
import { unzipSync } from "fflate"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { peopleSourceState, type PeopleRepositoryFile } from "./people-repository.js"
import { archivePeoplePilot } from "./pilot-archive.js"

const revisionSchema = z.string().regex(/^[a-f0-9]{40}$/)
const stateSchema = peopleSourceState
const maximumArchiveBytes = 100 * 1024 * 1024
const maximumExpandedBytes = 200 * 1024 * 1024

type Fetch = typeof fetch

function githubHeaders(token?: string) {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "agency-legislation-ingestion",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

export async function resolvePeopleRepositoryRevision(fetcher: Fetch = fetch, token?: string): Promise<string> {
  const response = await fetcher("https://api.github.com/repos/openstates/people/git/ref/heads/main", {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) {
    throw new Error(`Open States people revision request failed with HTTP ${response.status}`)
  }
  const result = z.object({ object: z.object({ sha: revisionSchema }) }).parse(await response.json())
  return result.object.sha
}

export async function downloadPeopleRepositoryRevision(
  revision: string,
  fetcher: Fetch = fetch,
  token?: string
): Promise<PeopleRepositoryFile[]> {
  revisionSchema.parse(revision)
  const response = await fetcher(`https://codeload.github.com/openstates/people/zip/${revision}`, {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(120_000)
  })
  if (!response.ok) {
    throw new Error(`Open States people archive request failed with HTTP ${response.status}`)
  }
  const declaredBytes = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredBytes) && declaredBytes > maximumArchiveBytes) {
    throw new Error("Open States people archive exceeds the compressed size limit")
  }
  const compressed = new Uint8Array(await response.arrayBuffer())
  if (compressed.length === 0 || compressed.length > maximumArchiveBytes) {
    throw new Error("Open States people archive has an invalid compressed size")
  }
  const archive = unzipSync(compressed)
  const root = `people-${revision}/`
  const files: PeopleRepositoryFile[] = []
  let expandedBytes = 0
  for (const [archivePath, bytes] of Object.entries(archive)) {
    if (!archivePath.startsWith(root)) continue
    const path = archivePath.slice(root.length)
    const match = /^data\/([a-z]{2})\/(legislature|committees|retired|executive|municipalities)\/[^/\\]+\.ya?ml$/.exec(
      path
    )
    if (!match || !stateSchema.safeParse(match[1]).success) {
      continue
    }
    expandedBytes += bytes.length
    if (expandedBytes > maximumExpandedBytes) {
      throw new Error("Open States people archive exceeds the expanded size limit")
    }
    files.push({ path, content: Buffer.from(bytes).toString("utf8") })
  }
  if (files.length === 0) {
    throw new Error("Open States people archive contained no supported jurisdiction files")
  }
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

export async function archivePeopleRepositoryRevision(
  target: ArtifactStore,
  input: {
    files: readonly PeopleRepositoryFile[]
    retrievedAt: Date
    revision: string
    state: z.infer<typeof stateSchema>
  }
) {
  const revision = revisionSchema.parse(input.revision)
  const state = stateSchema.parse(input.state)
  if (!Number.isFinite(input.retrievedAt.getTime())) throw new Error("Invalid people source retrieval date")
  const runId = `source-${revision.slice(0, 16)}`
  const current = await archivePeoplePilot(
    createLaneStore(input.files, revision, input.retrievedAt, state, "entities"),
    target,
    runId,
    "entities",
    state
  )
  const history = await archivePeoplePilot(
    createLaneStore(input.files, revision, input.retrievedAt, state, "history"),
    target,
    runId,
    "history",
    state
  )
  return {
    currentManifestPath: current.manifestPath,
    historyManifestPath: history.manifestPath,
    revision,
    state
  }
}

function createLaneStore(
  files: readonly PeopleRepositoryFile[],
  revision: string,
  retrievedAt: Date,
  state: z.infer<typeof stateSchema>,
  lane: "entities" | "history"
): Pick<ArtifactStore, "read"> {
  const lanePattern =
    lane === "entities"
      ? new RegExp(`^data/${state}/(legislature|committees)/[^/\\\\]+\\.ya?ml$`)
      : new RegExp(`^data/${state}/(retired|executive|municipalities)/[^/\\\\]+\\.ya?ml$`)
  const selected = files.filter((file) => lanePattern.test(file.path))
  if (selected.length === 0) throw new Error(`Open States people ${state} ${lane} lane is empty`)
  const artifacts = selected.map((file) => {
    const bytes = Buffer.from(file.content)
    return {
      path: file.path,
      bytes,
      entry: { path: file.path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }
    }
  })
  const objects = new Map<string, Uint8Array>(artifacts.map((artifact) => [artifact.path, artifact.bytes]))
  objects.set(
    "report.json",
    Buffer.from(
      JSON.stringify({
        revision,
        retrievedAt: retrievedAt.toISOString(),
        artifacts: artifacts.map((artifact) => artifact.entry)
      })
    )
  )
  objects.set(
    "tree.json",
    Buffer.from(
      JSON.stringify({
        sha: revision,
        truncated: false,
        tree: artifacts.map((artifact) => ({ path: artifact.path, type: "blob" }))
      })
    )
  )
  return {
    async read(path) {
      const bytes = objects.get(path)
      if (!bytes) throw new Error(`Missing generated people source object: ${path}`)
      return bytes
    }
  }
}
