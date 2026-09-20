import { MAX_CONVERSATION_REFERENCES, type StagedReference } from "./chatRequest"
import { composerDraftText, composerReferences, type ComposerDraft } from "./composerDraft"

export type ComposerSubmissionBlockedReason = "unavailable" | "restoring" | "busy" | "reference_limit" | "empty"

export function composerSubmissionBlockedReason({
  draft,
  references = [],
  isAvailable,
  isRunning = false,
  isRestoring = false,
  isConfirmingClarification = false
}: Readonly<{
  draft: ComposerDraft
  references?: readonly StagedReference[]
  isAvailable: boolean
  isRunning?: boolean
  isRestoring?: boolean
  isConfirmingClarification?: boolean
}>): ComposerSubmissionBlockedReason | undefined {
  if (!isAvailable) {
    return "unavailable"
  }
  if (isRestoring) {
    return "restoring"
  }
  if (isRunning || isConfirmingClarification) {
    return "busy"
  }
  if (composerReferences(draft, references).length > MAX_CONVERSATION_REFERENCES) {
    return "reference_limit"
  }
  if (!composerDraftText(draft).trim()) {
    return "empty"
  }
  return undefined
}

export function canAddComposerReference(
  reference: StagedReference,
  draft: ComposerDraft,
  staged: readonly StagedReference[]
) {
  const references = composerReferences(draft, staged)
  return (
    references.length < MAX_CONVERSATION_REFERENCES ||
    references.some((item) => item.recordId === reference.recordId && item.record.kind === reference.record.kind)
  )
}
