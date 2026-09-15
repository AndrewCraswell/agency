import { createHash, randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { z } from "zod"
import { inventoryCommitteeHistory } from "../src/ingestion/openstates/committee-history.js"

const revision = z
  .string()
  .regex(/^[a-f0-9]{40}$/)
  .parse(process.argv[2])
const output = resolve("artifacts/openstates-committee-history", `${Date.now()}-${randomUUID()}`)
await mkdir(output, { recursive: true })
const deadline = AbortSignal.timeout(600000)
async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.any([deadline, AbortSignal.timeout(30000)]) })
  if (!response.ok) {
    throw new Error(`Source HTTP ${response.status}`)
  }
  return response.text()
}
const artifacts = []
try {
  const rawCommit = await download(`https://api.github.com/repos/openstates/people/commits/${revision}`)
  const commit = z
    .object({ sha: z.literal(revision), commit: z.object({ committer: z.object({ date: z.iso.datetime() }) }) })
    .parse(JSON.parse(rawCommit))
  await writeFile(resolve(output, "commit.json"), rawCommit, { flag: "wx" })
  const rawTree = await download(`https://api.github.com/repos/openstates/people/git/trees/${revision}?recursive=1`)
  const tree = z
    .object({
      sha: z.literal(revision),
      truncated: z.literal(false),
      tree: z.array(z.object({ path: z.string(), type: z.string() }))
    })
    .parse(JSON.parse(rawTree))
  await writeFile(resolve(output, "tree.json"), rawTree, { flag: "wx" })
  const paths = tree.tree
    .filter((entry) => entry.type === "blob" && /^data\/nc\/committees\/[^/\\]+\.ya?ml$/.test(entry.path))
    .map((entry) => entry.path)
  if (paths.length === 0 || paths.length > 2000) {
    throw new Error("Unexpected committee file count")
  }
  const files = []
  for (const path of paths) {
    const content = await download(`https://raw.githubusercontent.com/openstates/people/${revision}/${path}`)
    const target = resolve(output, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, { flag: "wx" })
    artifacts.push({
      path,
      bytes: Buffer.byteLength(content),
      sha256: createHash("sha256").update(content).digest("hex")
    })
    files.push({ path, content })
  }
  const result = inventoryCommitteeHistory(files, revision, commit.commit.committer.date)
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ revision, retrievedAt: new Date(), artifacts, ...result }, null, 2),
    { flag: "wx" }
  )
  process.stdout.write(
    `${JSON.stringify({ output, committees: result.committees, memberships: result.memberships, unresolved: result.unresolved.length, canonicalWrites: false })}\n`
  )
} catch (error) {
  await writeFile(resolve(output, "failure.json"), JSON.stringify({ revision, artifacts, canonicalWrites: false }), {
    flag: "wx"
  })
  throw error
}
