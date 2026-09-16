import { describe, expect, it } from "vitest"
import {
  UnsafeWebhookUrlError,
  formatWebhookSignature,
  isPublicWebhookAddress,
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

  it("rejects IANA special-purpose and IPv4-mapped non-public addresses", () => {
    for (const address of [
      "100.64.0.1",
      "192.0.2.1",
      "198.51.100.1",
      "203.0.113.1",
      "::ffff:100.64.0.1",
      "::ffff:192.0.2.1",
      "2001:db8::1",
      "4000::1",
      "64:ff9b:1::1"
    ]) {
      expect(isPublicWebhookAddress(address)).toBe(false)
    }
    expect(isPublicWebhookAddress("8.8.8.8")).toBe(true)
    expect(isPublicWebhookAddress("2606:4700:4700::1111")).toBe(true)
  })

  it("rejects DNS answers in IANA special-purpose ranges", async () => {
    await expect(
      resolvePublicWebhookUrl("https://hooks.example.test/legislation", async () => [
        { address: "::ffff:100.64.0.1", family: 6 }
      ])
    ).rejects.toBeInstanceOf(UnsafeWebhookUrlError)
  })

  it("rejects port zero while preserving normalized default HTTPS ports", async () => {
    await expect(
      resolvePublicWebhookUrl("https://hooks.example.test:0/legislation", async () => [
        { address: "8.8.8.8", family: 4 }
      ])
    ).rejects.toMatchObject({ message: "Webhook URL port must be from 1 through 65535." })
    await expect(
      resolvePublicWebhookUrl("https://hooks.example.test:443/legislation", async () => [
        { address: "8.8.8.8", family: 4 }
      ])
    ).resolves.toMatchObject({ url: expect.objectContaining({ port: "" }) })
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
