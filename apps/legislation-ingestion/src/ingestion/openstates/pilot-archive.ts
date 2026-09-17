import { createHash } from "node:crypto"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { peopleSourceProfiles, type PeopleRepositoryFile } from "./people-repository.js"

const sourcePaths = {
  entities: /^data\/nc\/(legislature|committees)\/[^/\\]+\.ya?ml$/,
  history: /^data\/nc\/(retired|executive|municipalities)\/[^/\\]+\.ya?ml$/
}
const laneSchema = z.enum(["entities", "history"])
const entrySchema = z.object({
  path: z.string(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/)
})
function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

/** Verify the entire retained run before publishing an archive completion marker. */
async function readPilot(
  store: Pick<ArtifactStore, "read">,
  lane: z.infer<typeof laneSchema>,
  state: keyof typeof peopleSourceProfiles = "nc"
) {
  const profile = peopleSourceProfiles[z.enum(["nc", "ak"]).parse(state)]
  const sourcePath = new RegExp(sourcePaths[lane].source.replace("nc", profile.state))
  const reportBytes = await store.read("report.json")
  const report = z
    .object({
      revision: z.string().regex(/^[a-f0-9]{40}$/),
      retrievedAt: z.iso.datetime(),
      artifacts: z
        .array(entrySchema.extend({ path: z.string().regex(sourcePath) }))
        .min(1)
        .max(2_000)
    })
    .parse(JSON.parse(Buffer.from(reportBytes).toString("utf8")))
  const treeBytes = await store.read("tree.json")
  const tree = z
    .object({
      sha: z.literal(report.revision),
      truncated: z.literal(false),
      tree: z.array(z.object({ path: z.string(), type: z.string() }))
    })
    .parse(JSON.parse(Buffer.from(treeBytes).toString("utf8")))
  const expected = tree.tree
    .filter((entry) => entry.type === "blob" && sourcePath.test(entry.path))
    .map((entry) => entry.path)
    .sort()
  const paths = report.artifacts.map((entry) => entry.path).sort()
  if (new Set(paths).size !== paths.length || JSON.stringify(paths) !== JSON.stringify(expected)) {
    throw new Error("Artifact manifest does not cover source tree")
  }
  const objects = [
    { path: "report.json", bytes: reportBytes },
    { path: "tree.json", bytes: treeBytes }
  ]
  const files: PeopleRepositoryFile[] = []
  for (const entry of report.artifacts) {
    const bytes = await store.read(entry.path)
    if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) {
      throw new Error("Source checksum mismatch")
    }
    objects.push({ path: entry.path, bytes })
    files.push({ path: entry.path, content: Buffer.from(bytes).toString("utf8") })
  }
  return { files, objects, retrievedAt: new Date(report.retrievedAt), revision: report.revision, state }
}

export async function archivePeoplePilot(
  source: Pick<ArtifactStore, "read">,
  target: ArtifactStore,
  runId: string,
  lane: z.infer<typeof laneSchema> = "entities",
  state: keyof typeof peopleSourceProfiles = "nc"
) {
  laneSchema.parse(lane)
  z.string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,100}$/)
    .parse(runId)
  const pilot = await readPilot(source, lane, state)
  const prefix = `openstates/people/${pilot.revision}/${state}/${lane}/${runId}`
  async function putVerified(path: string, bytes: Uint8Array) {
    await target.put(path, bytes)
    // Existing paths are reusable only if byte-identical; never overwrite.
    if (digest(await target.read(path)) !== digest(bytes)) {
      throw new Error("Archived artifact conflict or corruption")
    }
  }
  const entries = []
  for (const object of pilot.objects) {
    await putVerified(`${prefix}/files/${object.path}`, object.bytes)
    entries.push({ path: object.path, bytes: object.bytes.length, sha256: digest(object.bytes) })
  }
  const manifestPath = `${prefix}/complete.json`
  await putVerified(
    manifestPath,
    Buffer.from(JSON.stringify({ revision: pilot.revision, runId, entries, canonicalWrites: false }))
  )
  return { manifestPath, files: entries.length, canonicalWrites: false }
}

export async function readArchivedPeoplePilot(store: Pick<ArtifactStore, "read">, manifestPath: string) {
  const match =
    /^openstates\/people\/([a-f0-9]{40})\/(nc|ak)\/(entities|history)\/([a-zA-Z0-9][a-zA-Z0-9-]{0,100})\/complete\.json$/.exec(
      manifestPath
    )
  if (!match) {
    throw new Error("Invalid archive manifest path")
  }
  const manifest = z
    .object({
      revision: z.literal(match[1]!),
      runId: z.literal(match[4]!),
      entries: z.array(entrySchema).min(3).max(2_002)
    })
    .parse(JSON.parse(Buffer.from(await store.read(manifestPath)).toString("utf8")))
  if (manifest.revision !== match[1]) {
    throw new Error("Archive revision mismatch")
  }
  const entries = new Map(manifest.entries.map((entry) => [entry.path, entry]))
  if (entries.size !== manifest.entries.length) {
    throw new Error("Duplicate archive entry")
  }
  const state = z.enum(["nc", "ak"]).parse(match[2])
  const lane = laneSchema.parse(match[3])
  const pilot = await readPilot(
    {
      async read(path) {
        const entry = entries.get(path)
        if (!entry) {
          throw new Error("Incomplete archive manifest")
        }
        const bytes = await store.read(`${manifestPath.slice(0, -"complete.json".length)}files/${path}`)
        if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) {
          throw new Error("Archive checksum mismatch")
        }
        return bytes
      }
    },
    lane,
    state
  )
  if (pilot.objects.length !== entries.size) {
    throw new Error("Unexpected archive entries")
  }
  return { ...pilot, lane }
}
