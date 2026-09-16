import { digest } from "@repo/legislation-core/legal-text/contracts"
import pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { readLegalSearchResultPage } from "./legal-search-results.js"

const editionId = "00000000-0000-4000-8000-000000000001"
const snapshotId = "00000000-0000-4000-8000-000000000002"
const request = {
  requestHash: "a".repeat(64),
  generation: "b".repeat(64),
  editionIds: [editionId],
  query: "ethics",
  limit: 2
}
const candidate = (index: number) => ({
  id: digest(String(index)),
  editionId,
  generationId: "c".repeat(64),
  versionId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  score: 1 / (index + 1)
})
const candidates = [candidate(0), candidate(1), candidate(2)]
const candidateHash = digest(JSON.stringify(candidates))
const cursor = Buffer.from(JSON.stringify({ id: snapshotId, offset: 2, hash: candidateHash })).toString("base64url")
afterEach(() => vi.restoreAllMocks())
function fixture() {
  const client = Object.assign(new pg.Client(), { release: vi.fn<() => void>() })
  const query = vi.spyOn(client, "query")
  const rows = (values: unknown[] = []) =>
    query.mockImplementationOnce(async () => ({
      rows: values,
      command: "SELECT",
      rowCount: values.length,
      oid: 0,
      fields: []
    }))
  return { client, query, rows }
}

it("stores only ranked identities and returns continuation without storing source bodies", async () => {
  const f = fixture()
  f.rows(candidates)
  f.rows()
  f.rows()
  const result = await readLegalSearchResultPage(f.client, request)
  expect(result.candidates).toEqual(candidates.slice(0, 2))
  expect(result.nextCursor).toBeTruthy()
  expect(result.candidateSetTruncated).toBe(false)
  const insert = f.query.mock.calls[2]
  expect(insert?.[1]).toEqual([
    expect.any(String),
    request.requestHash,
    request.generation,
    JSON.stringify(candidates),
    candidateHash,
    false
  ])
})

it("continues the frozen order without ranking again", async () => {
  const f = fixture()
  f.rows([{ candidates, candidate_hash: candidateHash, window_truncated: false }])
  const result = await readLegalSearchResultPage(f.client, { ...request, cursor })
  expect(result.candidates).toEqual([candidate(2)])
  expect(result.nextCursor).toBeNull()
  expect(f.query).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("expires_at>clock_timestamp()"), [
    snapshotId,
    request.requestHash,
    request.generation
  ])
})

it("rejects missing, expired or differently bound snapshots", async () => {
  const f = fixture()
  f.rows()
  await expect(readLegalSearchResultPage(f.client, { ...request, cursor })).rejects.toMatchObject({
    category: "conflict"
  })
})

it("rejects modified snapshot contents even when their shape is still valid", async () => {
  const f = fixture()
  f.rows([
    { candidates: [candidate(2), candidate(1), candidate(0)], candidate_hash: candidateHash, window_truncated: false }
  ])
  await expect(readLegalSearchResultPage(f.client, { ...request, cursor })).rejects.toMatchObject({
    category: "conflict"
  })
})

it("bounds the frozen window and reports omitted candidates explicitly", async () => {
  const f = fixture()
  f.rows(Array.from({ length: 1001 }, (_, index) => candidate(index)))
  f.rows()
  f.rows()
  const result = await readLegalSearchResultPage(f.client, request)
  expect(result.candidateSetTruncated).toBe(true)
  expect(result.candidates).toHaveLength(2)
  expect(result.nextCursor).toBeTruthy()
})

it("does not persist a one-page result and rejects malformed cursors before SQL", async () => {
  const f = fixture()
  f.rows([candidate(0)])
  expect((await readLegalSearchResultPage(f.client, request)).nextCursor).toBeNull()
  expect(f.query).toHaveBeenCalledTimes(1)
  await expect(readLegalSearchResultPage(f.client, { ...request, cursor: "bad" })).rejects.toMatchObject({
    category: "invalid_request"
  })
  expect(f.query).toHaveBeenCalledTimes(1)
})
