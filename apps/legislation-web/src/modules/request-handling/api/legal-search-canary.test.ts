import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import pg from "pg"
import { afterAll, beforeEach, expect, it, vi } from "vitest"
import { createLegalSearchCanary } from "./legal-search-canary"
const mocks = vi.hoisted(() => ({
  search: vi.fn<typeof import("@repo/legislation-core/legal-text/passage-search").searchCopiedLegalPassages>()
}))
vi.mock("@repo/legislation-core/legal-text/passage-search", () => ({ searchCopiedLegalPassages: mocks.search }))
const source = new pg.Pool()
const target = new pg.Pool()
afterAll(async () => {
  await source.end()
  await target.end()
})
beforeEach(() => vi.resetAllMocks())
const input = {
  scope: {
    kind: "provision",
    versionId: "00000000-0000-4000-8000-000000000001",
    editionId: "00000000-0000-4000-8000-000000000002"
  },
  generationId: "a".repeat(64),
  preparationId: "b".repeat(64),
  query: "financial"
}
const identity = { organizationId: "org-approved", userId: "user-approved" }
it("rejects absent identity, unapproved accounts and caller-supplied identity before any database search", async () => {
  const search = createLegalSearchCanary(source, target, [identity.organizationId])
  await expect(search(input)).rejects.toMatchObject({ category: "unauthorized" })
  await expect(
    runWithRequestContext({ correlationId: "test", identity: { ...identity, organizationId: "other" } }, () =>
      search(input)
    )
  ).rejects.toMatchObject({ category: "forbidden" })
  await expect(
    runWithRequestContext({ correlationId: "test", identity }, () =>
      search({ ...input, organizationId: identity.organizationId })
    )
  ).rejects.toThrow(/unrecognized/i)
  expect(mocks.search).not.toHaveBeenCalled()
})
it("captures the configured account allowlist and requires an acknowledged API-rights read", async () => {
  const allowed = [identity.organizationId]
  const search = createLegalSearchCanary(source, target, allowed)
  allowed.push("injected-org")
  await expect(
    runWithRequestContext({ correlationId: "test", identity: { ...identity, organizationId: "injected-org" } }, () =>
      search(input)
    )
  ).rejects.toMatchObject({ category: "forbidden" })
  mocks.search.mockResolvedValue([])
  expect(await runWithRequestContext({ correlationId: "test", identity }, () => search(input))).toEqual([])
  expect(mocks.search).toHaveBeenCalledWith(source, target, { ...input, apiAccess: true })
  await expect(
    runWithRequestContext({ correlationId: "test", identity }, () => search({ ...input, preparationId: undefined }))
  ).rejects.toThrow(/string/i)
})
it("returns a generic denial for restricted source policy without masking infrastructure failures", async () => {
  const search = createLegalSearchCanary(source, target, [identity.organizationId])
  mocks.search.mockRejectedValueOnce(new Error("rights_denied:territory"))
  await expect(runWithRequestContext({ correlationId: "test", identity }, () => search(input))).rejects.toMatchObject({
    category: "forbidden",
    message: "Access denied"
  })
  const failure = new Error("database unavailable")
  mocks.search.mockRejectedValueOnce(failure)
  await expect(runWithRequestContext({ correlationId: "test", identity }, () => search(input))).rejects.toBe(failure)
})
