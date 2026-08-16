import { cp, mkdir, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const applicationRoot = fileURLToPath(new URL("../", import.meta.url))
const source = fileURLToPath(new URL("../src/db/migrations/", import.meta.url))
const destination = fileURLToPath(new URL("../dist/db/migrations/", import.meta.url))

if (!destination.startsWith(applicationRoot)) {
  throw new Error("Migration destination must remain inside apps/legislation")
}

await rm(destination, { force: true, recursive: true })
await mkdir(destination, { recursive: true })
await cp(source, destination, { recursive: true })
