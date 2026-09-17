import { expect, it, vi } from "vitest"
import { executeNextHttpApiHandler } from "./next/node-handler"
import { createRecordResolutionHandler, createRecordCollectionHandler } from "./record-resolution-routes"

it("returns explicit resolution outcomes and forwards canonical scope", async () => {
  const resolve = vi.fn<Parameters<typeof createRecordResolutionHandler>[0]>(async () => ({
    status: "ambiguous",
    matches: [{ id: "bill:us:116:hr:1" }, { id: "bill:us:117:hr:1" }]
  }))
  const input = { kind: "bill", identifier: "H.R. 1", jurisdictionId: "jurisdiction:us" }
  const response = await executeNextHttpApiHandler(
    new Request("http://localhost/api/records/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    }),
    createRecordResolutionHandler(resolve)
  )
  expect(response.status).toBe(200)
  expect(resolve).toHaveBeenCalledWith(input)
  expect((await response.json()).data.status).toBe("ambiguous")
})

it("rejects unsupported scope instead of silently ignoring it", async () => {
  const resolve = vi.fn<Parameters<typeof createRecordResolutionHandler>[0]>(async () => ({}))
  const response = await executeNextHttpApiHandler(
    new Request("http://localhost/api/records/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "material", identifier: "HR 1" })
    }),
    createRecordResolutionHandler(resolve)
  )
  expect(response.status).toBe(400)
  expect(resolve).not.toHaveBeenCalled()
})

it("forwards section window selection without dropping the text offset", async () => {
  const read = vi.fn<Parameters<typeof createRecordCollectionHandler>[0]>(async () => ({ items: [], truncated: false }))
  const input = {
    collection: "document-sections",
    recordId: "document:one",
    sectionId: "section:one",
    textOffset: 10000,
    limit: 1
  }
  const response = await executeNextHttpApiHandler(
    new Request("http://localhost/api/records/collection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    }),
    createRecordCollectionHandler(read)
  )
  expect(response.status).toBe(200)
  expect(read).toHaveBeenCalledWith(input)
})
