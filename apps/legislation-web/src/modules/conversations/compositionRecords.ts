import { presentationReferenceSchema } from "./composition"
import type { EntityPage } from "./entityResults"
import { contentReferenceSchema, presentationContentSchema, type PresentationContent } from "./presentationContent"
import { resultStore } from "./resultStore"

export function createPresentationRecords(sessionKey: string, store = resultStore) {
  const resultIds = new Set<string>()
  const contents = new Map<string, PresentationContent>()
  return {
    registerContents(items: PresentationContent[]) {
      for (const item of items) {
        if (contents.has(item.id) || contents.size >= 1500) {
          throw new Error("Presentation content limit or duplicate ID")
        }
        contents.set(item.id, presentationContentSchema.parse(item))
      }
    },
    resolveContent(reference: unknown) {
      const { contentId } = contentReferenceSchema.parse(reference)
      const content = contents.get(contentId)
      if (!content) {
        throw new Error("The content was not retrieved in this response.")
      }
      return structuredClone(content)
    },
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
