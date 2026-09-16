/** Deterministic source/budget blockers only; unknown, storage and tokenizer failures must remain retryable errors. */
export function legalPassagePreparationBlocker(error: unknown) {
  const reason = error instanceof Error ? error.message.replace(/^Invariant failed: /, "") : ""
  return /^(?:passage_table_[a-z_]+|legal_reader_[a-z_]+|passage_context_exhausts_budget)$/.test(reason) ? reason : null
}
