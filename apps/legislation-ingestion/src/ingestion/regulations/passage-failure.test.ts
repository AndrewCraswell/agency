import { expect, it } from "vitest"
import { legalPassagePreparationBlocker } from "./passage-failure.js"

it.each(["passage_table_unresolved_ditto", "legal_reader_invalid_span", "passage_context_exhausts_budget"])(
  "records deterministic preparation blockers: %s",
  (reason) => {
    expect(legalPassagePreparationBlocker(new Error(reason))).toBe(reason)
    expect(legalPassagePreparationBlocker(new Error(`Invariant failed: ${reason}`))).toBe(reason)
  }
)

it.each([
  new Error("legal_preparation_lease_lost"),
  new Error("rights_profile_unavailable"),
  new Error("tokenizer_checksum_mismatch"),
  new Error("connection terminated"),
  new Error("passage_table_unresolved_ditto: unexpected detail"),
  "passage_table_unresolved_ditto",
  null
])("leaves infrastructure and unknown failures retryable: %s", (error) => {
  expect(legalPassagePreparationBlocker(error)).toBeNull()
})
