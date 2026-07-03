import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, vi } from "vitest"
import { ApiMock, server } from "@/tests/server"
import "@testing-library/jest-dom/vitest"

// Replace the heavy Fluent UI icon package with lightweight stubs. The real
// package ships thousands of SVG modules; tests rarely assert on the icon
// itself, so a lazy Proxy that fabricates a stub per named export keeps unit
// runs fast. (The Storybook browser project uses the real icons.)
vi.mock("@fluentui/react-icons", async () => {
  const { createElement, forwardRef } = await import("react")
  const IconStub = forwardRef<HTMLSpanElement, Record<string, unknown>>(function IconStub(props, ref) {
    const { children: _children, ...rest } = props ?? {}
    return createElement("span", { ...rest, ref })
  })
  IconStub.displayName = "FluentIconStub"

  const cache: Record<string, unknown> = Object.create(null)
  const iconModule: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "__esModule") {
          return true
        }
        if (prop === "default") {
          return iconModule
        }
        if (typeof prop !== "string" || prop === "then") {
          return undefined
        }
        if (prop in cache) {
          return cache[prop]
        }
        const firstChar = prop.charCodeAt(0)
        const isComponent = firstChar >= 65 && firstChar <= 90 // A-Z => component, else icon factory
        cache[prop] = isComponent ? IconStub : () => IconStub
        return cache[prop]
      },
      // Report every (non-thenable) named export as present so Vitest resolves
      // arbitrary icon imports through the get trap above.
      has(_target, prop) {
        return typeof prop === "string" && prop !== "then"
      }
    }
  )
  return iconModule
})

// Vitest globals are disabled, so Testing Library's automatic cleanup is not
// registered. Unmount rendered trees after each test to keep them isolated.
afterEach(() => {
  cleanup()
  ApiMock.reset()
})

// MSW node server lifecycle.
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" })
})

afterAll(() => {
  server.close()
})
