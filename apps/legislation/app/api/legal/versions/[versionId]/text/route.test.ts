import { expect, it, vi } from "vitest"

const handlers = vi.hoisted(() => ({
  read: vi.fn<(request: Request) => Promise<Response>>(),
  missing: vi.fn<(request: Request) => Promise<Response>>()
}))
vi.mock("../../../../../../src/server/next/legal-route-handler", () => ({ handleLegalTextRequest: handlers.read }))
vi.mock("../../../../_shared", () => ({ notFoundResponse: handlers.missing }))
import * as route from "./route"

it("registers only the exact-text GET operation and sends other methods to the existing fallback", async () => {
  const request = new Request("https://api.example/api/legal/versions/00000000-0000-4000-8000-000000000001/text")
  handlers.read.mockResolvedValue(new Response("text"))
  handlers.missing.mockResolvedValue(new Response(null, { status: 404 }))
  expect(route.runtime).toBe("nodejs")
  expect(await (await route.GET(request)).text()).toBe("text")
  for (const method of [route.DELETE, route.HEAD, route.OPTIONS, route.PATCH, route.POST, route.PUT]) {
    expect((await method(request)).status).toBe(404)
  }
  expect(handlers.read).toHaveBeenCalledExactlyOnceWith(request)
  expect(handlers.missing).toHaveBeenCalledTimes(6)
})
