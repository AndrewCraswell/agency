import { beforeEach, describe, expect, it, vi } from "vitest"

const { handleNx03aRequest } = vi.hoisted(() => ({
  handleNx03aRequest: vi.fn<(request: Request) => Promise<Response>>()
}))

vi.mock("legislation/server/next/nx03a", () => ({ handleNx03aRequest }))

import * as amendments from "./[personId]/amendments/route"
import * as bills from "./[personId]/bills/route"
import * as memberships from "./[personId]/memberships/route"
import * as detail from "./[personId]/route"
import * as term from "./[personId]/terms/[termId]/route"
import * as votes from "./[personId]/votes/route"
import * as collection from "./route"

type Method = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT"

type RouteModule = Readonly<{
  DELETE: (request: Request) => Promise<Response>
  GET: (request: Request) => Promise<Response>
  HEAD: (request: Request) => Promise<Response>
  OPTIONS: (request: Request) => Promise<Response>
  PATCH: (request: Request) => Promise<Response>
  POST: (request: Request) => Promise<Response>
  PUT: (request: Request) => Promise<Response>
  runtime: "nodejs"
}>

type RouteCase = Readonly<{
  name: string
  route: RouteModule
  url: string
}>

const methods: readonly Method[] = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]

const routes: readonly RouteCase[] = [
  {
    name: "collection",
    route: collection,
    url: "https://legislation.test/api/people?limit=1"
  },
  {
    name: "detail",
    route: detail,
    url: "https://legislation.test/api/people/person%3Aus%3Aexample"
  },
  {
    name: "bills",
    route: bills,
    url: "https://legislation.test/api/people/person%3Aus%3Aexample/bills?limit=1"
  },
  {
    name: "amendments",
    route: amendments,
    url: "https://legislation.test/api/people/person%3Aus%3Aexample/amendments?limit=1"
  },
  {
    name: "votes",
    route: votes,
    url: "https://legislation.test/api/people/person%3Aus%3Aexample/votes?limit=1"
  },
  {
    name: "memberships",
    route: memberships,
    url: "https://legislation.test/api/people/person%3Aus%3Aexample/memberships?limit=1"
  },
  {
    name: "term",
    route: term,
    url: "https://legislation.test/api/people/person%3Aus%3Aexample/terms/term%3Aus%3A2025"
  }
]

beforeEach(() => {
  handleNx03aRequest.mockReset()
  handleNx03aRequest.mockImplementation(
    async (request) => new Response(JSON.stringify({ delegatedUrl: request.url }), { status: 200 })
  )
})

describe("NX-03A people route handlers", () => {
  it.each(routes)("delegates the $name URL and exact Request unchanged", async ({ route, url }) => {
    const request = new Request(url, { headers: { "x-correlation-id": "route-test" } })
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ delegatedUrl: url })
    expect(handleNx03aRequest).toHaveBeenCalledOnce()
    expect(handleNx03aRequest).toHaveBeenCalledWith(request)
    expect(handleNx03aRequest.mock.calls[0]?.[0]).toBe(request)
  })

  it("keeps the static people collection distinct from the dynamic person route", async () => {
    const collectionRequest = new Request("https://legislation.test/api/people")
    const detailRequest = new Request("https://legislation.test/api/people/person%3Aus%3Aexample")

    await collection.GET(collectionRequest)
    await detail.GET(detailRequest)

    expect(handleNx03aRequest).toHaveBeenCalledTimes(2)
    expect(handleNx03aRequest.mock.calls[0]?.[0]).toBe(collectionRequest)
    expect(handleNx03aRequest.mock.calls[0]?.[0].url).toBe(collectionRequest.url)
    expect(handleNx03aRequest.mock.calls[1]?.[0]).toBe(detailRequest)
    expect(handleNx03aRequest.mock.calls[1]?.[0].url).toBe(detailRequest.url)
  })

  it.each(routes)("exports node runtime and the exact method surface for $name", ({ route }) => {
    expect(route.runtime).toBe("nodejs")
    expect(Object.keys(route).sort()).toEqual([...methods, "runtime"].sort())
  })

  it.each(
    routes.flatMap(({ name, route, url }) =>
      methods.filter((method) => method !== "GET").map((method) => ({ method, name, route, url }))
    )
  )("returns the canonical not-found response for $method $name", async ({ method, name, route, url }) => {
    const correlationId = `unsupported-${method.toLowerCase()}-${name}`
    const request = new Request(url, { headers: { "x-correlation-id": correlationId }, method })
    const response = await route[method](request)

    expect(response.status).toBe(404)
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-correlation-id")).toBe(correlationId)
    const expectedBody =
      method === "HEAD"
        ? ""
        : JSON.stringify({
            error: {
              category: "not_found",
              correlationId,
              message: "API route was not found",
              retryable: false
            }
          })
    await expect(response.text()).resolves.toBe(expectedBody)
    expect(handleNx03aRequest).not.toHaveBeenCalled()
  })

  it.each(routes)("passes a trailing slash unchanged to NX-03A for $name", async ({ route, url }) => {
    const queryStart = url.indexOf("?")
    const trailingSlashUrl = queryStart === -1 ? `${url}/` : `${url.slice(0, queryStart)}/${url.slice(queryStart)}`
    const request = new Request(trailingSlashUrl)
    const response = await route.GET(request)

    expect(response.status).toBe(200)
    expect(handleNx03aRequest).toHaveBeenCalledOnce()
    expect(handleNx03aRequest).toHaveBeenCalledWith(request)
    expect(handleNx03aRequest.mock.calls[0]?.[0]).toBe(request)
    expect(handleNx03aRequest.mock.calls[0]?.[0].url).toBe(trailingSlashUrl)
  })
})
