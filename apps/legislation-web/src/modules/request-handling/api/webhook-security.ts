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

type Ipv4Range = Readonly<{ network: number; prefixLength: number }>
type Ipv6Range = Readonly<{ network: bigint; prefixLength: number }>

/**
 * IANA special-purpose blocks which must never be reachable from a webhook.
 * This is deliberately a deny-list of non-global ranges rather than a list of
 * private RFC1918 space, because a webhook may run from infrastructure whose
 * egress can reach other special-purpose networks.
 */
const nonPublicIpv4Ranges: readonly Ipv4Range[] = [
  ipv4Range("0.0.0.0", 8),
  ipv4Range("10.0.0.0", 8),
  ipv4Range("100.64.0.0", 10),
  ipv4Range("127.0.0.0", 8),
  ipv4Range("169.254.0.0", 16),
  ipv4Range("172.16.0.0", 12),
  ipv4Range("192.0.0.0", 24),
  ipv4Range("192.0.2.0", 24),
  ipv4Range("192.31.196.0", 24),
  ipv4Range("192.52.193.0", 24),
  ipv4Range("192.88.99.0", 24),
  ipv4Range("192.168.0.0", 16),
  ipv4Range("192.175.48.0", 24),
  ipv4Range("198.18.0.0", 15),
  ipv4Range("198.51.100.0", 24),
  ipv4Range("203.0.113.0", 24),
  ipv4Range("224.0.0.0", 4),
  ipv4Range("240.0.0.0", 4)
]

const ipv4MappedIpv6 = ipv6Range("::ffff:0:0", 96)
const globalUnicastIpv6 = ipv6Range("2000::", 3)
const nonPublicIpv6Ranges: readonly Ipv6Range[] = [
  ipv6Range("::", 128),
  ipv6Range("::1", 128),
  ipv6Range("100::", 64),
  ipv6Range("2001::", 23),
  ipv6Range("2001:2::", 48),
  ipv6Range("2001:db8::", 32),
  ipv6Range("2002::", 16),
  ipv6Range("3fff::", 20),
  ipv6Range("fc00::", 7),
  ipv6Range("fe80::", 10),
  ipv6Range("ff00::", 8)
]

function ipv4Range(network: string, prefixLength: number): Ipv4Range {
  const value = ipv4Value(network)
  if (value === undefined) {
    throw new Error(`Invalid IPv4 special-purpose range: ${network}`)
  }
  return { network: value, prefixLength }
}

function ipv6Range(network: string, prefixLength: number): Ipv6Range {
  const value = ipv6Value(network)
  if (value === undefined) {
    throw new Error(`Invalid IPv6 special-purpose range: ${network}`)
  }
  return { network: value, prefixLength }
}

function ipv4Value(address: string): number | undefined {
  const parts = ipv4Parts(address)
  if (parts === undefined) {
    return undefined
  }
  const [first, second, third, fourth] = parts
  if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
    return undefined
  }
  return first * 16_777_216 + second * 65_536 + third * 256 + fourth
}

function ipv6Value(address: string): bigint | undefined {
  let normalized = address.toLowerCase()
  const finalColon = normalized.lastIndexOf(":")
  const lastPart = normalized.slice(finalColon + 1)
  if (lastPart.includes(".")) {
    const embeddedIpv4 = ipv4Value(lastPart)
    if (embeddedIpv4 === undefined || finalColon < 0) {
      return undefined
    }
    normalized = `${normalized.slice(0, finalColon)}:${Math.floor(embeddedIpv4 / 65_536).toString(16)}:${(
      embeddedIpv4 % 65_536
    ).toString(16)}`
  }
  const compression = normalized.split("::")
  if (compression.length > 2) {
    return undefined
  }
  const leftPart = compression[0]
  const rightPart = compression[1]
  if (leftPart === undefined || (compression.length === 2 && rightPart === undefined)) {
    return undefined
  }
  const left = leftPart === "" ? [] : leftPart.split(":")
  const right = compression.length === 1 || rightPart === "" ? [] : rightPart.split(":")
  const zeroCount = 8 - left.length - right.length
  if ((compression.length === 1 && zeroCount !== 0) || (compression.length === 2 && zeroCount < 1)) {
    return undefined
  }
  const groups = compression.length === 1 ? left : [...left, ...Array.from({ length: zeroCount }, () => "0"), ...right]
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
    return undefined
  }
  let result = 0n
  for (const group of groups) {
    result = result * 65_536n + BigInt(`0x${group}`)
  }
  return result
}

function isNonPublicIpv4(value: number): boolean {
  return nonPublicIpv4Ranges.some((range) => isInIpv4Range(value, range))
}

function isNonPublicIpv6(value: bigint): boolean {
  if (isInIpv6Range(value, ipv4MappedIpv6)) {
    return isNonPublicIpv4(Number(value % 4_294_967_296n))
  }
  return !isInIpv6Range(value, globalUnicastIpv6) || nonPublicIpv6Ranges.some((range) => isInIpv6Range(value, range))
}

function isInIpv4Range(value: number, range: Ipv4Range): boolean {
  const divisor = 2 ** (32 - range.prefixLength)
  return Math.floor(value / divisor) === Math.floor(range.network / divisor)
}

function isInIpv6Range(value: bigint, range: Ipv6Range): boolean {
  const divisor = 2n ** BigInt(128 - range.prefixLength)
  return value / divisor === range.network / divisor
}

export function isPublicWebhookAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) {
    const value = ipv4Value(address)
    return value !== undefined && !isNonPublicIpv4(value)
  }
  if (family === 6) {
    const value = ipv6Value(address)
    return value !== undefined && !isNonPublicIpv6(value)
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
    if (url.protocol !== "https:" || url.username.length > 0 || url.password.length > 0) {
      throw new UnsafeWebhookUrlError("Webhook URL must be credential-free HTTPS.")
    }
    if (url.port === "0") {
      throw new UnsafeWebhookUrlError("Webhook URL port must be from 1 through 65535.")
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
