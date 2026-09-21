import assert from "node:assert/strict"
import { test } from "vitest"
import { browserSmokeOrigin } from "./smoke-browser.mjs"

test("requires a credential-free HTTPS browser smoke origin", () => {
  assert.equal(
    browserSmokeOrigin({ LEGISLATION_BROWSER_SMOKE_BASE_URL: "https://staging.example.test" }).href,
    "https://staging.example.test/"
  )
  for (const value of ["http://staging.example.test", "https://user:password@staging.example.test/path"]) {
    assert.throws(
      () => browserSmokeOrigin({ LEGISLATION_BROWSER_SMOKE_BASE_URL: value }),
      /credential-free HTTPS origin/
    )
  }
})
