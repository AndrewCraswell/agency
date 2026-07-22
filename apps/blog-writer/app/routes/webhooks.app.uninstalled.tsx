import type { ActionFunctionArgs } from "react-router"
import { authenticate, sessionStorage } from "../shopify.server"

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.webhook(request)

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await sessionStorage.deleteSession(session.id)
  }

  return new Response()
}
