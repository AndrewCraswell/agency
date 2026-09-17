import { parseSpecStreamLine } from "@json-render/core"

export type CompositionDiagnostic =
  | {
      type: "invalid"
      reason: "Malformed presentation fence." | "Empty presentation fence." | "Unterminated presentation fence."
    }
  | { type: "closed" }

export function createCompositionDiagnostics() {
  let line = ""
  let oversized = false
  let inFence = false
  let hasPatch = false
  let reported = false

  function invalid(reason: Extract<CompositionDiagnostic, { type: "invalid" }>["reason"]): CompositionDiagnostic[] {
    if (reported) {
      return []
    }
    reported = true
    return [{ type: "invalid", reason }]
  }

  function completeLine(): CompositionDiagnostic[] {
    const value = line.trim()
    const wasOversized = oversized
    line = ""
    oversized = false
    if (!inFence) {
      if (value.startsWith("```spec")) {
        inFence = true
        hasPatch = false
        reported = false
      }
      return []
    }
    if (value === "```" && !wasOversized) {
      const diagnostics = hasPatch ? [] : invalid("Empty presentation fence.")
      inFence = false
      return [...diagnostics, { type: "closed" }]
    }
    if (!value && !wasOversized) {
      return []
    }
    if (wasOversized || !parseSpecStreamLine(value)) {
      return invalid("Malformed presentation fence.")
    }
    hasPatch = true
    return []
  }

  return {
    push(text: string) {
      const events: { end: number; diagnostic: CompositionDiagnostic }[] = []
      for (let index = 0; index < text.length; index += 1) {
        const character = text[index]
        if (character === "\n") {
          completeLine().forEach((diagnostic) => events.push({ end: index + 1, diagnostic }))
        } else if (line.length < 4096) {
          line += character
        } else {
          oversized = true
        }
      }
      return events
    },
    flush(isFinal = false) {
      const events = line || oversized ? completeLine() : []
      if (inFence && isFinal) {
        events.push(...invalid("Unterminated presentation fence."))
      }
      return events
    }
  }
}
