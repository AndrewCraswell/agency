import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import type { JsonValue } from "@/services/api"
import { ObjectRowsField } from "./ObjectRowsField"

describe("ObjectRowsField", () => {
  it("serializes text mapping rows without changing the service shape", async () => {
    const onChange = vi.fn<(value: Record<string, JsonValue>) => void>()
    render(
      <AppShell>
        <ObjectRowsField
          label="Mappings"
          keyLabel="Output field"
          valueLabel="Source path"
          value={{ title: "issue.title" }}
          valueMode="text"
          onChange={onChange}
        />
      </AppShell>
    )

    fireEvent.change(screen.getByRole("textbox", { name: "Source path" }), { target: { value: "issue.name" } })

    expect(onChange).toHaveBeenLastCalledWith({ title: "issue.name" })
    await userEvent.click(screen.getByRole("button", { name: "Add row" }))
    expect(screen.getAllByRole("textbox", { name: "Output field" })).toHaveLength(2)
  })

  it("keeps an invalid JSON value visible and reports it without emitting", () => {
    const onChange = vi.fn<(value: Record<string, JsonValue>) => void>()
    render(
      <AppShell>
        <ObjectRowsField
          label="Fields"
          keyLabel="Field name"
          valueLabel="Value"
          value={{ ready: true }}
          valueMode="json"
          onChange={onChange}
        />
      </AppShell>
    )

    const value = screen.getByRole("textbox", { name: "Value" })
    fireEvent.change(value, { target: { value: '{"incomplete":' } })

    expect(value).toHaveValue('{"incomplete":')
    expect(screen.getByRole("alert")).toHaveTextContent("Enter valid JSON")
    expect(onChange).not.toHaveBeenCalled()
  })
})
