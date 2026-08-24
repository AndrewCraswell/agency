import { createHash } from "node:crypto"

const defaultSimulatorPresentationUrl = "../simulator/"

type ReadinessReportInput = {
  circuitJson: readonly unknown[]
  criticalPartReadiness: readonly unknown[]
  readiness: object
}

function compareKeys(left: string, right: string) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function canonicalizeJson(value: unknown): string {
  if (value === null) return "null"

  if (typeof value === "string" || typeof value === "boolean") {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) throw new TypeError("Canonical artifact values must be serializable")
    return serialized
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical artifact numbers must be finite")
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) return `[${value.map(canonicalizeJson).join(",")}]`

  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new TypeError("Canonical artifact objects must be plain objects")
    }
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareKeys(left, right))
      .map(([key, entry]) => `${canonicalizeJson(key)}:${canonicalizeJson(entry)}`)
      .join(",")}}`
  }

  throw new TypeError("Canonical artifact values must be JSON data")
}

function canonicalize(value: unknown) {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new TypeError("Canonical artifact values must be serializable")
  return canonicalizeJson(JSON.parse(serialized))
}

export function createReadinessReport({ circuitJson, criticalPartReadiness, readiness }: ReadinessReportInput) {
  const artifactId = `sha256:${createHash("sha256")
    .update(
      canonicalize({
        circuitJson,
        criticalPartReadiness,
        readiness
      })
    )
    .digest("hex")}`

  return { artifactId, ...readiness }
}

export function resolveSimulatorPresentationUrl(environment: Readonly<Record<string, string | undefined>>) {
  const configuredOrigin = environment.SCORING_SIMULATOR_ORIGIN
  if (configuredOrigin === undefined) return defaultSimulatorPresentationUrl

  let origin: URL
  try {
    origin = new URL(configuredOrigin)
  } catch {
    throw new TypeError("SCORING_SIMULATOR_ORIGIN must be an absolute HTTP(S) origin")
  }

  if (
    (origin.protocol !== "http:" && origin.protocol !== "https:") ||
    origin.username.length > 0 ||
    origin.password.length > 0 ||
    origin.pathname !== "/" ||
    origin.search.length > 0 ||
    origin.hash.length > 0
  ) {
    throw new TypeError("SCORING_SIMULATOR_ORIGIN must be an absolute HTTP(S) origin without a path or credentials")
  }

  return `${origin.origin}/`
}
