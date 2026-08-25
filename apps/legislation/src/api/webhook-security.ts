import { createHmac, timingSafeEqual } from "node:crypto"
import type { LookupAddress } from "node:dns"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

export class UnsafeWebhookUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsafeWebhookUrlError"
  }
}

function ipv4Parts(address: string): readonly number[] | undefined {
  const parts = address.split(".")
  if (parts.length !== 4) {
    return undefined
  }
  const numbers = parts.map((part) => Number(part))
  return numbers.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? numbers : undefined
}

function isPrivateIpv4(address: string): boolean {
  const parts = ipv4Parts(address)
  if (parts === undefined) {
    return true
  }
  const [first, second] = parts
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second !== undefined && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  )
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:169.254.") ||
    normalized.startsWith("::ffff:192.168.") ||
    normalized.startsWith("::ffff:172.")
  )
}

export function isPublicWebhookAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) {
    return !isPrivateIpv4(address)
  }
  if (family === 6) {
    return !isPrivateIpv6(address)
  }
  return false
}

type WebhookResolver = (hostname: string) => Promise<readonly LookupAddress[]>

export class ApprovedWebhookDestination {
  readonly addresses: readonly LookupAddress[]
  readonly resolvedAt: Date
  readonly url: URL
  readonly #rawUrl: string
  readonly #resolve: WebhookResolver

  private constructor(
    input: Readonly<{
      addresses: readonly LookupAddress[]
      rawUrl: string
      resolve: WebhookResolver
      url: URL
    }>
  ) {
    this.addresses = input.addresses
    this.#rawUrl = input.rawUrl
    this.#resolve = input.resolve
    this.resolvedAt = new Date()
    this.url = input.url
  }

  /** Re-resolves and revalidates DNS immediately before a connection or retry. */
  async revalidate(): Promise<ApprovedWebhookDestination> {
    return await ApprovedWebhookDestination.resolve(this.#rawUrl, this.#resolve)
  }

  static async resolve(rawUrl: string, resolve: WebhookResolver): Promise<ApprovedWebhookDestination> {
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      throw new UnsafeWebhookUrlError("Webhook URL must be absolute.")
    }
    if (url.protocol !== "https:" || url.username.length > 0 || url.password.length > 0 || url.port === "443") {
      throw new UnsafeWebhookUrlError("Webhook URL must be credential-free HTTPS without an explicit default port.")
    }

    const addresses = await resolve(url.hostname)
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicWebhookAddress(address))) {
      throw new UnsafeWebhookUrlError("Webhook host resolves to a non-public address.")
    }
    return new ApprovedWebhookDestination({ addresses, rawUrl, resolve, url })
  }
}

export async function resolvePublicWebhookUrl(
  rawUrl: string,
  resolve: (hostname: string) => Promise<readonly LookupAddress[]> = async (hostname) =>
    await lookup(hostname, { all: true, verbatim: true })
): Promise<ApprovedWebhookDestination> {
  return await ApprovedWebhookDestination.resolve(rawUrl, resolve)
}

export type WebhookSignature = Readonly<{ keyId: string; signature: string }>

export function signWebhookPayload(
  timestamp: string,
  rawBody: string,
  keyId: string,
  secret: string
): WebhookSignature {
  return {
    keyId,
    signature: createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
  }
}

export function formatWebhookSignature(signatures: readonly WebhookSignature[]): string {
  return signatures.map(({ keyId, signature }) => `v1;kid=${keyId};sig=${signature}`).join(",")
}

export function verifyWebhookSignature(
  timestamp: string,
  rawBody: string,
  secret: string,
  signature: string,
  now: Date = new Date()
): boolean {
  const parsedTimestamp = Date.parse(timestamp)
  if (!Number.isFinite(parsedTimestamp) || Math.abs(now.getTime() - parsedTimestamp) > 5 * 60 * 1000) {
    return false
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
  const supplied = Buffer.from(signature, "hex")
  const expectedBuffer = Buffer.from(expected, "hex")
  return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer)
}
