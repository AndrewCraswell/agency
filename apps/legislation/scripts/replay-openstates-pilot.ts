import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { z } from "zod"
import {
  northCarolinaPeopleSource,
  validatePeopleRepositorySnapshot,
  type PeopleRepositoryFile
} from "../src/ingestion/openstates/people-repository.js"

// Offline, read-only replay: rejects modified or missing artifacts before normalizing.
const directory = process.argv[2]
if (!directory) {
  throw new Error("Usage: pnpm replay:openstates-pilot <retained-run-directory>")
}
const report = z
  .object({
    revision: z.literal(northCarolinaPeopleSource.revision),
    retrievedAt: z.iso.datetime(),
    artifacts: z
      .array(
        z.object({
          path: z.string().regex(/^data\/nc\/(legislature|committees)\/[^/\\]+\.ya?ml$/),
          bytes: z.number().int().nonnegative(),
          sha256: z.string().regex(/^[a-f0-9]{64}$/)
        })
      )
      .min(1)
      .max(2_000)
  })
  .parse(JSON.parse(await readFile(resolve(directory, "report.json"), "utf8")))
const tree = z
  .object({
    sha: z.literal(report.revision),
    truncated: z.literal(false),
    tree: z.array(z.object({ path: z.string(), type: z.string() }))
  })
  .parse(JSON.parse(await readFile(resolve(directory, "tree.json"), "utf8")))
const expected = tree.tree
  .filter((entry) => entry.type === "blob" && /^data\/nc\/(legislature|committees)\/[^/]+\.ya?ml$/.test(entry.path))
  .map((entry) => entry.path)
  .sort()
if (JSON.stringify(expected) !== JSON.stringify(report.artifacts.map((entry) => entry.path).sort())) {
  throw new Error("Artifact manifest does not cover the retained source tree")
}
const files: PeopleRepositoryFile[] = []
for (const artifact of report.artifacts) {
  const bytes = await readFile(resolve(directory, artifact.path))
  if (bytes.length !== artifact.bytes || createHash("sha256").update(bytes).digest("hex") !== artifact.sha256) {
    throw new Error(`Artifact checksum mismatch: ${artifact.path}`)
  }
  files.push({ path: artifact.path, content: bytes.toString("utf8") })
}
const result = validatePeopleRepositorySnapshot(files, new Date(report.retrievedAt))
process.stdout.write(
  `${JSON.stringify(
    {
      revision: report.revision,
      counts: result.counts,
      coverageIssues: result.coverageIssues,
      unresolved: result.unresolved,
      status: result.status,
      canonicalWrites: false
    },
    null,
    2
  )}\n`
)
if (result.status !== "validated") {
  process.exitCode = 1
}
