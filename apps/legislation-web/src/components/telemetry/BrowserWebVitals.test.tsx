// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react"
import { useReportWebVitals } from "next/web-vitals"
import { StrictMode } from "react"
import { afterEach, expect, it, vi } from "vitest"
import { reportBrowserWebVital } from "../../services/sentry/browserTelemetry"
import { BrowserWebVitals } from "./BrowserWebVitals"

vi.mock("next/web-vitals", () => ({
  useReportWebVitals: vi.fn<typeof useReportWebVitals>()
}))
vi.mock("../../services/sentry/browserTelemetry", () => ({
  reportBrowserWebVital: vi.fn<typeof reportBrowserWebVital>()
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it("uses one stable callback without adding UI or creating a hook per route change", () => {
  const view = render(
    <StrictMode>
      <BrowserWebVitals />
    </StrictMode>
  )
  view.rerender(
    <StrictMode>
      <BrowserWebVitals />
    </StrictMode>
  )
  expect(view.container.innerHTML).toBe("")
  expect(vi.mocked(useReportWebVitals).mock.calls.length).toBeGreaterThan(0)
  expect(vi.mocked(useReportWebVitals).mock.calls.every(([callback]) => callback === reportBrowserWebVital)).toBe(true)
})
