import { randomBytes } from "node:crypto"
import type { LookupAddress } from "node:dns"
import { request as httpsRequest } from "node:https"
import { signWebhookPayload, type ApprovedWebhookDestination } from "./webhook-security.js"

export type WebhookVerificationAttempt = Readonly<{
  destination: ApprovedWebhookDestination
  keyId: string
  secret: string
  webhookId: string
}>

export type WebhookVerificationTransport = Readonly<{
  verify(input: WebhookVerificationAttempt): Promise<boolean>
}>

const timeoutMs = 10_000

/**
 * A verification transport pins its TCP connection to a freshly revalidated
 * public address. TLS SNI and HTTP Host retain the configured hostname, so a
 * DNS rebinding response cannot redirect the connection to a private host.
 */
export function createPinnedWebhookVerificationTransport(
  connect: (
    input: Readonly<{
      address: LookupAddress
      body: string
      headers: Readonly<Record<string, string>>
      hostname: string
      path: string
      port: number
    }>
  ) => Promise<Readonly<{ body: string; statusCode: number }>> = connectPinnedHttps
): WebhookVerificationTransport {
  return {
    verify: async (input) => {
      const destination = await input.destination.revalidate()
      const address = destination.addresses[0]
      if (address === undefined) {
        return false
      }
      const challenge = randomBytes(32).toString("base64url")
      const expiresAt = new Date(Date.now() + timeoutMs).toISOString()
      const body = JSON.stringify({ challenge, expiresAt, type: "webhook-verification", webhookId: input.webhookId })
      const timestamp = new Date().toISOString()
      const signature = signWebhookPayload(timestamp, body, input.keyId, input.secret)
      const response = await connect({
        address,
        body,
        headers: {
          "content-type": "application/json",
          "legislation-event-type": "webhook-verification",
          "legislation-signature": `v1;kid=${signature.keyId};sig=${signature.signature}`,
          "legislation-timestamp": timestamp
        },
        hostname: destination.url.hostname,
        path: `${destination.url.pathname}${destination.url.search}`,
        port: destinationPort(destination.url)
      })
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return false
      }
      try {
        const parsed: unknown = JSON.parse(response.body)
        return isExactChallengeResponse(parsed, challenge)
      } catch {
        return false
      }
    }
  }
}

function isExactChallengeResponse(value: unknown, challenge: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    (value as Record<string, unknown>).challenge === challenge
  )
}

async function connectPinnedHttps(
  input: Readonly<{
    address: LookupAddress
    body: string
    headers: Readonly<Record<string, string>>
    hostname: string
    path: string
    port: number
  }>
): Promise<Readonly<{ body: string; statusCode: number }>> {
  return await new Promise((resolve, reject) => {
    const request = httpsRequest({
      headers: { ...input.headers, host: hostHeader(input.hostname, input.port) },
      hostname: input.address.address,
      method: "POST",
      path: input.path,
      port: input.port,
      rejectUnauthorized: true,
      servername: input.hostname,
      timeout: timeoutMs
    })
    request.once("timeout", () => request.destroy(new Error("Webhook verification timed out.")))
    request.once("error", reject)
    request.once("response", (response) => {
      const chunks: Buffer[] = []
      let size = 0
      response.on("data", (chunk: Buffer) => {
        size += chunk.byteLength
        if (size > 16 * 1024) {
          response.destroy(new Error("Webhook verification response is too large."))
          return
        }
        chunks.push(chunk)
      })
      response.once("error", reject)
      response.once("end", () =>
        resolve({ body: Buffer.concat(chunks).toString("utf8"), statusCode: response.statusCode ?? 0 })
      )
    })
    request.end(input.body)
  })
}

function destinationPort(url: URL): number {
  return url.port.length === 0 ? 443 : Number(url.port)
}

function hostHeader(hostname: string, port: number): string {
  const authority = hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname
  return port === 443 ? authority : `${authority}:${port}`
}
