import { readdirSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"
import { expect, it } from "vitest"
import { telemetryCoverageForRoute, telemetryCoverageRegistry } from "./telemetryCoverage"
import { resolveTelemetryRoute } from "./telemetryRoutes"

it.each([
  ["/", "/", "home"],
  ["/conversations/private-thread?secret=hidden", "/conversations/[conversationId]", "conversation"],
  ["/records/person/private-id", "/records/[kind]/[recordId]", "record"],
  ["/chat", "/chat", "conversation"],
  ["/dev/representatives?address=PRIVATE", "/dev/representatives", "development"],
  ["/api/dev/representatives?address=PRIVATE", "/api/dev/representatives", "development"],
  ["/api/bills/batch/", "/api/bills/batch", "api"],
  ["/api/bills/private-bill", "/api/bills/[billId]", "api"],
  ["/api/legal/provisions/resolve", "/api/legal/provisions/resolve", "api"],
  [
    "/api/documents/private-doc/sections/private-section#private",
    "/api/documents/[documentId]/sections/[sectionId]",
    "api"
  ],
  ["/api/unknown/private-id", "/api/[...path]", "not_found"],
  ["/api", "/api", "not_found"],
  ["/private-path", "/_unmatched", "not_found"],
  ["https://private.example/secret", "/_unmatched", "not_found"],
  ["//private.example/secret", "/_unmatched", "not_found"],
  ["/health", "/health", "health"],
  ["/ready", "/ready", "readiness"]
])("normalizes %s without retaining values", (path, template, surface) => {
  expect(resolveTelemetryRoute(path)).toEqual({ route_template: template, surface })
})

it("resolves every shipped Next route/page through the executable registry", () => {
  const app = resolve(import.meta.dirname, "../../app")
  const entries = readdirSync(app, { recursive: true, withFileTypes: true }).filter(
    (entry) => entry.isFile() && (entry.name === "route.ts" || entry.name === "page.tsx")
  )
  expect(entries.length).toBeGreaterThan(100)
  for (const entry of entries) {
    const route = `/${relative(app, join(entry.parentPath, entry.name)).split(sep).slice(0, -1).join("/")}`
    const path = route === "/api/[...path]" ? "/api/unknown/path" : route.replace(/\[[^\]]+\]/gu, "synthetic-id")
    expect(resolveTelemetryRoute(path).route_template).toBe(route)
  }
})

it("keeps operational, gated and demo routing populations distinct", () => {
  expect(telemetryCoverageForRoute("/dev/representatives")).toMatchObject({
    group: "development",
    exception: "excluded_from_product_usage"
  })
  expect(telemetryCoverageForRoute("/api/dev/representatives")).toMatchObject({
    group: "development",
    exception: "excluded_from_product_usage"
  })
  expect(telemetryCoverageForRoute("/")).toMatchObject({ owner: "web", exception: "demo_separate" })
  expect(telemetryCoverageForRoute("/health")).toMatchObject({
    group: "probe",
    exception: "excluded_from_product_usage"
  })
  expect(telemetryCoverageForRoute("/api/subscriptions/private")).toMatchObject({
    group: "monitoring",
    owner: "platform"
  })
  expect(telemetryCoverageForRoute("/api/search/legal")).toMatchObject({
    group: "legal",
    exception: "legal_acceptance_separate"
  })
  expect(telemetryCoverageForRoute("/api/search/bills")).toMatchObject({ group: "search", owner: "research" })
  expect(telemetryCoverageForRoute("/api/private/unknown")).toMatchObject({
    group: "unmatched",
    exception: "bounded_unknown_route"
  })
  expect(new Set(telemetryCoverageRegistry.map((entry) => entry.route_template)).size).toBe(
    telemetryCoverageRegistry.length
  )
})
