import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router"
import { App } from "./App"
import { RootLayout } from "./routes/RootLayout"

const rootRoute = createRootRoute({ component: RootLayout })

// The home route is the initial paint, so it's bundled eagerly. Other routes are
// code-split with `lazyRouteComponent` — each becomes its own chunk that is only
// fetched when needed. Combined with `defaultPreload: "intent"` below, hovering
// or focusing a <Link> to one of them prefetches its chunk, so the navigation
// itself is instant.
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: App })
const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: lazyRouteComponent(() => import("./routes/AboutPage"), "AboutPage")
})
const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contact",
  component: lazyRouteComponent(() => import("./routes/ContactPage"), "ContactPage")
})
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: lazyRouteComponent(() => import("./routes/SettingsPage"), "SettingsPage")
})
const workflowsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workflows",
  component: lazyRouteComponent(() => import("./routes/WorkflowsPage"), "WorkflowsPage")
})
const workflowEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workflows/$workflowId",
  component: lazyRouteComponent(() => import("./routes/WorkflowEditorPage"), "WorkflowEditorPage")
})
const runDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/runs/$runId",
  component: lazyRouteComponent(() => import("./routes/RunDetailPage"), "RunDetailPage")
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  contactRoute,
  settingsRoute,
  workflowsRoute,
  workflowEditorRoute,
  runDetailRoute
])

export const router = createRouter({
  routeTree,
  // Preload a route's code + loader data when the user shows intent (hovers or
  // focuses a <Link>, or touchstart on mobile). Override per-link with `preload`.
  defaultPreload: "intent",
  // Treat preloaded data as immediately stale so it's re-fetched on navigation
  // (hand freshness to a data library like TanStack Query if you add one).
  defaultPreloadStaleTime: 0
})

// Register the router instance for project-wide type safety (typed <Link to>,
// params, search, loaders, etc.).
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
