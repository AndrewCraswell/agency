export function sanitizeTelemetry(value: unknown, key = ""): unknown {
  const visited = new WeakSet<object>()
  function visit(input: unknown, field: string, depth: number): unknown {
    if (
      /token|secret|password|api[-_]?key|authorization|cookie|^headers$|^(billText|text|body|quote|sections|documents|responseBody)$/i.test(
        field
      )
    )
      return "[REDACTED]"
    if (depth > 8) return "[TRUNCATED]"
    if (typeof input === "string") {
      const redacted = input
        .replaceAll(/\b(?:Bearer|Basic)\s+[^\s]+/gi, "[REDACTED]")
        .replaceAll(/\b(?:sk-or-v1-|sk-lf-)[a-z0-9-]+/gi, "[REDACTED]")
        .replaceAll(/https?:\/\/[^\s"<>]+/gi, (candidate) => {
          try {
            const url = new URL(candidate)
            url.username = ""
            url.password = ""
            for (const parameter of url.searchParams.keys()) {
              if (/token|secret|password|key|signature|^sig$/i.test(parameter))
                url.searchParams.set(parameter, "[REDACTED]")
            }
            return url.toString()
          } catch {
            return "[INVALID URL]"
          }
        })
      return redacted.length > 2000 ? `${redacted.slice(0, 2000)}[TRUNCATED]` : redacted
    }
    if (typeof input !== "object" || input === null) return input
    if (visited.has(input)) return "[CIRCULAR]"
    visited.add(input)
    if (input instanceof Error) {
      return visit(
        { name: input.name, message: input.message, stack: input.stack, cause: input.cause },
        field,
        depth + 1
      )
    }
    if (Array.isArray(input)) return input.slice(0, 100).map((item) => visit(item, "", depth + 1))
    return Object.fromEntries(
      Object.entries(input)
        .slice(0, 100)
        .map(([childKey, child]) => [childKey, visit(child, childKey, depth + 1)])
    )
  }
  return visit(value, key, 0)
}
