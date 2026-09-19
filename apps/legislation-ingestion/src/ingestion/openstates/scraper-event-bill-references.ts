import { jurisdictionId, legislativeSessionId } from "@repo/legislation-core/domain/identifiers"
import { z } from "zod"

/** Resolve only explicit, internally consistent Open States selectors, never mentions in agenda prose. */
export function scraperEventBillReferences(
  input: unknown,
  scope: { state: string; session: string; identifier: RegExp }
) {
  const entities = z.array(z.unknown()).safeParse(input)
  if (!entities.success) return []
  return entities.data.flatMap((entity) => {
    const reference = z
      .object({ entity_type: z.literal("bill"), bill_id: z.string(), name: z.string() })
      .safeParse(entity)
    if (!reference.success || !reference.data.bill_id.startsWith("~")) return []
    let selector: unknown
    try {
      selector = JSON.parse(reference.data.bill_id.slice(1))
    } catch {
      return []
    }
    const explicit = z.strictObject({ identifier: z.string().regex(scope.identifier) }).safeParse(selector)
    if (!explicit.success || explicit.data.identifier !== reference.data.name) return []
    return [
      {
        identifier: explicit.data.identifier,
        jurisdictionId: jurisdictionId(scope.state),
        sessionId: legislativeSessionId(scope.state, scope.session)
      }
    ]
  })
}
