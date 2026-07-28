import { boundary } from "@shopify/shopify-app-react-router/server"
import { useLoaderData } from "react-router"
import type { HeadersFunction, LoaderFunctionArgs } from "react-router"
import { ArticlesPage } from "../components/ArticlesPage"
import { listArticles } from "../persistence/blog-workspace-repository.server"
import { authenticate } from "../shopify.server"

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  return { articles: await listArticles(session.shop) }
}

export default function Articles() {
  const loaderData = useLoaderData<typeof loader>()
  return <ArticlesPage {...loaderData} />
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs)
}
