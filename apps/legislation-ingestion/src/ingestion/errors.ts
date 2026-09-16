const MAX_ERROR_LENGTH = 2000

/** Keep diagnostic identities and causes, never SQL parameters or credential-bearing URLs. */
export function sanitizeIngestionMessage(message: string): string {
  return message
    .replace(/(?:Failed query:|\bparams:)[\s\S]*/i, "Database query failed")
    .replaceAll(/\b(?:https?|postgres(?:ql)?):\/\/[^\s<>"']+/gi, "[URL]")
    .replaceAll(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replaceAll(
      /\b(?:api[-_]?key|access[-_]?token|refresh[-_]?token|token|secret|password|authorization|connection[-_]?string)["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi,
      "[REDACTED]"
    )
    .replaceAll(/\btr_(?:prod|dev|stg)_[A-Za-z0-9_]+\b/g, "[REDACTED]")
    .slice(0, MAX_ERROR_LENGTH)
}

export function ingestionErrorSummary(error: unknown): string {
  const parts: string[] = []
  const seen = new Set<unknown>()
  let current = error
  while (current !== undefined && current !== null && !seen.has(current) && parts.length < 5) {
    seen.add(current)
    if (typeof current !== "object") {
      parts.push(sanitizeIngestionMessage(typeof current === "string" ? current : "Unknown ingestion error"))
      break
    }
    const message =
      "message" in current && typeof current.message === "string" ? current.message : "Unknown ingestion error"
    const name = "name" in current && typeof current.name === "string" ? current.name : "Error"
    const details: string[] = []
    if ("code" in current && typeof current.code === "string" && /^[A-Z0-9]{5}$/.test(current.code)) {
      details.push(`SQLSTATE ${current.code}`)
    }
    if (
      "constraint" in current &&
      typeof current.constraint === "string" &&
      /^[a-zA-Z0-9_]+$/.test(current.constraint)
    ) {
      details.push(`constraint ${current.constraint}`)
    }
    parts.push(
      `${sanitizeIngestionMessage(name).slice(0, 80)}: ${sanitizeIngestionMessage(message).slice(0, 300)}${details.length === 0 ? "" : ` (${details.join(", ")})`}`
    )
    current = "cause" in current ? current.cause : undefined
  }
  return parts.join("; caused by ").slice(0, MAX_ERROR_LENGTH) || "Unknown ingestion error"
}
