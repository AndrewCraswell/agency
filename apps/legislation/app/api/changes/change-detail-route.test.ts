import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleDocumentResourceRequest } = vi.hoisted(() => ({
  handleDocumentResourceRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("../../../src/server/next/document-resource-route-handler", () => ({ handleDocumentResourceRequest }))

import * as route from "./[changeId]/route"

type Method = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT"
type RouteModule = Readonly<Record<Method, (request: Request) => Promise<Response>>> & Readonly<{ runtime: "nodejs" }>

const methods: readonly Method[] = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
const url = "https://legislation.test/api/changes/change%3A1"

beforeEach(() => {
  handleDocumentResourceRequest.mockReset()
  handleDocumentResourceRequest.mockImplementation(async () => new Response("handled", { status: 200 }))
})

describe("change detail route handler", () => {
  it("delegates GET with the exact Request", async () => {
    const request = new Request(url)
    const response = await (route as RouteModule).GET(request)

    expect(await response.text()).toBe("handled")
    expect(handleDocumentResourceRequest).toHaveBeenCalledOnce()
    expect(handleDocumentResourceRequest).toHaveBeenCalledWith(request)
  })

  it("exports the node runtime and exact method surface", () => {
    expect((route as RouteModule).runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual([...methods, "runtime"].sort())
  })

  it.each(methods.filter((method) => method !== "GET"))("returns canonical not found for %s", async (method) => {
    const correlationId = `unsupported-${method.toLowerCase()}`
    const request = new Request(url, { headers: { "x-correlation-id": correlationId }, method })
    const response = await (route as RouteModule)[method](request)

    expect(response.status).toBe(404)
    expect(response.headers.get("x-correlation-id")).toBe(correlationId)
    expect(handleDocumentResourceRequest).not.toHaveBeenCalled()
  })
})
