import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import type { JsonValue } from "@/services/api"
import { DraftJsonField } from "./DraftJsonField"

describe("DraftJsonField", () => {
  it("keeps invalid intermediate text visible without emitting a value", () => {
    const onChange = vi.fn<(value: JsonValue) => void>()
    render(
      <AppShell>
        <DraftJsonField label="Configuration" value={{ ready: true }} onChange={onChange} />
      </AppShell>
    )

    const editor = screen.getByRole("textbox", { name: "Configuration" })
    fireEvent.change(editor, { target: { value: '{"ready":' } })

    expect(editor).toHaveValue('{"ready":')
    expect(screen.getByText("Enter valid JSON.")).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("emits a parsed JSON value after the draft becomes valid", () => {
    const onChange = vi.fn<(value: JsonValue) => void>()
    render(
      <AppShell>
        <DraftJsonField label="Configuration" value={{ ready: true }} onChange={onChange} />
      </AppShell>
    )

    fireEvent.change(screen.getByRole("textbox", { name: "Configuration" }), {
      target: { value: '{"ready":false,"count":2}' }
    })

    expect(onChange).toHaveBeenCalledWith({ ready: false, count: 2 })
    expect(screen.queryByText("Enter valid JSON.")).not.toBeInTheDocument()
  })
})
