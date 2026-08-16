import { describe, expect, it } from "vitest"
import { RetryingHttpClient } from "../http-client.js"
import { discoverOpenStatesArchives } from "./discover.js"

describe("Open States archive discovery", () => {
  it("discovers and sorts supported archive URL layouts", async () => {
    const client = new RetryingHttpClient({
      fetch: async () =>
        new Response(`
          <a href="/data/session-json/wa/2025-2026.zip">Washington</a>
          <a href="/data/session-json/ca/2023-2024/bills.json.gz">California</a>
          <a href="https://example.test/tx-2025.jsonl">Texas</a>
          <a href="http://example.test/or-2025.zip">insecure</a>
        `),
      maxAttempts: 1,
      requestTimeoutMs: 1000
    })

    await expect(discoverOpenStatesArchives(client)).resolves.toEqual([
      { jurisdictionCode: "tx", session: "2025", url: new URL("https://example.test/tx-2025.jsonl") },
      {
        jurisdictionCode: "ca",
        session: "2023-2024",
        url: new URL("https://open.pluralpolicy.com/data/session-json/ca/2023-2024/bills.json.gz")
      },
      {
        jurisdictionCode: "wa",
        session: "2025-2026",
        url: new URL("https://open.pluralpolicy.com/data/session-json/wa/2025-2026.zip")
      }
    ])
  })
})
