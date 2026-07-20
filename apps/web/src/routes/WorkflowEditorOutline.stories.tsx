import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, within } from "storybook/test"
import { AppShell } from "@/components/AppShell/AppShell"
import { WorkflowEditorOutline } from "./WorkflowEditorOutline"
import { projectWorkflowOutline } from "./WorkflowEditorOutline.utils"

const items = projectWorkflowOutline(
  [
    { id: "trigger", label: "Pull request opened", kind: "provider_event", category: "trigger" },
    { id: "triage", label: "Choose review path", kind: "switch", category: "control" },
    { id: "review", label: "Review changes", kind: "structured_judgment", category: "ai" },
    { id: "join", label: "Join paths", kind: "join", category: "control" },
    { id: "complete", label: "Review complete", kind: "success", category: "terminal" },
    { id: "unused", label: "Unused formatter", kind: "set_fields", category: "data" }
  ],
  [
    { id: "start", sourceStepId: "trigger", targetStepId: "triage" },
    { id: "full-review", sourceStepId: "triage", targetStepId: "review", branchKey: "needs review" },
    { id: "skip-review", sourceStepId: "triage", targetStepId: "join", branchKey: "skip" },
    { id: "reviewed", sourceStepId: "review", targetStepId: "join" },
    { id: "done", sourceStepId: "join", targetStepId: "complete" },
    { id: "retry", sourceStepId: "complete", targetStepId: "triage", loopBack: true }
  ]
)

const descriptions = new Map(items.map(({ id, role }) => [id, `${role} workflow step`]))

const meta: Meta<typeof WorkflowEditorOutline> = {
  title: "Routes/Workflow editor/Outline",
  component: WorkflowEditorOutline,
  decorators: [
    (Story) => (
      <AppShell>
        <div style={{ height: "100vh" }}>
          <Story />
        </div>
      </AppShell>
    )
  ],
  args: {
    items,
    descriptions,
    selectedNodeId: "review",
    selectedEdgeId: undefined,
    problemStepIds: new Set(["review"]),
    testStatusByStep: new Map([
      ["trigger", "succeeded"],
      ["review", "failed"]
    ]),
    onSelectNode: fn(),
    onSelectEdge: fn()
  }
}

export default meta

type Story = StoryObj<typeof meta>

export const Desktop: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("navigation", { name: "Workflow topology" })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole("button", { name: "Select connection full-review" }))
    await expect(args.onSelectEdge).toHaveBeenCalledWith("full-review")
  }
}

export const CompactMobile: Story = {
  parameters: {
    viewport: {
      options: { compactMobile: { name: "Compact mobile", styles: { width: "390px", height: "844px" } } },
      defaultViewport: "compactMobile"
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("Unreachable")).toBeInTheDocument()
    await expect(canvas.getByRole("button", { name: "Select connection retry" })).toBeInTheDocument()
  }
}
