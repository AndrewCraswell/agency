import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import type { WorkflowDraftContent } from "@/services/api"
import { ConnectionMappingsField } from "./ConnectionMappingsField"

describe("ConnectionMappingsField", () => {
  it("serializes path rows to the existing connection contract", async () => {
    const onChange = vi.fn<(value: WorkflowDraftContent["connections"][number]["mappings"]) => void>()
    const view = render(
      <AppShell>
        <ConnectionMappingsField value={[]} onChange={onChange} />
      </AppShell>
    )
    await userEvent.click(screen.getByRole("button", { name: "Add mapping" }))
    expect(onChange).toHaveBeenLastCalledWith([{ sourcePath: [], targetPath: [] }])

    view.rerender(
      <AppShell>
        <ConnectionMappingsField value={[{ sourcePath: [], targetPath: [] }]} onChange={onChange} />
      </AppShell>
    )
    fireEvent.change(screen.getByRole("textbox", { name: "Source path" }), { target: { value: "issue.title" } })
    expect(onChange).toHaveBeenLastCalledWith([{ sourcePath: ["issue", "title"], targetPath: [] }])
    fireEvent.change(screen.getByRole("textbox", { name: "Target path" }), { target: { value: "request.heading" } })
    expect(onChange).toHaveBeenLastCalledWith([{ sourcePath: [], targetPath: ["request", "heading"] }])
  })
})
