import assert from "node:assert/strict"
import { test } from "vitest"
import { readinessConfig, waitForReadiness } from "./wait-readiness.mjs"

const commitSha = "a".repeat(40)

test("accepts readiness only for the exact deployed commit", async () => {
  const configuration = readinessConfig({
    LEGISLATION_READINESS_BASE_URL: "https://staging.example.test",
    LEGISLATION_DEPLOYMENT_COMMIT_SHA: commitSha
  })
  let requestCount = 0
  await waitForReadiness(configuration, {
    fetch: async () => {
      requestCount += 1
      return Response.json({
        status: "ready",
        commitSha: requestCount === 1 ? "b".repeat(40) : commitSha.toUpperCase()
      })
    },
    attempts: 2,
    delayMs: 0,
    delay: (callback) => callback()
  })
  assert.equal(requestCount, 2)
})

test("fails closed after bounded readiness attempts", async () => {
  const configuration = readinessConfig({
    LEGISLATION_READINESS_BASE_URL: "https://staging.example.test",
    LEGISLATION_DEPLOYMENT_COMMIT_SHA: commitSha
  })
  await assert.rejects(
    waitForReadiness(configuration, {
      fetch: async () => Response.json({ status: "unavailable", commitSha }, { status: 503 }),
      attempts: 2,
      delayMs: 0,
      delay: (callback) => callback()
    }),
    /Readiness did not match/
  )
})

test("rejects unsafe readiness origins", () => {
  assert.throws(
    () =>
      readinessConfig({
        LEGISLATION_READINESS_BASE_URL: "https://user:password@example.test",
        LEGISLATION_DEPLOYMENT_COMMIT_SHA: commitSha
      }),
    /credential-free HTTPS origin/
  )
})
