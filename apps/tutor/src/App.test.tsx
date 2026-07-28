import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"
import { completedGraphMetadata } from "./graph/completedGraphMetadata"

vi.mock("@xyflow/react", async () => {
  const React = await import("react")
  function ReactFlow({
    nodes,
    onNodeClick,
    onPaneClick,
    onMoveEnd,
    onNodeDragStop,
    children,
    ...props
  }: {
    nodes: Array<{ id: string; data: { label: string }; position: { x: number; y: number } }>
    onNodeClick: (
      event: object,
      node: { id: string; data: { label: string }; position: { x: number; y: number } }
    ) => void
    onPaneClick: () => void
    onMoveEnd: (event: object, viewport: { x: number; y: number; zoom: number }) => void
    onNodeDragStop: (
      event: object,
      node: { id: string; data: { label: string }; position: { x: number; y: number } }
    ) => void
    children: React.ReactNode
    "aria-label": string
  }) {
    const renderedNodes = nodes.length > 100 ? nodes.slice(0, 40) : nodes

    return React.createElement(
      "div",
      { "aria-label": props["aria-label"], onClick: onPaneClick },
      renderedNodes.map((node) =>
        React.createElement(
          "button",
          {
            type: "button",
            key: node.id,
            onClick: (event: React.MouseEvent) => {
              event.stopPropagation()
              onNodeClick({}, node)
            }
          },
          node.data.label
        )
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: (event: React.MouseEvent) => {
            event.stopPropagation()
            onMoveEnd({}, { x: 0, y: 0, zoom: 0.5 })
          }
        },
        "Finish moving graph"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: (event: React.MouseEvent) => {
            event.stopPropagation()
            const firstNode = nodes[0]
            if (firstNode !== undefined) {
              onNodeDragStop({}, { ...firstNode, position: { x: 12, y: 24 } })
            }
          }
        },
        "Finish dragging node"
      ),
      children
    )
  }
  return {
    ReactFlow,
    useNodesState: (initialNodes: Array<{ id: string; data: { label: string } }>) => {
      const [nodes, setNodes] = React.useState(initialNodes)
      return [nodes, setNodes, vi.fn<() => void>()]
    },
    Background: () => null,
    MiniMap: () => null,
    Controls: () => null,
    Handle: () => null,
    MarkerType: { ArrowClosed: "arrowclosed" },
    BackgroundVariant: { Dots: "dots" },
    Position: { Top: "top", Bottom: "bottom" }
  }
})

describe("Tutor skills atlas", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn<() => void>()
  })

  it("guides the viewer through the graph and exposes node evidence", async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole("heading", { name: "See the learning path behind every result." })).toBeVisible()
    expect(screen.getByRole("heading", { name: /Add two one-digit numbers/ })).toBeVisible()
    expect(screen.getByText("Produces correct sums across varied addend pairs")).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Show the next insight" }))
    expect(screen.getByText("Every outcome has observable evidence")).toBeVisible()
    expect(screen.getByRole("heading", { name: /Add two one-digit numbers/ })).toBeVisible()

    await user.click(
      screen.getByRole("button", { name: "Show insight 6: The graph pinpoints the earliest actionable gap" })
    )
    expect(screen.getByRole("heading", { name: /Count a collection of up to 10 objects accurately/ })).toBeVisible()
    expect(screen.getByText("Touches or tracks each object once")).toBeVisible()
  })

  it("supports exploration, relationship filters, and plan highlighting", async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole("tab", { name: "Explore graph" }))
    expect(screen.queryByText(/INSIGHT 1 OF/)).not.toBeInTheDocument()
    expect(screen.getByText(String(completedGraphMetadata.completedOutcomeCount))).toBeVisible()
    const { completedNodes } = await import("./graph/completedGraphData")
    expect(await screen.findByLabelText("Interactive mathematics skills graph")).toBeVisible()
    expect(await screen.findByRole("button", { name: completedNodes[0].data.label })).toBeVisible()

    expect(screen.queryByRole("switch", { name: "Standards mappings" })).not.toBeInTheDocument()

    expect(screen.queryByText("Minimum prerequisite plan")).not.toBeInTheDocument()

    const supportsToggle = screen.getByRole("button", { name: "Hide supporting knowledge" })
    expect(supportsToggle).toHaveAttribute("aria-pressed", "true")
    await user.click(supportsToggle)
    expect(screen.getByRole("button", { name: "Show supporting knowledge" })).toHaveAttribute("aria-pressed", "false")

    await user.click(screen.getByRole("tab", { name: "Guided story" }))
    await user.click(screen.getByRole("button", { name: "Show insight 8: Resources attach at the moment of need" }))
    expect(screen.getByRole("heading", { name: "Addition and subtraction within 10" })).toBeVisible()
    expect(screen.getByRole("link", { name: "Addition and subtraction within 10" })).toHaveAttribute(
      "href",
      "https://en.khanacademy.org/math/early-math/cc-early-math-add-sub-basics/cc-early-math-together-apart/v/addition-and-subtraction-within-10"
    )
    expect(screen.queryByRole("heading", { name: "Standards mappings" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Finish moving graph" }))
    await user.click(screen.getByRole("button", { name: "Finish dragging node" }))
  }, 20_000)
})
