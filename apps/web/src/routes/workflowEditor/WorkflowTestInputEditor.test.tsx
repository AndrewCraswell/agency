import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import { WorkflowTestInputEditor } from "./WorkflowTestInputEditor"

const schema = {
  type: "object",
  required: ["issue"],
  properties: {
    issue: { type: "string", title: "Issue identifier" },
    attempts: { type: "integer", title: "Maximum attempts" },
    dryRun: { type: "boolean", title: "Dry run" }
  }
}

describe("WorkflowTestInputEditor", () => {
  it("generates labeled controls and serializes typed input", () => {
    const onChange = vi.fn<(value: string) => void>()
    render(
      <AppShell>
        <WorkflowTestInputEditor schema={schema} value="{}" onChange={onChange} />
      </AppShell>
    )

    fireEvent.change(screen.getByRole("textbox", { name: "Issue identifier" }), { target: { value: "FEN-42" } })
    expect(onChange).toHaveBeenLastCalledWith('{\n  "issue": "FEN-42"\n}')
    expect(screen.getByRole("spinbutton", { name: "Maximum attempts" })).toHaveAttribute("step", "1")
    expect(screen.getByRole("checkbox", { name: "Dry run" })).toBeInTheDocument()
  })

  it("preserves invalid Advanced JSON and restores form values after correction", async () => {
    const onChange = vi.fn<(value: string) => void>()
    const view = render(
      <AppShell>
        <WorkflowTestInputEditor schema={schema} value="{}" onChange={onChange} />
      </AppShell>
    )
    await userEvent.click(screen.getByRole("tab", { name: "Advanced JSON" }))
    const editor = screen.getByRole("textbox", { name: "Test input JSON" })
    fireEvent.change(editor, { target: { value: '{"issue":' } })
    expect(onChange).toHaveBeenLastCalledWith('{"issue":')

    view.rerender(
      <AppShell>
        <WorkflowTestInputEditor schema={schema} value={'{"issue":'} onChange={onChange} />
      </AppShell>
    )
    expect(screen.getByText("Enter valid JSON test input.")).toBeInTheDocument()
    expect(editor).toHaveValue('{"issue":')
  })
})
