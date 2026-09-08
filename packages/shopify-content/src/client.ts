import { execFile, type ExecFileOptions } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { z } from "zod"

export type AdminClient = (query: string, variables?: Record<string, unknown>, mutation?: boolean) => Promise<unknown>
export type CommandRunner = (file: string, args: string[], options: ExecFileOptions) => Promise<unknown>
export const storeSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/)
const run = promisify(execFile)
const envelope = z
  .object({ data: z.unknown().optional(), errors: z.array(z.object({ message: z.string() })).optional() })
  .passthrough()

export function unwrapResponse(input: unknown) {
  const parsed = envelope.parse(input)
  if (parsed.errors?.length) {
    throw new Error(parsed.errors.map((error) => error.message).join("; "))
  }
  return parsed.data ?? input
}

export function createCliClient(store: string, allowMutations = false, execute: CommandRunner = run): AdminClient {
  storeSchema.parse(store)
  const require = createRequire(import.meta.url)
  const bootstrap = join(dirname(require.resolve("@shopify/cli/package.json")), "dist", "bootstrap.js")
  const launcher = fileURLToPath(new URL("./cli-process.mjs", import.meta.url))
  return async (query, variables = {}, mutation = false) => {
    if (mutation && !allowMutations) {
      throw new Error("Mutations are disabled while planning.")
    }
    if (!/^\s*(query|mutation)\b/.test(query) || /^\s*mutation\b/.test(query) !== mutation) {
      throw new Error("The GraphQL operation does not match its declared read/write mode.")
    }
    const directory = await mkdtemp(join(tmpdir(), "shopify-content-"))
    const queryPath = join(directory, "query.graphql")
    const variablesPath = join(directory, "variables.json")
    const output = join(directory, "result.json")
    try {
      await writeFile(queryPath, query, { mode: 0o600 })
      await writeFile(variablesPath, JSON.stringify(variables), { mode: 0o600 })
      const args = [
        launcher,
        bootstrap,
        "store",
        "execute",
        "--store",
        store,
        "--version",
        "2026-07",
        "--json",
        "--query-file",
        queryPath,
        "--variable-file",
        variablesPath,
        "--output-file",
        output
      ]
      if (mutation) {
        args.push("--allow-mutations")
      }
      const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("SHOPIFY_FLAG_")))
      await execute(process.execPath, args, {
        env,
        maxBuffer: 8 * 1024 * 1024,
        timeout: 120_000,
        killSignal: "SIGKILL",
        windowsHide: true
      })
      const response: unknown = JSON.parse(await readFile(output, "utf8"))
      return unwrapResponse(response)
    } catch (error) {
      throw new Error(
        `Shopify request failed for ${store}. Check CLI authentication and scopes; plan again before retrying writes.`,
        { cause: error }
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
}
