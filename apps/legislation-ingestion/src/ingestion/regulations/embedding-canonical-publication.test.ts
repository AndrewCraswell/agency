import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParserContract, regulatoryRecordSchema } from "@repo/legislation-core/legal-text/parser-contract"
import { buildLegalTextProjection } from "@repo/legislation-core/legal-text/reader-text"
import { officialFederalRights } from "@repo/legislation-core/legal-text/storage-contract"
import { expect, it } from "vitest"
import { verifyEvaluationPublicationSnapshot } from "./embedding-canonical-publication.js"

function snapshot(html = false) {
  const body = "A complete publication with its exact source text."
  const blocks = html
    ? buildLegalTextProjection({ versionId: "fixture", body, blocks: [] }).blocks
    : regulatoryRecordSchema.shape.blocks.parse([
        { ordinal: 0, kind: "text", tag: "P", text: body, xml: `<P>${body}</P>` }
      ])
  const row = {
    observation_id: "00000000-0000-4000-8000-000000000001",
    document_id: "00000000-0000-4000-8000-000000000002",
    version_id: "00000000-0000-4000-8000-000000000003",
    content_hash: html
      ? digest(JSON.stringify(["fr-publication-input-2026-09-14", "html_preformatted", digest(body)]))
      : digest(JSON.stringify([regulatoryParserContract, "Notice", body, blocks, "notice"])),
    pdf_hash: "b".repeat(64),
    source_id: "govinfo-fr",
    jurisdiction_id: "jurisdiction:us",
    generation_id: "a".repeat(64),
    publication_date: "2026-01-01",
    source_locator: "https://www.govinfo.gov/example",
    metadata: {
      document_number: "2026-1",
      metadata_basis: "reviewed_fields",
      original_candidate: { rin: "unapproved" }
    },
    rights_profile_id: "official",
    policy: officialFederalRights,
    policy_hash: digest(JSON.stringify(officialFederalRights)),
    body,
    blocks,
    heading: "Notice",
    publication_kind: "notice",
    input_contract: html ? "fr-html-publication-2026-09-14" : "fr-source-publication-2026-09-15",
    context: "jurisdiction:us\nGPO\n2026-1\nnotice\nNotice"
  }
  return {
    row,
    selection: { observationId: row.observation_id, versionId: row.version_id, contentHash: row.content_hash }
  }
}

it.each([false, true])("verifies canonical content using the actual publication format (HTML=%s)", (html) => {
  const { row, selection } = snapshot(html)
  const result = verifyEvaluationPublicationSnapshot(row, selection)
  expect(result.input.body).toBe(row.body)
  expect(result.input.blocks).toEqual(row.blocks)
  expect(result.provenance).toMatchObject({
    observationId: row.observation_id,
    documentId: row.document_id,
    pdfHash: row.pdf_hash,
    publicationDate: row.publication_date,
    publicationKind: "notice",
    metadata: row.metadata,
    metadataHash: digest(JSON.stringify(row.metadata))
  })
})

it.each([false, true])("rejects changed content in each storage format (HTML=%s)", (html) => {
  const { row, selection } = snapshot(html)
  const body = row.body + " Changed."
  const blocks = html
    ? buildLegalTextProjection({ versionId: "fixture", body, blocks: [] }).blocks
    : regulatoryRecordSchema.shape.blocks.parse([
        { ordinal: 0, kind: "text", tag: "P", text: body, xml: `<P>${body}</P>` }
      ])
  expect(() => verifyEvaluationPublicationSnapshot({ ...row, body, blocks }, selection)).toThrow(
    "evaluation_publication_content_mismatch"
  )
})

it.each(["observationId", "versionId", "contentHash"] as const)("rejects mismatched %s", (field) => {
  const { row, selection } = snapshot()
  expect(() =>
    verifyEvaluationPublicationSnapshot(row, {
      ...selection,
      [field]: field === "contentHash" ? "c".repeat(64) : "00000000-0000-4000-8000-000000000004"
    })
  ).toThrow("evaluation_publication_selection_mismatch")
})

it.each(["displayText", "localSearch", "embeddings", "exports"] as const)("rejects revoked %s rights", (field) => {
  const { row, selection } = snapshot()
  const policy = { ...row.policy, [field]: false }
  expect(() =>
    verifyEvaluationPublicationSnapshot({ ...row, policy, policy_hash: digest(JSON.stringify(policy)) }, selection)
  ).toThrow()
})

it("rejects policy tampering, unsupported formats and oversized context", () => {
  const { row, selection } = snapshot()
  expect(() => verifyEvaluationPublicationSnapshot({ ...row, policy_hash: "c".repeat(64) }, selection)).toThrow(
    "evaluation_publication_rights_hash_mismatch"
  )
  for (const changed of [
    { input_contract: "unknown" },
    { context: "x".repeat(16001) },
    { source_id: "state-vendor" }
  ]) {
    expect(() => verifyEvaluationPublicationSnapshot({ ...row, ...changed }, selection)).toThrow()
  }
})
