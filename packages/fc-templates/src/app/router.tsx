import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router"
import { fetchPreview, fetchTemplates } from "./api.ts"
import { IndexPage } from "./routes/IndexPage.tsx"
import { NotFoundPage } from "./routes/NotFoundPage.tsx"
import { ViewerPage } from "./routes/ViewerPage.tsx"

const rootRoute = createRootRoute({ notFoundComponent: NotFoundPage })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: () => fetchTemplates(),
  component: IndexPage
})

const viewerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/render/$templateId/$variationId",
  loader: ({ params }) => fetchPreview(params.templateId, params.variationId),
  component: ViewerPage
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, viewerRoute]),
  defaultPreload: "intent",
  // Every loader reads a template off disk, so a preview always reflects the file as it is now.
  defaultStaleTime: 0
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
