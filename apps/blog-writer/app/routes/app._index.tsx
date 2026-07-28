import { boundary } from "@shopify/shopify-app-react-router/server"
import type { HeadersFunction, LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router"
import { HomeDashboard } from "../components/HomeDashboard"
import { getHomeOverview } from "../persistence/home-overview-repository.server"
import { getShopifySyncStatus } from "../persistence/shopify-sync-repository.server"
import { getSourceSettings } from "../persistence/source-settings-repository.server"
import { authenticate } from "../shopify.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const [status, overview, sources] = await Promise.all([
    getShopifySyncStatus(session.shop),
    getHomeOverview(session.shop),
    getSourceSettings(session.shop)
  ])

  return {
    syncStatus: status.syncStatus,
    activeResourceCount: status.activeResourceCount,
    lastSynchronizedAt: status.lastSynchronizedAt?.toISOString() ?? null,
    subscribedSourceCount: sources.subscribedBlogs.length,
    overview
  }
}

export default function Index() {
  const loaderData = useLoaderData<typeof loader>()

  return <HomeDashboard {...loaderData} />
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs)
}
