import type { ActionFunctionArgs } from "react-router"
import { authenticate, sessionStorage } from "../shopify.server"

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.webhook(request)

  if (session) {
    await sessionStorage.deleteSession(session.id)
  }

  return new Response()
}
