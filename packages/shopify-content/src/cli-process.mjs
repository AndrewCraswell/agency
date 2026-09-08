import { pathToFileURL } from "node:url"

const bootstrap = process.argv.splice(2, 1)[0]
if (!bootstrap) {
  process.stderr.write("Missing Shopify CLI bootstrap path.\n")
  process.exit(1)
}

try {
  const { default: runCli } = await import(pathToFileURL(bootstrap).href)
  await runCli({ development: false })
  process.exit(process.exitCode ?? 0)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}
