import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { z } from "zod"
import { AzureBlobArtifactStore } from "../src/ingestion/documents/artifact-store.js"
import { reconcileNorthCarolinaCommittees } from "../src/ingestion/openstates/committee-reconciliation.js"
import { readArchivedPeoplePilot } from "../src/ingestion/openstates/pilot-archive.js"

const [directory, currentManifest, historyManifest] = process.argv.slice(2)
const account = process.env.AZURE_STORAGE_ACCOUNT
if (!directory || !currentManifest || !historyManifest || !account) {
  throw new Error(
    "Usage: reconcile-openstates-committees <committee-directory> <current-manifest> <history-manifest>; Azure account required"
  )
}
const root = resolve(directory)
const commit = z
  .object({
    sha: z.string().regex(/^[a-f0-9]{40}$/),
    commit: z.object({
      committer: z.object({ date: z.iso.datetime() })
    })
  })
  .parse(JSON.parse(await readFile(resolve(root, "commit.json"), "utf8")))
const tree = z
  .object({
    sha: z.literal(commit.sha),
    truncated: z.literal(false),
    tree: z.array(z.object({ path: z.string(), type: z.string() }))
  })
  .parse(JSON.parse(await readFile(resolve(root, "tree.json"), "utf8")))
const report = z
  .object({
    revision: z.literal(commit.sha),
    artifacts: z
      .array(
        z.object({
          path: z.string().regex(/^data\/nc\/committees\/[^/\\]+\.ya?ml$/),
          bytes: z.number().int().nonnegative(),
          sha256: z.string().regex(/^[a-f0-9]{64}$/)
        })
      )
      .min(1)
      .max(2000)
  })
  .parse(JSON.parse(await readFile(resolve(root, "report.json"), "utf8")))
const expected = tree.tree
  .filter((entry) => entry.type === "blob" && /^data\/nc\/committees\/[^/\\]+\.ya?ml$/.test(entry.path))
  .map((entry) => entry.path)
  .sort()
const actual = report.artifacts.map((entry) => entry.path).sort()
if (new Set(actual).size !== actual.length || JSON.stringify(expected) !== JSON.stringify(actual)) {
  throw new Error("Incomplete committee archive")
}
const files = []
for (const entry of report.artifacts) {
  const bytes = await readFile(resolve(root, entry.path))
  if (bytes.length !== entry.bytes || createHash("sha256").update(bytes).digest("hex") !== entry.sha256) {
    throw new Error("Committee checksum mismatch")
  }
  files.push({ path: entry.path, content: bytes.toString("utf8") })
}
const store = new AzureBlobArtifactStore(account, "state-sources")
const current = await readArchivedPeoplePilot(store, currentManifest)
const history = await readArchivedPeoplePilot(store, historyManifest)
if (current.lane !== "entities" || history.lane !== "history" || current.revision !== history.revision) {
  throw new Error("Mismatched people archive lanes or revisions")
}
const result = reconcileNorthCarolinaCommittees(
  files,
  [...current.files.filter((file) => file.path.startsWith("data/nc/legislature/")), ...history.files],
  commit.sha,
  commit.commit.committer.date
)
process.stdout.write(`${JSON.stringify(result)}\n`)
if (result.status !== "resolved") {
  process.exitCode = 1
}
