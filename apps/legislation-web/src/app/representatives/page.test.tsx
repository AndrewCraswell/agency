// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import RepresentativesPage, { metadata } from "./page"

vi.mock("../../components/shell/AppHeader", () => ({
  AppHeader: () => <header aria-label="Rostra app header" />
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it("composes the shared app shell and public lookup without fetching location", () => {
  const fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal("fetch", fetcher)
  render(<RepresentativesPage />)
  expect(screen.getByRole("banner", { name: "Rostra app header" })).toBeDefined()
  expect(screen.getByRole("heading", { level: 1, name: "Find your representatives" })).toBeDefined()
  expect(screen.getByRole("button", { name: "Use my location" })).toBeDefined()
  expect(fetcher).not.toHaveBeenCalled()
})

it("uses public page metadata", () => {
  expect(metadata).toEqual({ title: "Find your representatives | Rostra" })
})
