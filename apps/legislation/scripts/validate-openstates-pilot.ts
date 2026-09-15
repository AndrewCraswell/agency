import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { z } from "zod"
import {
  peopleSourceProfiles,
  validatePeopleRepositorySnapshot,
  type PeopleRepositoryFile
} from "../src/ingestion/openstates/people-repository.js"

// Deliberately has no database client, credentials, or promotion mode.
const state = z.enum(["nc", "ak"]).parse(process.argv[2] ?? "nc")
const source = peopleSourceProfiles[state]
const output = resolve("artifacts", "openstates-pilot", `${Date.now()}-${crypto.randomUUID()}`)
await mkdir(output, { recursive: true })
const deadline = AbortSignal.timeout(10 * 60_000)
async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.any([deadline, AbortSignal.timeout(30_000)]) })
  if (!response.ok) {
    throw new Error(`Source HTTP ${response.status}`)
  }
  const text = await response.text()
  if (text.length > 20_000_000) {
    throw new Error("Source response exceeds pilot limit")
  }
  return text
}
const files: PeopleRepositoryFile[] = []
const artifacts: Array<{ path: string; sha256: string; bytes: number }> = []
try {
  const rawTree = await download(
    `https://api.github.com/repos/openstates/people/git/trees/${source.revision}?recursive=1`
  )
  await writeFile(resolve(output, "tree.json"), rawTree, { flag: "wx" })
  const tree = z
    .object({
      sha: z.literal(source.revision),
      truncated: z.literal(false),
      tree: z.array(z.object({ path: z.string(), type: z.string() }))
    })
    .parse(JSON.parse(rawTree))
  const paths = tree.tree
    .filter(
      (entry) =>
        entry.type === "blob" && new RegExp(`^data/${state}/(legislature|committees)/[^/]+\\.ya?ml$`).test(entry.path)
    )
    .map((entry) => entry.path)
    .sort()
  if (paths.length === 0 || paths.length > 2_000) {
    throw new Error("Unexpected source file count")
  }
  // Sequential requests keep the first pilot gentle on the publisher.
  for (const path of paths) {
    const content = await download(`https://raw.githubusercontent.com/openstates/people/${source.revision}/${path}`)
    const target = resolve(output, path)
    await mkdir(resolve(target, ".."), { recursive: true })
    await writeFile(target, content, { flag: "wx" })
    files.push({ content, path })
    artifacts.push({
      bytes: Buffer.byteLength(content),
      path,
      sha256: createHash("sha256").update(content).digest("hex")
    })
  }
  const retrievedAt = new Date()
  const result = validatePeopleRepositorySnapshot(files, retrievedAt, state)
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      {
        ...source,
        artifacts,
        counts: result.counts,
        coverageIssues: result.coverageIssues,
        expectedFiles: paths.length,
        retrievedAt,
        status: result.status,
        unresolved: result.unresolved,
        canonicalWrites: false
      },
      null,
      2
    ),
    { flag: "wx" }
  )
  if (result.snapshot !== null) {
    await writeFile(resolve(output, "normalized.json"), JSON.stringify(result.snapshot), { flag: "wx" })
  }
  process.stdout.write(
    `${JSON.stringify({ counts: result.counts, coverageIssues: result.coverageIssues, output, status: result.status, unresolved: result.unresolved.length })}\n`
  )
  if (result.status !== "validated") {
    process.exitCode = 1
  }
} catch (error) {
  await writeFile(
    resolve(output, "failure.json"),
    JSON.stringify({
      ...source,
      downloadedFiles: files.length,
      artifacts,
      status: "failed",
      canonicalWrites: false
    }),
    { flag: "wx" }
  )
  process.stderr.write(`Pilot failed; retained evidence: ${output}\n`)
  throw error
}
