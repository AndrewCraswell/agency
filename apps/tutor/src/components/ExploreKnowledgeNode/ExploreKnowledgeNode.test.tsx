import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GraphHighlightContext } from "@/components/GraphCanvas/GraphHighlightContext"
import type { KnowledgeNodeData, KnowledgeNodeKind } from "@/graph/graphTypes"
import { ExploreKnowledgeNode } from "./ExploreKnowledgeNode"

vi.mock("@xyflow/react", async () => {
  const React = await import("react")
  return {
    Handle: ({ id }: { id: string }) =>
      React.createElement("span", { "data-testid": id === "resource-in" ? "resource-port" : id }),
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" }
  }
})

function renderNode(kind: KnowledgeNodeKind, highlightedNodeIds?: ReadonlySet<string>) {
  const data: KnowledgeNodeData = {
    label: `${kind} example`,
    shortLabel: `${kind} short label`,
    kind,
    definition: `${kind} definition`,
    whyItMatters: "Reason",
    evidence: [],
    mappings: [],
    resources: [],
    stage: 1,
    confidence: 0.91,
    hasResources: kind === "outcome"
  }

  return render(
    <GraphHighlightContext.Provider value={highlightedNodeIds}>
      <ExploreKnowledgeNode
        id={`${kind}-id`}
        type="knowledge"
        data={data}
        dragging={false}
        zIndex={0}
        selectable
        deletable
        selected={kind === "outcome"}
        draggable
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    </GraphHighlightContext.Provider>
  )
}

describe("ExploreKnowledgeNode", () => {
  it.each([
    ["atomic", "Atomic skill"],
    ["outcome", "Outcome"],
    ["resource", "Resource"]
  ] as const)("renders a compact %s node with the appropriate ports", (kind, accessibleKind) => {
    renderNode(kind, new Set(kind === "atomic" ? [] : [`${kind}-id`]))

    const node = screen.getByRole("article", { name: `${accessibleKind}: ${kind} example` })
    expect(node).toBeVisible()
    expect(screen.getByText(`${kind} short label`)).toBeVisible()
    expect(screen.getByText("91%")).toBeVisible()
    expect(node).toHaveClass(kind === "atomic" ? "explore-knowledge-node--dimmed" : `explore-knowledge-node--${kind}`)
    expect(screen.getByTestId(kind === "resource" ? "resource-port" : "prerequisite-in")).toBeInTheDocument()
  })
})
