import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const packageDirectory = join(dirname(fileURLToPath(import.meta.url)), "..")
const packageRequire = createRequire(join(packageDirectory, "package.json"))
const nextCliPath = packageRequire.resolve("next/dist/bin/next")
const child = spawnSync(process.execPath, [nextCliPath, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit"
})

if (child.error !== undefined) {
  throw child.error
}

process.exitCode = child.status ?? 1
