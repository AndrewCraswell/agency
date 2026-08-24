import { describe, expect, it } from "vitest"
import {
  UnsafeWebhookUrlError,
  formatWebhookSignature,
  resolvePublicWebhookUrl,
  signWebhookPayload,
  verifyWebhookSignature
} from "./webhook-security.js"

describe("webhook security", () => {
  it("rejects hosts with any private DNS answer", async () => {
    await expect(
      resolvePublicWebhookUrl("https://hooks.example.test/legislation", async () => [
        { address: "203.0.113.7", family: 4 },
        { address: "10.0.0.1", family: 4 }
      ])
    ).rejects.toBeInstanceOf(UnsafeWebhookUrlError)
  })

  it("accepts a public HTTPS destination and preserves every validated address", async () => {
    await expect(
      resolvePublicWebhookUrl("https://hooks.example.test/legislation", async () => [{ address: "8.8.8.8", family: 4 }])
    ).resolves.toMatchObject({ addresses: [{ address: "8.8.8.8", family: 4 }], url: expect.any(URL) })
  })

  it("requires an explicit DNS revalidation boundary before connection retries", async () => {
    let resolutions = 0
    const destination = await resolvePublicWebhookUrl("https://hooks.example.test/legislation", async () => {
      resolutions += 1
      return [{ address: "8.8.8.8", family: 4 }]
    })

    const refreshed = await destination.revalidate()
    expect(resolutions).toBe(2)
    expect(refreshed.addresses).toEqual([{ address: "8.8.8.8", family: 4 }])
  })

  it("uses timestamped, constant-time-verifiable signatures", () => {
    const timestamp = "2026-08-24T12:00:00.000Z"
    const rawBody = '{"id":"delivery:1"}'
    const signed = signWebhookPayload(timestamp, rawBody, "webhook-key:1", "secret")

    expect(formatWebhookSignature([signed])).toMatch(/^v1;kid=webhook-key:1;sig=/)
    expect(verifyWebhookSignature(timestamp, rawBody, "secret", signed.signature, new Date(timestamp))).toBe(true)
    expect(verifyWebhookSignature(timestamp, rawBody, "wrong", signed.signature, new Date(timestamp))).toBe(false)
    expect(
      verifyWebhookSignature(timestamp, rawBody, "secret", signed.signature, new Date("2026-08-24T12:06:00.000Z"))
    ).toBe(false)
  })
})
