import type { ActionFunctionArgs } from "react-router"
import { authenticate, sessionStorage } from "../shopify.server"

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session } = await authenticate.webhook(request)

  if (session && Array.isArray(payload.current)) {
    session.scope = payload.current.join(",")
    await sessionStorage.storeSession(session)
  }

  return new Response()
}
