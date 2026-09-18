function redactUrls(text: string) {
  return text.replace(/https?:\/\/[^\s<>"'[\]()]+/gi, (candidate) => {
    const suffix = candidate.match(/[.,;!?]+$/)?.[0] ?? ""
    const original = candidate.slice(0, candidate.length - suffix.length)
    try {
      const url = new URL(original)
      let changed = Boolean(url.username || url.password)
      url.username = ""
      url.password = ""
      const queryKeys = Array.from(url.searchParams.keys())
      for (const key of queryKeys) {
        if (/token|secret|signature|password|credential|authorization|api.?key|session.?key|^sig$/i.test(key)) {
          url.searchParams.delete(key)
          changed = true
        }
      }
      const fragment = new URLSearchParams(url.hash.slice(1))
      for (const key of Array.from(fragment.keys())) {
        if (/token|secret|signature|password|credential|authorization|api.?key|session.?key|^sig$/i.test(key)) {
          fragment.delete(key)
          url.hash = fragment.toString()
          changed = true
        }
      }
      return (changed ? url.toString() : original) + suffix
    } catch {
      return "[INVALID URL]"
    }
  })
}

export function redactCredentials(value: unknown): unknown {
  if (typeof value === "string") {
    return redactUrls(value)
      .replace(/\b(?:sk-or-v1-|sk-lf-)[a-z0-9-]+/gi, "[REDACTED]")
      .replace(/\bBearer\s+[a-z0-9._~+/-]+=*/gi, "[REDACTED]")
      .replace(/\bBasic\s+([a-z0-9+/]+={0,2})/gi, (match, encoded: string) => {
        try {
          return atob(encoded).includes(":") ? "[REDACTED]" : match
        } catch {
          return match
        }
      })
  }
  if (Array.isArray(value)) {
    return value.map(redactCredentials)
  }
  if (value !== null && typeof value === "object") {
    if (value instanceof Error) {
      return { name: value.name, message: redactCredentials(value.message) }
    }
    if (value instanceof Date) {
      return value.toISOString()
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/^(headers|authorization|cookie|set-cookie|password|secret|api.?key|access[_-]?token|refresh[_-]?token|sessionKey|.*secretKey|.*publicKey|reasoning(?:[_-]?(?:text|details|content))?)$/i.test(
              key
            )
        )
        .map(([key, item]) => [key, redactCredentials(item)])
    )
  }
  return value
}
