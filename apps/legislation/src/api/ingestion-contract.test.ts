import { describe, expect, it, vi } from "vitest"
import { checkApiIngestionContract, ingestionContract } from "./ingestion-contract.js"

describe("API before importer deployment gate", () => {
  it("accepts the current serving contract", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: "ready", ingestionContract }))
    await expect(checkApiIngestionContract("https://api.example.test", fetcher)).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://api.example.test/ready"),
      expect.objectContaining({ redirect: "error", cache: "no-store" })
    )
  })

  it.each([
    { status: "ready" },
    { status: "unavailable", ingestionContract },
    { status: "ready", ingestionContract: { membershipEndReasons: ["congress_ended", "roster_removal_detected"] } }
  ])("rejects an old or unavailable serving contract", async (body) => {
    await expect(
      checkApiIngestionContract("https://api.example.test", async () => Response.json(body))
    ).rejects.toThrow("API ingestion gate failed")
  })

  it("fails closed on HTTP and network failures", async () => {
    await expect(
      checkApiIngestionContract("https://api.example.test", async () => new Response(null, { status: 503 }))
    ).rejects.toThrow("HTTP 503")
    await expect(
      checkApiIngestionContract("https://api.example.test", async () => {
        throw new Error("offline")
      })
    ).rejects.toThrow("offline")
  })

  it.each([
    "http://api.example.test",
    "https://user:password@api.example.test",
    "https://api.example.test/path",
    "https://api.example.test?token=secret"
  ])("rejects an unsafe origin", async (origin) => {
    const fetcher = vi.fn<typeof fetch>()
    await expect(checkApiIngestionContract(origin, fetcher)).rejects.toThrow("HTTPS API origin")
    expect(fetcher).not.toHaveBeenCalled()
  })
})
