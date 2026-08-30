import { afterEach, describe, expect, it, vi } from "vitest"
import type { AdminClient, AdminRequest } from "./client.ts"
import { uploadAssets } from "./upload.ts"

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn<() => Promise<Buffer>>(async () => Buffer.from("image bytes"))
}))

const target = {
  parameters: [
    { name: "key", value: "uploads/image.png" },
    { name: "policy", value: "signed-policy" }
  ],
  resourceUrl: "staged://image.png",
  url: "https://uploads.example.com"
}

const staged = (overrides: Record<string, unknown> = {}) => ({
  stagedUploadsCreate: { stagedTargets: [target], userErrors: [], ...overrides }
})

const created = (overrides: Record<string, unknown> = {}) => ({
  fileCreate: {
    files: [{ fileStatus: "UPLOADED", id: "gid://shopify/MediaImage/1", image: null }],
    userErrors: [],
    ...overrides
  }
})

const status = (fileStatus = "READY", url: string | undefined = "https://cdn.example.com/image.png") => ({
  nodes: [{ fileStatus, id: "gid://shopify/MediaImage/1", image: url ? { url } : null }]
})

const fakeClient = (...responses: readonly unknown[]) => {
  const requests: AdminRequest<unknown>[] = []
  let responseIndex = 0
  const client: AdminClient = async <T>(request: AdminRequest<T>) => {
    requests.push(request as AdminRequest<unknown>)
    const response = responses[responseIndex]
    responseIndex += 1
    return request.schema.parse(response)
  }
  return { client, requests }
}

const respondToUpload = (init: ResponseInit = {}) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204, ...init }))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("uploadAssets", () => {
  it("stages image bytes before creating the file and returns its processed CDN URL", async () => {
    vi.useFakeTimers()
    const uploaded = respondToUpload()
    const { client, requests } = fakeClient(staged(), created(), status())
    const pending = uploadAssets(client, ["C:/assets/Badge.PNG"])
    await vi.runAllTimersAsync()

    await expect(pending).resolves.toEqual([{ name: "Badge.PNG", url: "https://cdn.example.com/image.png" }])
    expect(requests[0]?.variables).toEqual({
      input: [{ filename: "Badge.PNG", httpMethod: "POST", mimeType: "image/png", resource: "FILE" }]
    })
    expect(requests[1]?.variables).toEqual({
      files: [{ alt: "Badge.PNG", contentType: "IMAGE", originalSource: "staged://image.png" }]
    })
    const form = uploaded.mock.calls[0]?.[1]?.body as FormData
    expect([...form.keys()]).toEqual(["key", "policy", "file"])
  })

  it("rejects unsupported files before asking Shopify to stage them", async () => {
    const { client, requests } = fakeClient()

    await expect(uploadAssets(client, ["C:/assets/readme.txt"])).rejects.toThrow(
      "readme.txt is not an image this can host"
    )
    expect(requests).toHaveLength(0)
  })

  it("reports errors from both Shopify mutations", async () => {
    const stageFailure = fakeClient(staged({ userErrors: [{ field: ["input"], message: "Invalid image" }] }))
    await expect(uploadAssets(stageFailure.client, ["image.png"])).rejects.toThrow(
      "The upload was refused: Invalid image"
    )

    respondToUpload()
    const createFailure = fakeClient(
      staged(),
      created({ userErrors: [{ field: null, message: "Storage quota reached" }] })
    )
    await expect(uploadAssets(createFailure.client, ["image.png"])).rejects.toThrow(
      "The file was refused: Storage quota reached"
    )
  })

  it("fails when Shopify stages the wrong number of upload targets", async () => {
    const { client } = fakeClient(staged({ stagedTargets: [] }))

    await expect(uploadAssets(client, ["image.png"])).rejects.toThrow("Asked to host 1 images but the store staged 0")
  })

  it("reports a failed upload response before creating a Shopify file", async () => {
    respondToUpload({ status: 503, statusText: "Service Unavailable" })
    const { client, requests } = fakeClient(staged())

    await expect(uploadAssets(client, ["image.png"])).rejects.toThrow(
      "Uploading image.png returned 503 Service Unavailable"
    )
    expect(requests).toHaveLength(1)
  })

  it("uses the creation response URL when processing does not finish during polling", async () => {
    vi.useFakeTimers()
    respondToUpload()
    const waiting = status("PROCESSING", undefined)
    const { client } = fakeClient(
      staged(),
      created({
        files: [
          {
            fileStatus: "READY",
            id: "gid://shopify/MediaImage/1",
            image: { height: 80, url: "https://cdn.example.com/fallback.png", width: 80 }
          }
        ]
      }),
      ...Array.from({ length: 20 }, () => waiting)
    )
    const pending = uploadAssets(client, ["image.webp"])
    await vi.runAllTimersAsync()

    await expect(pending).resolves.toEqual([{ name: "image.webp", url: "https://cdn.example.com/fallback.png" }])
  })

  it("explains where to find a file whose URL remains unavailable", async () => {
    vi.useFakeTimers()
    respondToUpload()
    const waiting = status("PROCESSING", undefined)
    const { client } = fakeClient(staged(), created(), ...Array.from({ length: 20 }, () => waiting))
    const pending = uploadAssets(client, ["image.svg"])
    const failure = pending.catch((error: unknown) => error)
    await vi.runAllTimersAsync()

    await expect(failure).resolves.toMatchObject({
      message: "image.svg was stored but is still processing. Read its URL from Content, Files."
    })
  })
})
