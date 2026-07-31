import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { z } from "zod"

/*
 * Where the Admin API token lives.
 *
 * The token is a bearer credential for a merchant's whole order and customer history, so it is kept
 * out of the repository entirely: no dotenv file to accidentally commit, no argument that lands in
 * shell history. It sits in the OS config directory, readable only by its owner, and is only ever
 * read back to open a store source for the preview.
 */

/** Only real shop domains. The token is sent as a header, so the host it goes to is not negotiable. */
const STORE_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/

/** Accepts what a merchant is likely to paste — a URL, a trailing slash, mixed case — or refuses. */
export const parseStoreDomain = (value: string): string => {
  const store = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")

  if (!STORE_DOMAIN.test(store)) {
    throw new Error(`"${value}" is not a myshopify.com store domain`)
  }
  return store
}

const appDir = (): string => {
  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "shopify-emails")
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "shopify-emails")
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "shopify-emails")
}

export const credentialsPath = join(appDir(), "credentials.json")

const credentialsFile = z.record(z.string(), z.string())

export type StoreCredentials = {
  store: string
  token: string
}

const readFileTokens = async (): Promise<Record<string, string>> => {
  try {
    return credentialsFile.parse(JSON.parse(await readFile(credentialsPath, "utf8")))
  } catch {
    return {}
  }
}

/** Owner-only, and created that way rather than fixed afterwards. Windows ignores the mode. */
export const saveToken = async (store: string, token: string): Promise<void> => {
  const domain = parseStoreDomain(store)
  await mkdir(dirname(credentialsPath), { recursive: true, mode: 0o700 })
  const tokens = { ...(await readFileTokens()), [domain]: token.trim() }
  await writeFile(credentialsPath, `${JSON.stringify(tokens, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
  await chmod(credentialsPath, 0o600).catch(() => undefined)
}

/** Environment first, so CI can run without a login and without writing a token to disk. */
export const resolveCredentials = async (store?: string): Promise<StoreCredentials> => {
  const envStore = process.env.SHOPIFY_STORE
  const envToken = process.env.SHOPIFY_ADMIN_TOKEN
  if (envStore && envToken) {
    return { store: parseStoreDomain(envStore), token: envToken }
  }

  const tokens = await readFileTokens()
  const domain = store ? parseStoreDomain(store) : Object.keys(tokens)[0]
  if (!domain) {
    throw new Error("No store is logged in. Run `login --store <shop>.myshopify.com` first.")
  }

  const token = tokens[domain]
  if (!token) {
    throw new Error(`No token stored for ${domain}. Run \`login --store ${domain}\` first.`)
  }
  return { store: domain, token }
}
