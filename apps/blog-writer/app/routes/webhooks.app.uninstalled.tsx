import type { ActionFunctionArgs } from "react-router"
import { deleteShopSessions } from "../session-storage.server"
import { authenticate, sessionStorage } from "../shopify.server"

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.webhook(request)

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  if (session) {
    await deleteShopSessions(sessionStorage, session.shop)
  }

  return new Response()
}
