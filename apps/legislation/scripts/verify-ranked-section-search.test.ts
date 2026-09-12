import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const script = fileURLToPath(new URL("./verify-ranked-section-search.ts", import.meta.url))

describe("ranked search canary safety", () => {
  it.each([
    ["postgresql://benchmark:secret@127.0.0.1/application", "isolated legislation_search_benchmark"],
    ["postgresql://benchmark:secret@127.0.0.1:5432/legislation_search_benchmark", "hosts must differ"],
    ["https://benchmark:secret@example.com/legislation_search_benchmark", "Explicit PostgreSQL"],
    ["not-a-url-secret", "Explicit PostgreSQL"]
  ])("rejects an unsafe target without connecting or exposing credentials", { timeout: 30_000 }, (target, message) => {
    const result = spawnSync(process.execPath, ["--import", "tsx", script], {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://source:secret@127.0.0.1:5432/application",
        TEXT_INDEX_BENCHMARK_URL: target
      },
      // Each case starts a TypeScript process; concurrent coverage workers can delay startup.
      timeout: 20_000
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(message)
    expect(result.stderr).not.toContain("secret")
  })
})
