import type { AdminClient } from "./client.ts"
import { createTokenClient } from "./client.ts"
import { resolveStore } from "./config.ts"
import { createCliClient } from "./shopifyCli.ts"

export type StoreConnection = {
  readonly domain: string
  readonly client: AdminClient
}

/** A token in the environment wins, so CI never has to open a browser to read one order. */
export const connectToStore = async (store?: string): Promise<StoreConnection> => {
  const domain = await resolveStore(store)
  const token = process.env.SHOPIFY_ADMIN_TOKEN
  return { client: token ? createTokenClient({ store: domain, token }) : createCliClient(domain), domain }
}
