import { createRootRoute, createRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router"
import { z } from "zod"
import { NotFoundPage } from "./routes/NotFoundPage"
import { OperationsPage } from "./routes/operations/OperationsPage"
import { RootLayout } from "./routes/RootLayout"

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFoundPage })

type IntegrationsSearch = { returnTo?: "workflow-create"; workflowName?: string }
type WorkflowsSearch = { create?: true; name?: string }
const OperationsSearchSchema = z.object({
  view: z.enum(["overview", "runs", "work-queue"]).optional().catch(undefined),
  q: z.string().trim().max(200).optional().catch(undefined),
  status: z.enum(["todo", "in_progress", "blocked"]).optional().catch(undefined),
  repository: z.string().trim().min(1).optional().catch(undefined),
  assignee: z.string().trim().min(1).optional().catch(undefined),
  priority: z.coerce.number().int().min(0).max(4).optional().catch(undefined),
  age: z.enum(["day", "week", "month"]).optional().catch(undefined),
  sort: z.enum(["priority", "created", "updated", "identifier"]).optional().catch(undefined),
  direction: z.enum(["asc", "desc"]).optional().catch(undefined),
  cursor: z.string().trim().min(1).optional().catch(undefined)
})

// The home route is the initial paint, so it's bundled eagerly. Other routes are
// code-split with `lazyRouteComponent` — each becomes its own chunk that is only
// fetched when needed. Combined with `defaultPreload: "intent"` below, hovering
// or focusing a <Link> to one of them prefetches its chunk, so the navigation
// itself is instant.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>): z.infer<typeof OperationsSearchSchema> =>
    OperationsSearchSchema.parse(search),
  component: OperationsPage
})
const integrationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/integrations",
  validateSearch: (search: Record<string, unknown>): IntegrationsSearch => ({
    returnTo: search.returnTo === "workflow-create" ? ("workflow-create" as const) : undefined,
    workflowName: typeof search.workflowName === "string" ? search.workflowName : undefined
  }),
  component: lazyRouteComponent(() => import("./routes/SettingsPage"), "IntegrationsPage")
})
const workflowsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workflows",
  validateSearch: (search: Record<string, unknown>): WorkflowsSearch => ({
    create: search.create === true || search.create === "true" ? true : undefined,
    name: typeof search.name === "string" ? search.name : undefined
  }),
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
  integrationsRoute,
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
