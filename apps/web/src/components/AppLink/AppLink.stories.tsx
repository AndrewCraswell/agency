import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from "@tanstack/react-router"
import { expect, userEvent, within } from "storybook/test"
import { AppShell } from "@/components/AppShell/AppShell"
import { AppLink } from "./AppLink"

// A minimal in-memory router so the link can navigate in isolation, without
// pulling in the whole app's route tree.
function createStoryRouter() {
  const rootRoute = createRootRoute({
    component: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <nav style={{ display: "flex", gap: 16 }}>
          <AppLink to="/">Home</AppLink>
          <AppLink to="/workflows">Workflows</AppLink>
          <AppLink to="/workflows" preload={false}>
            Workflows (no preload)
          </AppLink>
        </nav>
        <Outlet />
      </div>
    )
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <span>Home page</span>
  })
  const workflowsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/workflows",
    component: () => <span>Workflows page</span>
  })

  return createRouter({
    routeTree: rootRoute.addChildren([indexRoute, workflowsRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] })
  })
}

const meta: Meta<typeof AppLink> = {
  title: "Components/AppLink",
  component: AppLink,
  decorators: [
    (Story) => (
      <AppShell>
        <Story />
      </AppShell>
    )
  ]
}

export default meta

type Story = StoryObj<typeof meta>

/** Fluent-styled links wired to a real router. */
export const Default: Story = {
  render: () => <RouterProvider router={createStoryRouter()} />
}

/** Clicking a link navigates via the router, swapping the outlet content. */
export const NavigatesOnClick: Story = {
  render: () => <RouterProvider router={createStoryRouter()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Home page")).toBeInTheDocument()
    await userEvent.click(canvas.getByRole("link", { name: "Workflows" }))
    await expect(await canvas.findByText("Workflows page")).toBeInTheDocument()
  }
}
