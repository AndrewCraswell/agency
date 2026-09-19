// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import RepresentativesPage, { dynamic, metadata } from "./page"

const navigation = vi.hoisted(() => ({
  notFound: vi.fn<() => never>(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404")
  })
}))

vi.mock("next/navigation", () => navigation)
vi.mock("../../../components/shell/AppHeader", () => ({
  AppHeader: () => <header aria-label="Rostra app header" />
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it.each(["production", "test", undefined])("returns not found outside development (%s)", (environment) => {
  vi.stubEnv("NODE_ENV", environment)
  expect(() => RepresentativesPage()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404")
  expect(navigation.notFound).toHaveBeenCalledTimes(1)
})

it("composes the shared app shell and lookup in development without fetching location", () => {
  vi.stubEnv("NODE_ENV", "development")
  const fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal("fetch", fetcher)
  render(<RepresentativesPage />)
  expect(navigation.notFound).not.toHaveBeenCalled()
  expect(screen.getByRole("banner", { name: "Rostra app header" })).toBeDefined()
  expect(screen.getByRole("heading", { level: 1, name: "Find your representatives" })).toBeDefined()
  expect(screen.getByRole("button", { name: "Use my location" })).toBeDefined()
  expect(fetcher).not.toHaveBeenCalled()
})

it("always renders dynamically and excludes the development page from search indexing", () => {
  expect(dynamic).toBe("force-dynamic")
  expect(metadata.robots).toEqual({ index: false, follow: false })
})
