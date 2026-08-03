import { note, select, text } from "@clack/prompts"
import pc from "picocolors"
import {
  forgetStore,
  listStores,
  parseStoreDomain,
  rememberStore,
  setActiveStore,
  storeHandle,
  type StoreList
} from "./config.ts"
import { connectToStore } from "./connect.ts"
import { shopResponse } from "./mapOrder.ts"
import { SHOP_QUERY } from "./queries.ts"
import { authenticateStore } from "./shopifyCli.ts"
import type { ShopSummary } from "./store.ts"

/*
 * Which store, and may we read it — the question the `login` command and the wizard both ask.
 *
 * There is no credential to collect. `shopify store auth` runs the browser sign-in and keeps the
 * short-lived token itself, so nobody has to create a custom app, and no permanent key to a store's
 * order history is ever written to this machine by us.
 */

/** A prompt needs a terminal, so a scripted run has to name the store it means. */
export const requireTty = (command: string): void => {
  if (!process.stdin.isTTY) {
    throw new Error(`${command} needs --store <handle> when there is no terminal to prompt in.`)
  }
}

/* Ctrl-C is a decision, not a failure, so callers can tell it apart and bow out quietly. */
export const CANCELLED = new Error("Cancelled. Nothing was changed.")

export const answered = <Value>(value: Value | symbol): Value => {
  if (typeof value === "symbol") {
    throw CANCELLED
  }
  return value
}

const validateDomain = (value: string | undefined): string | undefined => {
  try {
    parseStoreDomain(value ?? "")
    return undefined
  } catch (error) {
    return error instanceof Error ? error.message : "That is not a store handle"
  }
}

/* Nobody thinks of their store by its handle, so the question has to say where to find one. */
const WHERE_TO_LOOK = `Open your store's admin and read the address bar:

  admin.shopify.com/store/8f3f5f-3

The last part is the handle. Pasting the whole URL, or a myshopify.com domain, works too.`

export const askDomain = async (): Promise<string> => {
  note(WHERE_TO_LOOK, "Which store?")
  return parseStoreDomain(
    answered(await text({ message: "Store handle", placeholder: "8f3f5f-3", validate: validateDomain }))
  )
}

/** Proving the grant works now beats a confusing failure the first time a preview loads an order. */
export const readShop = async (domain: string): Promise<ShopSummary> => {
  const { client } = await connectToStore(domain)
  const { shop } = await client({ query: SHOP_QUERY, schema: shopResponse })
  return shop
}

export const ADD_STORE = "add-store"

const storeOptions = ({ active, stores }: StoreList) =>
  stores.map((domain) => ({ hint: domain === active ? pc.dim("current") : undefined, label: domain, value: domain }))

export const chooseStore = async (
  message: string,
  known: StoreList,
  extra: readonly { label: string; value: string }[] = []
) => answered(await select({ initialValue: known.active, message, options: [...storeOptions(known), ...extra] }))

const addStore = async (domain: string): Promise<void> => {
  await authenticateStore(domain)
  const { name } = await readShop(domain)
  await rememberStore(domain)
  process.stdout.write(`Set up ${name} (${domain})\n`)
}

/*
 * One command for both halves of the same question: which store, and may we read it.
 *
 * A chosen store is written down rather than inferred from whichever was set up first, so a second
 * store does not silently change what every other command reads.
 */
export const login = async (store?: string): Promise<void> => {
  if (store) {
    await addStore(parseStoreDomain(store))
    return
  }
  requireTty("login")

  const known = await listStores()
  if (known.stores.length === 0) {
    await addStore(await askDomain())
    return
  }

  const chosen = await chooseStore("Which store?", known, [{ label: "Add another store…", value: ADD_STORE }])
  if (chosen === ADD_STORE) {
    await addStore(await askDomain())
    return
  }

  const { name } = await readShop(chosen)
  await setActiveStore(chosen)
  process.stdout.write(`Using ${name} (${chosen})\n`)
}

/* Only this package's choice of store is dropped: the grant belongs to the Shopify CLI, not to us. */
const revokeNote = (domain: string): string =>
  `To revoke the authorisation as well, run \`shopify auth logout\`.\nTo set ${storeHandle(domain)} up again later, run \`login --store ${storeHandle(domain)}\`.\n`

export const logout = async (store?: string): Promise<void> => {
  if (store) {
    const domain = await forgetStore(store)
    process.stdout.write(`Forgot ${domain}\n${revokeNote(domain)}`)
    return
  }
  requireTty("logout")

  const known = await listStores()
  if (known.stores.length === 0) {
    throw new Error("No store is set up.")
  }
  const domain = await forgetStore(await chooseStore("Forget which store?", known))
  process.stdout.write(`Forgot ${domain}\n${revokeNote(domain)}`)
}
