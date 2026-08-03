import { execFile, type ExecFileOptions, spawn, type SpawnOptions } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { ADMIN_API_VERSION, type AdminClient, extractErrors, hasData } from "./client.ts"
import { storeHandle } from "./config.ts"

/*
 * The Shopify CLI as the transport.
 *
 * `shopify store auth` opens the browser once and keeps a short-lived online token itself, so
 * nobody has to create a custom app and paste a permanent key to the whole order history. The price
 * is that it never hands that token over, which is why every query here is a subprocess rather than
 * a fetch. Setup happens once; a query costs a second or two, and only when a preview asks for one.
 */

const run = promisify(execFile)

/** npm installs the CLI as a `.cmd` shim on Windows, which only resolves through a shell. */
const useShell = process.platform === "win32"

/*
 * A shell concatenates an argument list rather than escaping it, which Node deprecated in DEP0190
 * and is right to. So the command line is these fixed words and nothing else; every value a caller
 * supplies travels in the environment, where no shell can read it as syntax.
 */
const commandLine = (args: readonly string[]): string => `shopify ${args.join(" ")}`

const INSTALL = "Install it with `npm install -g @shopify/cli`."

/** The scopes a template needs. Reading is the whole job bar `upload`, which hosts an image. */
export const SCOPES = [
  "read_orders",
  "read_customers",
  "read_products",
  "read_legal_policies",
  "read_merchant_managed_fulfillment_orders",
  "read_third_party_fulfillment_orders",
  "read_assigned_fulfillment_orders",
  "read_returns",
  "read_payment_terms",
  "read_companies",
  "read_gift_cards",
  "read_store_credit_accounts",
  "read_store_credit_account_transactions",
  "read_files",
  "write_files"
].join(",")

type Flags = Readonly<Record<string, string>>

const stringField = (error: unknown, field: string): string =>
  typeof error === "object" && error !== null && field in error
    ? String((error as Record<string, unknown>)[field]).trim()
    : ""

const missingCli = (error: unknown): boolean =>
  stringField(error, "code") === "ENOENT" || /not recognized|command not found/i.test(stringField(error, "stderr"))

/* A grant only covers the scopes it was asked for, so widening this package's list strands the old one. */
const deniedField = (detail: string): string => /Access denied for (\w+) field/.exec(detail)?.[1] ?? ""

const explain = (error: unknown, args: readonly string[]): Error => {
  if (missingCli(error)) {
    return new Error(`The \`shopify\` command was not found. ${INSTALL}`)
  }
  const detail = stringField(error, "stderr") || stringField(error, "message")
  const denied = deniedField(detail)
  if (denied) {
    return new Error(
      `The store has not authorised everything this reads — \`${denied}\` was refused. Run login again to grant the scopes added since you signed in.`
    )
  }
  return new Error(`\`shopify ${args.join(" ")}\` failed.${detail ? `\n${detail}` : ""}`)
}

/*
 * Values travel as SHOPIFY_FLAG_* rather than arguments. A GraphQL query is full of quotes and
 * braces, and on Windows every argument would otherwise have to survive a shell on the way through.
 */
const shopify = async (args: readonly string[], flags: Flags): Promise<void> => {
  const options: ExecFileOptions = {
    env: { ...process.env, SHOPIFY_FLAG_NO_COLOR: "1", ...flags },
    maxBuffer: 64 * 1024 * 1024
  }

  try {
    await (useShell ? run(commandLine(args), { ...options, shell: true }) : run("shopify", [...args], options))
  } catch (error) {
    throw explain(error, args)
  }
}

/** The browser hand-off narrates itself, so this one keeps the terminal instead of capturing it. */
export const authenticateStore = (store: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const args = ["store", "auth"]
    const options: SpawnOptions = {
      env: { ...process.env, SHOPIFY_FLAG_SCOPES: SCOPES, SHOPIFY_FLAG_STORE: store },
      stdio: "inherit"
    }
    const child = useShell ? spawn(commandLine(args), { ...options, shell: true }) : spawn("shopify", args, options)

    child.on("error", (error) => reject(explain(error, args)))
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Authorising ${storeHandle(store)} did not finish. Run login again to retry.`))
    )
  })

/*
 * Results come back through a file rather than stdout, because the CLI also writes progress there
 * and a banner in front of the JSON would only be parsed off again.
 */
export const createCliClient =
  (store: string): AdminClient =>
  async ({ query, variables, schema }) => {
    const directory = await mkdtemp(join(tmpdir(), "shopify-emails-"))
    const output = join(directory, "result.json")

    try {
      await shopify(["store", "execute"], {
        SHOPIFY_FLAG_JSON: "1",
        SHOPIFY_FLAG_OUTPUT_FILE: output,
        SHOPIFY_FLAG_QUERY: query,
        SHOPIFY_FLAG_STORE: store,
        SHOPIFY_FLAG_VARIABLES: JSON.stringify(variables ?? {}),
        SHOPIFY_FLAG_VERSION: ADMIN_API_VERSION,
        /* The CLI refuses to write unless a caller says so per run, and `upload` is the only one that does. */
        ...(/^\s*mutation\b/.test(query.trim()) && { SHOPIFY_FLAG_ALLOW_MUTATIONS: "1" })
      })

      const body: unknown = JSON.parse(await readFile(output, "utf8"))
      const errors = extractErrors(body)
      if (errors) {
        throw new Error(`${store} rejected the query: ${errors}`)
      }
      /* The CLI unwraps `data` for a successful run, but says so itself when a query only half works. */
      return schema.parse(hasData(body) ? body.data : body)
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  }
