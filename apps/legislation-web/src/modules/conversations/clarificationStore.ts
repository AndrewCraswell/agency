import {
  clarificationInputSchema,
  clarificationResponseSchemaFor,
  type ClarificationInput,
  type ClarificationRequest,
  type ClarificationResponse
} from "./clarification"

type PendingClarification = {
  sessionKey: string
  request: ClarificationRequest
  expiresAt: number
  response?: ClarificationResponse
  hasResumed: boolean
}

export function createClarificationStore(now = Date.now) {
  const entries = new Map<string, PendingClarification>()

  function prune() {
    for (const [id, entry] of entries) {
      if (entry.expiresAt <= now()) {
        entries.delete(id)
      }
    }
  }

  function get(sessionKey: string, requestId: string) {
    prune()
    const entry = entries.get(requestId)
    if (!entry || entry.sessionKey !== sessionKey) {
      throw new Error("This question has expired. Send your question again.")
    }
    return entry
  }

  function supersede(sessionKey: string) {
    prune()
    for (const [id, entry] of entries) {
      if (entry.sessionKey === sessionKey) {
        entries.delete(id)
      }
    }
  }

  function create(sessionKey: string, input: ClarificationInput) {
    const parsed = clarificationInputSchema.parse(input)
    if (parsed.kind !== "text" && parsed.options.some((option) => option.recordId !== undefined)) {
      throw new Error("Record choices require grounded lookup and are not supported by this question tool.")
    }
    supersede(sessionKey)
    if (entries.size >= 256) {
      throw new Error("Clarification is temporarily unavailable.")
    }
    const request: ClarificationRequest = { id: crypto.randomUUID(), revision: 1, state: "pending", input: parsed }
    entries.set(request.id, { sessionKey, request, expiresAt: now() + 15 * 60 * 1000, hasResumed: false })
    return request
  }

  function answer(sessionKey: string, response: ClarificationResponse) {
    const entry = get(sessionKey, response.requestId)
    const accepted = clarificationResponseSchemaFor(entry.request).parse(response)
    if (entry.response && JSON.stringify(entry.response) !== JSON.stringify(accepted)) {
      throw new Error("This question has already been answered.")
    }
    entry.response = accepted
    return accepted
  }

  function resume(sessionKey: string, requestId: string) {
    const entry = get(sessionKey, requestId)
    if (!entry.response || entry.hasResumed) {
      throw new Error("This answer cannot start another response. Send a new question to continue.")
    }
    entry.hasResumed = true
    const response = entry.response
    const lines = [`Clarification question: ${entry.request.input.question}`]
    if (response.status === "skipped") {
      lines.push("I skipped this clarification. Do not assume an option was selected.")
    } else {
      if (entry.request.input.kind !== "text") {
        lines.push(
          ...entry.request.input.options
            .filter((option) => response.selectedIds.includes(option.id))
            .map((option) => option.label)
        )
      }
      if (response.text) {
        lines.push(response.text)
      }
    }
    return lines.join("\n")
  }

  return { create, answer, resume, supersede }
}

export const clarificationStore = createClarificationStore()
