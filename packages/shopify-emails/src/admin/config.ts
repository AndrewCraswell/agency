import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { z } from "zod"

/*
 * Which store the commands read, and nothing else.
 *
 * There is no secret here. `shopify store auth` holds the access token and never hands it over, so
 * all this file remembers is a list of store handles and which one was picked last.
 */

/** The handle is the only part that differs between stores, so it is the only part worth typing. */
const STORE_HANDLE = /^[a-z0-9][a-z0-9-]*$/

/*
 * Whittles whatever a merchant has to hand down to the handle, then rebuilds the one host a query
 * may be sent to. The wrapping is negotiable — a browser URL, the myshopify suffix, mixed case — but
 * anything still carrying a dot, a port, or credentials after that is not this store and is refused.
 */
export const parseStoreDomain = (value: string): string => {
  const handle = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^admin\.shopify\.com\/store\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.myshopify\.com$/, "")

  if (!STORE_HANDLE.test(handle)) {
    throw new Error(`"${value}" is not a store handle. Enter the handle from the admin URL, like 8f3f5f-3.`)
  }
  return `${handle}.myshopify.com`
}

/** The handle a person recognises, for messages that would otherwise repeat the suffix back at them. */
export const storeHandle = (domain: string): string => domain.replace(/\.myshopify\.com$/, "")

const appDir = (): string => {
  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "shopify-emails")
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "shopify-emails")
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "shopify-emails")
}

export const configPath = join(appDir(), "config.json")

const configFile = z.object({ active: z.string().optional(), stores: z.array(z.string()).default([]) })

type ConfigFile = z.infer<typeof configFile>

export type StoreList = {
  /** The store a command uses when none is named, absent only when nothing has been selected. */
  readonly active?: string
  readonly stores: readonly string[]
}

const readConfig = async (): Promise<ConfigFile> => {
  try {
    return configFile.parse(JSON.parse(await readFile(configPath, "utf8")))
  } catch {
    return { active: undefined, stores: [] }
  }
}

const writeConfig = async (file: ConfigFile): Promise<void> => {
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(file, null, 2)}\n`, "utf8")
}

/** Selecting a store is a statement of which one to work on, so it also becomes the active one. */
export const rememberStore = async (store: string): Promise<string> => {
  const domain = parseStoreDomain(store)
  const { stores } = await readConfig()
  await writeConfig({ active: domain, stores: [...stores.filter((name) => name !== domain), domain] })
  return domain
}

export const listStores = async (): Promise<StoreList> => {
  const { active, stores } = await readConfig()
  return { active: active && stores.includes(active) ? active : stores[0], stores }
}

export const setActiveStore = async (store: string): Promise<string> => {
  const domain = parseStoreDomain(store)
  const file = await readConfig()
  if (!file.stores.includes(domain)) {
    throw new Error(`${domain} has not been set up. Run \`login --store ${storeHandle(domain)}\` first.`)
  }
  await writeConfig({ ...file, active: domain })
  return domain
}

export const forgetStore = async (store: string): Promise<string> => {
  const domain = parseStoreDomain(store)
  const file = await readConfig()
  if (!file.stores.includes(domain)) {
    throw new Error(`${domain} has not been set up.`)
  }
  const stores = file.stores.filter((name) => name !== domain)
  await writeConfig({ active: file.active === domain ? stores[0] : file.active, stores })
  return domain
}

/** Environment first, so CI can name a store without a config file or a browser. */
export const resolveStore = async (store?: string): Promise<string> => {
  const named = store ?? process.env.SHOPIFY_STORE
  if (named) {
    return parseStoreDomain(named)
  }
  const { active } = await listStores()
  if (!active) {
    throw new Error("No store is set up. Run `login` first.")
  }
  return active
}
