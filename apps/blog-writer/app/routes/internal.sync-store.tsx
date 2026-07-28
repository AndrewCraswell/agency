import { timingSafeEqual } from "node:crypto"
import { data } from "react-router"
import type { ActionFunctionArgs } from "react-router"
import { z } from "zod"
import { synchronizeShopifyStore } from "../shopify-sync/synchronize.server"
import { unauthenticated } from "../shopify.server"

// Narrow on purpose. Whatever arrives here is used to build a Shopify address and to look up an access token, so it
// is held to the only shape a real store can have rather than trusted because the caller knew the secret.
const RequestSchema = z.object({
  shop_domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/)
})

/**
 * Whether the caller holds the shared secret, without saying how nearly they got it.
 *
 * A plain equality check returns as soon as two bytes differ, which measures out the secret one character at a time
 * to anyone willing to time the answer. Lengths are compared first because the constant-time comparison needs equal
 * buffers, and a length is not worth protecting.
 */
function isAuthorized(request: Request) {
  const expected = process.env.INTERNAL_TASK_TOKEN
  // An unset secret refuses everyone rather than admitting everyone. A deployment that forgets to configure this
  // should lose its scheduled sync, not open the endpoint to the internet.
  if (expected === undefined || expected.length === 0) {
    return false
  }

  const offered = request.headers.get("Authorization")?.replace(/^Bearer /, "")
  if (offered === undefined || offered === null) {
    return false
  }

  const offeredBytes = Buffer.from(offered)
  const expectedBytes = Buffer.from(expected)
  if (offeredBytes.length !== expectedBytes.length) {
    return false
  }
  return timingSafeEqual(offeredBytes, expectedBytes)
}

/**
 * Nothing to see for anyone who arrives here with a browser.
 */
export const loader = () => new Response(null, { status: 404 })

/**
 * Reads one store's catalogue on behalf of the workflow that orchestrates syncing.
 *
 * The Shopify read and the writes it produces are code, and the store's offline token lives here, so this is the one
 * step the workflow cannot perform itself. Everything around it — which stores, in what order, how often, what
 * happens next — belongs to the workflow, which is why this takes a single shop and reports what it did rather than
 * deciding anything.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 })
  }
  if (!isAuthorized(request)) {
    // Deliberately says nothing about which part was wrong.
    return new Response(null, { status: 401 })
  }

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return data({ message: "Expected a shop_domain" }, { status: 400 })
  }
  const shopDomain = parsed.data.shop_domain

  // Asked for before anything is written, so a shop the app was never installed on leaves no trace behind. A store
  // whose token has been revoked fails here too, which is the same answer for the same reason.
  const { admin } = await unauthenticated.admin(shopDomain)
  const snapshot = await synchronizeShopifyStore(shopDomain, (query, options) => admin.graphql(query, options))

  return {
    shop_domain: shopDomain,
    tenant_id: snapshot.tenantId,
    resource_count: snapshot.resources.length
  }
}
