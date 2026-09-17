import { expect, it } from "vitest"
import { ZodError } from "zod"
import { validateLegalCodeResponse } from "./legal-codes-contract"

const id = "00000000-0000-4000-8000-000000000001"
const other = "00000000-0000-4000-8000-000000000002"
const current = { id: other, codeId: id, sourceId: "ecfr", issueDate: "2026-09-10", sourceCurrencyDate: "2026-09-11" }
const envelope = {
  data: {
    id,
    jurisdictionId: "jurisdiction:us",
    codeKey: "cfr-title-1",
    name: "Title 1",
    kind: "regulation",
    canonicalUrl: `/api/legal/codes/${id}`,
    updatedAt: "2026-09-15T00:00:00Z",
    sources: [{ sourceId: "ecfr", rightsProfileId: "official" }],
    editions: { publishedComponents: 3, current }
  },
  links: { self: `/api/legal/codes/${id}` },
  meta: { correlationId: "test", warnings: [] }
}
it("preserves current edition identity and distinct issue/currency dates", () => {
  expect(validateLegalCodeResponse(envelope, id).data.editions.current).toEqual(current)
  expect(
    validateLegalCodeResponse(
      { ...envelope, data: { ...envelope.data, editions: { publishedComponents: 3, current: null } } },
      id
    ).data.editions.current
  ).toBeNull()
})
it("rejects cross-code heads, unpublished counts and annual volumes presented as current eCFR", () => {
  expect(() =>
    validateLegalCodeResponse(
      {
        ...envelope,
        data: { ...envelope.data, editions: { publishedComponents: 3, current: { ...current, codeId: other } } }
      },
      id
    )
  ).toThrow("legal_code_response_mismatch")
  for (const editions of [
    { publishedComponents: 0, current },
    { publishedComponents: 1, current: { ...current, sourceId: "govinfo-cfr" } }
  ]) {
    expect(() => validateLegalCodeResponse({ ...envelope, data: { ...envelope.data, editions } }, id)).toThrow(ZodError)
  }
})
