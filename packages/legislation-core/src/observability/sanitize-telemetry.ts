export function sanitizeTelemetry(value: unknown, key = ""): unknown {
  if (/token|secret|password|api[-_]?key|authorization/i.test(key)) {
    return "[REDACTED]"
  }
  if (typeof value === "string") {
    const redacted = value.replaceAll(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    return redacted.length > 2000 ? `${redacted.slice(0, 2000)}[TRUNCATED]` : redacted
  }
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeTelemetry(item))
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [childKey, sanitizeTelemetry(child, childKey)])
    )
  }
  return value
}
