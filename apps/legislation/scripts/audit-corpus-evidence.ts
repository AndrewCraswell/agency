import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { createCorpusEvidenceAudit, verifyEvidenceArtifactFiles } from "../src/validation/corpus-evidence.js"

interface Arguments {
  input: string
  output?: string
}

function parseArguments(values: readonly string[]): Arguments {
  let input: string | undefined
  let output: string | undefined

  for (let index = 0; index < values.length; index += 1) {
    const argument = values[index]
    const next = values[index + 1]
    if (argument === "--input" && next !== undefined) {
      input = next
      index += 1
      continue
    }
    if (argument === "--output" && next !== undefined) {
      output = next
      index += 1
      continue
    }
    throw new Error(`unknown or incomplete argument: ${argument ?? ""}`)
  }

  if (input === undefined) {
    throw new Error("usage: audit-corpus-evidence --input <manifest.json> [--output <audit.json>]")
  }
  return { input, output }
}

async function main(): Promise<void> {
  const arguments_ = parseArguments(process.argv.slice(2))
  const inputPath = resolve(arguments_.input)
  const input = JSON.parse(await readFile(inputPath, "utf8")) as unknown
  const artifactVerification = await verifyEvidenceArtifactFiles(input, dirname(inputPath))
  const audit = createCorpusEvidenceAudit(input, artifactVerification)
  const output = `${JSON.stringify(audit, undefined, 2)}\n`

  if (arguments_.output === undefined) {
    process.stdout.write(output)
  } else {
    const outputPath = resolve(arguments_.output)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, output, "utf8")
    process.stdout.write(`${JSON.stringify({ output: outputPath, ready: audit.ready })}\n`)
  }
  if (!audit.ready) {
    process.exitCode = 1
  }
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown corpus evidence audit failure"
  process.stderr.write(`${JSON.stringify({ error: message })}\n`)
  process.exitCode = 1
})
