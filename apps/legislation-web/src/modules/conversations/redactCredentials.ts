function redactUrlParameters(parameters: string) {
  return parameters
    .split("&")
    .filter(
      (parameter) =>
        !Array.from(new URLSearchParams(parameter).keys()).some((key) =>
          /token|secret|signature|password|credential|authorization|api.?key|session.?key|^sig$/i.test(key)
        )
    )
    .join("&")
}

function urlEnd(candidate: string) {
  let parentheses = 0
  let brackets = 0
  for (let index = 0; index < candidate.length; index++) {
    const character = candidate[index]
    if (character === "(") {
      parentheses++
    }
    if (character === "[") {
      brackets++
    }
    if (character === ")" && --parentheses < 0) {
      return index
    }
    if (character === "]" && --brackets < 0) {
      return index
    }
  }
  return candidate.length
}

function redactUrl(original: string) {
  if (!URL.canParse(original)) {
    return "[INVALID URL]"
  }
  // Filter raw parameters rather than serializing a URL, which rewrites public evidence links.
  return original
    .replace(/^(https?:\/\/)[^/?#]*@/i, "$1")
    .replace(/([?#])([^#]*)/g, (match, delimiter: string, parameters: string) => {
      const queryIndex = parameters.indexOf("?")
      const equalsIndex = parameters.indexOf("=")
      const hasFragmentQuery = delimiter === "#" && queryIndex >= 0 && (equalsIndex < 0 || queryIndex < equalsIndex)
      const prefix = hasFragmentQuery ? parameters.slice(0, queryIndex) : ""
      const query = hasFragmentQuery ? parameters.slice(queryIndex + 1) : parameters
      const redacted = redactUrlParameters(query)
      if (redacted === query) {
        return match
      }
      const remaining = prefix + (hasFragmentQuery && redacted ? "?" : "") + redacted
      return remaining ? delimiter + remaining : ""
    })
}

function redactUrls(text: string) {
  const urls = /https?:\/\/[^\s<>"']+/gi
  let result = ""
  let offset = 0
  for (let match = urls.exec(text); match; match = urls.exec(text)) {
    const candidate = match[0]
    const original = candidate.slice(0, urlEnd(candidate)).replace(/[.,;!?]+$/, "")
    result += text.slice(offset, match.index) + redactUrl(original)
    // Resume at the actual URL boundary so adjacent Markdown links are also inspected.
    offset = match.index + original.length
    urls.lastIndex = offset
  }
  return result + text.slice(offset)
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
