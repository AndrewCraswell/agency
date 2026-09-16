import { describe, expect, it } from "vitest"
import { createPinnedWebhookVerificationTransport } from "./webhook-challenge-transport.js"
import { resolvePublicWebhookUrl } from "./webhook-security.js"

describe("pinned webhook verification transport", () => {
  it("revalidates DNS and connects only to the revalidated address while retaining the TLS hostname", async () => {
    let resolutions = 0
    const destination = await resolvePublicWebhookUrl("https://hooks.example.test/verify", async () => {
      resolutions += 1
      return [{ address: resolutions === 1 ? "8.8.8.8" : "1.1.1.1", family: 4 }]
    })
    const transport = createPinnedWebhookVerificationTransport(async (input) => {
      expect(input.address.address).toBe("1.1.1.1")
      expect(input.hostname).toBe("hooks.example.test")
      expect(input.port).toBe(443)
      expect(input.headers["legislation-signature"]).toMatch(/^v1;kid=webhook-key:1;sig=/)
      const body = JSON.parse(input.body) as { challenge: string }
      return { body: JSON.stringify({ challenge: body.challenge }), statusCode: 204 }
    })

    await expect(
      transport.verify({ destination, keyId: "webhook-key:1", secret: "A".repeat(43), webhookId: "webhook:one" })
    ).resolves.toBe(true)
    expect(resolutions).toBe(2)
  })

  it("preserves a non-default HTTPS port for the pinned connection", async () => {
    const destination = await resolvePublicWebhookUrl("https://hooks.example.test:8443/verify", async () => [
      { address: "8.8.8.8", family: 4 }
    ])
    const transport = createPinnedWebhookVerificationTransport(async (input) => {
      expect(input.address.address).toBe("8.8.8.8")
      expect(input.hostname).toBe("hooks.example.test")
      expect(input.port).toBe(8443)
      return { body: JSON.stringify({ challenge: challengeFromBody(input.body) }), statusCode: 200 }
    })

    await expect(
      transport.verify({ destination, keyId: "webhook-key:1", secret: "A".repeat(43), webhookId: "webhook:one" })
    ).resolves.toBe(true)
  })

  it("rejects redirects, malformed JSON, and a mismatched challenge", async () => {
    const destination = await resolvePublicWebhookUrl("https://hooks.example.test/verify", async () => [
      { address: "8.8.8.8", family: 4 }
    ])
    const redirect = createPinnedWebhookVerificationTransport(async () => ({ body: "", statusCode: 302 }))
    const mismatch = createPinnedWebhookVerificationTransport(async () => ({
      body: '{"challenge":"wrong"}',
      statusCode: 200
    }))
    await expect(
      redirect.verify({ destination, keyId: "webhook-key:1", secret: "A".repeat(43), webhookId: "webhook:one" })
    ).resolves.toBe(false)
    await expect(
      mismatch.verify({ destination, keyId: "webhook-key:1", secret: "A".repeat(43), webhookId: "webhook:one" })
    ).resolves.toBe(false)
  })
})

function challengeFromBody(body: string): string {
  const parsed: unknown = JSON.parse(body)
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected a verification challenge object")
  }
  const challenge = Reflect.get(parsed, "challenge")
  if (typeof challenge !== "string") {
    throw new Error("Expected a string verification challenge")
  }
  return challenge
}
