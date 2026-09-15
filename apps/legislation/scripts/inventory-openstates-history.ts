import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { z } from "zod"
import { inventoryPeopleHistory } from "../src/ingestion/openstates/people-history.js"
import { peopleSourceProfiles, type PeopleRepositoryFile } from "../src/ingestion/openstates/people-repository.js"

const state = z.enum(["nc", "ak"]).parse(process.argv[2] ?? "nc")
const source = peopleSourceProfiles[state]
const output = resolve("artifacts", "openstates-history", `${Date.now()}-${crypto.randomUUID()}`)
await mkdir(output, { recursive: true })
const deadline = AbortSignal.timeout(10 * 60_000)
async function download(url: string) {
  const response = await fetch(url, { signal: AbortSignal.any([deadline, AbortSignal.timeout(30_000)]) })
  if (!response.ok) {
    throw new Error(`Source HTTP ${response.status}`)
  }
  return response.text()
}
const files: PeopleRepositoryFile[] = []
const artifacts = []
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
        entry.type === "blob" &&
        new RegExp(`^data/${state}/(retired|executive|municipalities)/[^/\\\\]+\\.ya?ml$`).test(entry.path)
    )
    .map((entry) => entry.path)
    .sort()
  if (paths.length === 0 || paths.length > 2_000) {
    throw new Error("Unexpected historical file count")
  }
  for (const path of paths) {
    const content = await download(`https://raw.githubusercontent.com/openstates/people/${source.revision}/${path}`)
    const target = resolve(output, path)
    await mkdir(resolve(target, ".."), { recursive: true })
    await writeFile(target, content, { flag: "wx" })
    files.push({ path, content })
    artifacts.push({
      path,
      bytes: Buffer.byteLength(content),
      sha256: createHash("sha256").update(content).digest("hex")
    })
  }
  const result = inventoryPeopleHistory(files, state)
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ ...source, retrievedAt: new Date(), artifacts, ...result }, null, 2),
    { flag: "wx" }
  )
  const { sourceRoles: _roles, ...summary } = result
  process.stdout.write(`${JSON.stringify({ output, ...summary })}\n`)
  if (result.status !== "inventoried") {
    process.exitCode = 1
  }
} catch (error) {
  await writeFile(
    resolve(output, "failure.json"),
    JSON.stringify({ ...source, artifacts, status: "failed", canonicalWrites: false }),
    { flag: "wx" }
  )
  throw error
}
