import { presentationReferenceSchema } from "./composition"
import type { EntityPage } from "./entityResults"
import { resultStore } from "./resultStore"

export function createPresentationRecords(sessionKey: string, store = resultStore) {
  const resultIds = new Set<string>()
  return {
    register(page: EntityPage) {
      resultIds.add(page.id)
    },
    resolve(reference: unknown) {
      const selection = presentationReferenceSchema.parse(reference)
      if (!resultIds.has(selection.resultId)) {
        throw new Error("The record was not retrieved in this response.")
      }
      return store.record(sessionKey, selection.resultId, selection.recordId)
    }
  }
}
