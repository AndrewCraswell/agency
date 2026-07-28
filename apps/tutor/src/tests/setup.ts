import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"
import "@testing-library/jest-dom/vitest"

vi.mock("@fluentui/react-icons", async () => {
  const { createElement, forwardRef } = await import("react")
  const IconStub = forwardRef<HTMLSpanElement, Record<string, unknown>>(function IconStub(props, ref) {
    return createElement("span", { ...props, ref })
  })
  const iconModule: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "__esModule") {
          return true
        }
        if (typeof property !== "string" || property === "then") {
          return undefined
        }
        return IconStub
      },
      has(_target, property) {
        return typeof property === "string" && property !== "then"
      }
    }
  )
  return iconModule
})

afterEach(() => cleanup())
