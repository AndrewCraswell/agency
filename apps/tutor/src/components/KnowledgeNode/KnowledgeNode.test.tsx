import { FluentProvider, webLightTheme } from "@fluentui/react-components"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { KnowledgeNodeData, KnowledgeNodeKind } from "@/graph/graphTypes"
import { KnowledgeNode } from "./KnowledgeNode"

vi.mock("@xyflow/react", async () => {
  const React = await import("react")
  return {
    Handle: ({ type }: { type: string }) => React.createElement("span", { "data-handle": type }),
    Position: { Top: "top", Bottom: "bottom" }
  }
})

function renderNode(kind: KnowledgeNodeKind, selected = false) {
  const data: KnowledgeNodeData = {
    label: `${kind} example`,
    shortLabel: `${kind} short label`,
    kind,
    definition: `${kind} definition`,
    whyItMatters: "Reason",
    evidence: [],
    mappings: [],
    resources:
      kind === "resource"
        ? [
            {
              provider: "Khan Academy",
              title: "Addition example",
              format: "Lesson",
              url: "https://www.khanacademy.org/math"
            }
          ]
        : [],
    stage: 1,
    confidence: 0.91
  }

  return render(
    <FluentProvider theme={webLightTheme}>
      <KnowledgeNode
        id={`${kind}-id`}
        type="knowledge"
        data={data}
        dragging={false}
        zIndex={0}
        selectable
        deletable
        selected={selected}
        draggable
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    </FluentProvider>
  )
}

describe("KnowledgeNode", () => {
  it.each([
    ["atomic", "Atomic skill"],
    ["outcome", "Outcome"],
    ["resource", "Resource"]
  ] as const)("renders a %s node", (kind, accessibleKind) => {
    renderNode(kind, kind === "outcome")

    expect(screen.getByRole("article", { name: `${accessibleKind}: ${kind} example` })).toBeVisible()
    expect(screen.getByText(`${kind} short label`)).toBeVisible()
    expect(screen.getByText("91%")).toBeVisible()
  })

  it("shows resource metadata and a new-tab action", () => {
    renderNode("resource")

    expect(screen.getByText("Khan Academy lesson")).toBeVisible()
    expect(screen.getByRole("link", { name: "Open Addition example in a new tab" })).toHaveAttribute("target", "_blank")
  })

  it("does not repeat the definition in a tooltip", () => {
    renderNode("atomic")

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    expect(screen.queryByText("atomic definition")).not.toBeInTheDocument()
  })
})
