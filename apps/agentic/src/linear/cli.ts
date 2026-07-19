import { createLinearClientFromEnvironment } from "./client"

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) {
    return undefined
  }
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`)
  }
  return value
}

const command = process.argv[2]
const client = createLinearClientFromEnvironment(process.env, argument("--team"))

if (command === "fetch") {
  const limitValue = argument("--limit")
  const result = await client.listCandidates(limitValue === undefined ? undefined : Number(limitValue))
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else if (command === "seed") {
  const result = await client.seedCandidates()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else {
  throw new Error(
    "Usage: pnpm linear:tasks fetch --team <key-or-id> [--limit 1|2|3] | pnpm linear:tasks seed --team <key-or-id>"
  )
}
