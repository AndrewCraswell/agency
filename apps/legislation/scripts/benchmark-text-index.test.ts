import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const script = fileURLToPath(new URL("./benchmark-text-index.mjs", import.meta.url))

describe("isolated text-index benchmark safety", () => {
  it.each([
    ["postgresql://benchmark:secret@127.0.0.1/application", "isolated legislation_search_benchmark"],
    ["postgresql://benchmark:secret@127.0.0.1:5432/legislation_search_benchmark", "hosts must differ"],
    ["https://benchmark:secret@example.com/legislation_search_benchmark", "Explicit PostgreSQL"],
    ["not-a-url-secret", "Explicit PostgreSQL"]
  ])("rejects an unsafe target before making connections", (target, message) => {
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://source:secret@127.0.0.1:5432/application",
        TEXT_INDEX_BENCHMARK_URL: target
      },
      timeout: 10000
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(message)
    expect(result.stderr).not.toContain("secret")
  })
})
