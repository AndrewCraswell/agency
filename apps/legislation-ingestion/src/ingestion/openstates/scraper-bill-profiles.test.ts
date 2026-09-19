import { expect, it } from "vitest"
import { scraperBillPromotionOwnership } from "./scraper-promotion.js"

it.each([
  { jurisdiction: "nc", session: "2025" },
  { jurisdiction: "ak", session: "34" },
  { jurisdiction: "wa", session: "2025-2026" }
] as const)("namespaces ownership by reviewed jurisdiction and session: $jurisdiction", (scope) => {
  expect(scraperBillPromotionOwnership(scope)).toEqual({
    source: "openstates",
    stream: "ownership:" + scope.jurisdiction + "-bills:" + scope.session
  })
  expect(() => scraperBillPromotionOwnership({ ...scope, session: "other-session" })).toThrow(
    "Unsupported scraper ownership scope"
  )
})
