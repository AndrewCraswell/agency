import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParserContract, regulatoryRecordSchema } from "@repo/legislation-core/legal-text/parser-contract"
import {
  officialFederalRights,
  provisionContent,
  regulatoryStorageContract
} from "@repo/legislation-core/legal-text/storage-contract"
import { expect, it } from "vitest"
import { verifyEvaluationCodeSnapshot } from "./embedding-canonical-code.js"

function snapshot() {
  const body = "A complete source provision."
  const blocks = regulatoryRecordSchema.shape.blocks.parse([
    { ordinal: 0, kind: "text", tag: "P", text: body, xml: `<P>${body}</P>` }
  ])
  const row = {
    edition_id: "00000000-0000-4000-8000-000000000001",
    version_id: "00000000-0000-4000-8000-000000000002",
    content_hash: provisionContent({
      contract: regulatoryParserContract,
      nodeKind: "section",
      heading: "Scope",
      text: body,
      blocks
    }),
    source_id: "ecfr",
    jurisdiction_id: "jurisdiction:us",
    generation_id: "a".repeat(64),
    native_id: "cfr:3:section:1.1",
    source_locator: "title-3/section-1.1",
    currency_date: "2026-09-01",
    issue_date: null,
    rights_profile_id: "official",
    policy: officialFederalRights,
    policy_hash: digest(JSON.stringify(officialFederalRights)),
    body,
    blocks,
    heading: "Scope",
    node_kind: "section",
    input_contract: regulatoryStorageContract,
    language: "en",
    context: "US\nTitle 3\ncfr:3:section:1.1\nScope"
  }
  return { row, selection: { editionId: row.edition_id, versionId: row.version_id, contentHash: row.content_hash } }
}

it("binds complete canonical text, edition identity, source dates and rights to the prepared input", () => {
  const { row, selection } = snapshot()
  const result = verifyEvaluationCodeSnapshot(row, selection)
  expect(result.input).toEqual({
    versionId: row.version_id,
    body: row.body,
    blocks: row.blocks,
    inputContract: row.input_contract,
    context: row.context
  })
  expect(result.provenance).toMatchObject({
    editionId: selection.editionId,
    contentHash: selection.contentHash,
    currencyDate: row.currency_date,
    rightsHash: row.policy_hash,
    contextHash: digest(row.context)
  })
})

it.each(["editionId", "versionId", "contentHash"] as const)("rejects a mismatched requested %s", (field) => {
  const { row, selection } = snapshot()
  expect(() =>
    verifyEvaluationCodeSnapshot(row, {
      ...selection,
      [field]: field === "contentHash" ? "b".repeat(64) : "00000000-0000-4000-8000-000000000003"
    })
  ).toThrow("evaluation_code_selection_mismatch")
})

it.each(["embeddings", "exports", "displayText", "localSearch"] as const)(
  "rejects revoked %s rights even with an updated policy hash",
  (field) => {
    const { row, selection } = snapshot()
    const policy = { ...row.policy, [field]: false }
    expect(() =>
      verifyEvaluationCodeSnapshot({ ...row, policy, policy_hash: digest(JSON.stringify(policy)) }, selection)
    ).toThrow()
  }
)

it("rejects modified source content or rights with retained hashes", () => {
  const { row, selection } = snapshot()
  expect(() => verifyEvaluationCodeSnapshot({ ...row, heading: "Altered" }, selection)).toThrow(
    "evaluation_code_content_mismatch"
  )
  expect(() => verifyEvaluationCodeSnapshot({ ...row, policy_hash: "b".repeat(64) }, selection)).toThrow(
    "evaluation_code_rights_hash_mismatch"
  )
})

it("rejects unsupported source families, foreign jurisdictions and oversized context", () => {
  const { row, selection } = snapshot()
  for (const changed of [
    { source_id: "licensed-state" },
    { jurisdiction_id: "US-CA" },
    { context: "x".repeat(16001) },
    { input_contract: "unknown" }
  ]) {
    expect(() => verifyEvaluationCodeSnapshot({ ...row, ...changed }, selection)).toThrow()
  }
})
