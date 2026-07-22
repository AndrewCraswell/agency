import type { LoaderFunctionArgs } from "react-router"
import { AppHome } from "../components/AppHome"
import { authenticate } from "../shopify.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  return null
}

export default function Index() {
  return <AppHome />
}
