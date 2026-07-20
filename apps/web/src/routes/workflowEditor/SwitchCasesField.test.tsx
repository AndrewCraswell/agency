import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import type { JsonValue } from "@/services/api"
import { SwitchCasesField } from "./SwitchCasesField"

describe("SwitchCasesField", () => {
  it("round-trips a typed condition to the switch cases contract", () => {
    const onChange = vi.fn<(value: JsonValue[]) => void>()
    render(
      <AppShell>
        <SwitchCasesField
          value={[{ key: "urgent", when: { path: ["issue", "priority"], operator: "equals", value: "urgent" } }]}
          onChange={onChange}
        />
      </AppShell>
    )

    fireEvent.change(screen.getByRole("textbox", { name: "Comparison value" }), { target: { value: '"high"' } })

    expect(onChange).toHaveBeenLastCalledWith([
      { key: "urgent", when: { path: ["issue", "priority"], operator: "equals", value: "high" } }
    ])
  })

  it("keeps invalid comparison text visible without emitting", () => {
    const onChange = vi.fn<(value: JsonValue[]) => void>()
    render(
      <AppShell>
        <SwitchCasesField
          value={[{ key: "urgent", when: { path: ["priority"], operator: "equals", value: "urgent" } }]}
          onChange={onChange}
        />
      </AppShell>
    )

    const comparison = screen.getByRole("textbox", { name: "Comparison value" })
    fireEvent.change(comparison, { target: { value: '{"unfinished":' } })

    expect(comparison).toHaveValue('{"unfinished":')
    expect(screen.getByRole("alert")).toHaveTextContent("valid JSON comparison value")
    expect(onChange).not.toHaveBeenCalled()
  })
})
