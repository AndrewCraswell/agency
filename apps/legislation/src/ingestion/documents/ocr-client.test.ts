import { describe, expect, it, vi } from "vitest"
import { AzureDocumentIntelligenceClient, AzureDocumentIntelligenceError } from "./ocr-client.js"

const credential = { getToken: async () => ({ token: "test-token" }) }

describe("AzureDocumentIntelligenceClient", () => {
  it("submits source bytes and returns the prebuilt Read text, pages, and page count", async () => {
    let requestCount = 0
    const mockFetch = vi.fn<typeof fetch>(async () => {
      requestCount += 1
      if (requestCount === 1) {
        return new Response(null, {
          headers: { "operation-location": "https://ocr.example/operations/123?api-version=2024-11-30" },
          status: 202
        })
      }
      return Response.json({
        analyzeResult: {
          content: "Recognized legislative text",
          pages: [
            { pageNumber: 1, spans: [{ length: 11, offset: 0 }] },
            { pageNumber: 2, spans: [{ length: 16, offset: 11 }] }
          ]
        },
        status: "succeeded"
      })
    })
    const client = new AzureDocumentIntelligenceClient("https://ocr.example", {
      credential,
      fetch: mockFetch as typeof fetch,
      pollIntervalMs: 0
    })

    await expect(
      client.recognize({
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
        contentType: "application/pdf",
        documentId: "doc-1"
      })
    ).resolves.toEqual({
      pageCount: 2,
      pages: [
        { endOffset: 11, pageNumber: 1, startOffset: 0 },
        { endOffset: 27, pageNumber: 2, startOffset: 11 }
      ],
      provider: "azure-document-intelligence",
      text: "Recognized legislative text"
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: "Bearer test-token",
      "content-type": "application/json"
    })
    expect(new URL(String(mockFetch.mock.calls[0]?.[0])).searchParams.get("stringIndexType")).toBe("utf16CodeUnit")
    expect(JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body))).toEqual({ base64Source: "JVBERg==" })
  })

  it("omits page spans rather than guessing when Azure returns ambiguous layout spans", async () => {
    let requestCount = 0
    const client = new AzureDocumentIntelligenceClient("https://ocr.example", {
      credential,
      fetch: vi.fn<typeof fetch>(async () => {
        requestCount += 1
        return requestCount === 1
          ? new Response(null, {
              headers: { "operation-location": "https://ocr.example/operations/123?api-version=2024-11-30" },
              status: 202
            })
          : Response.json({
              analyzeResult: {
                content: "Recognized legislative text",
                pages: [
                  {
                    pageNumber: 1,
                    spans: [
                      { length: 10, offset: 0 },
                      { length: 10, offset: 11 }
                    ]
                  }
                ]
              },
              status: "succeeded"
            })
      }) as typeof fetch,
      pollIntervalMs: 0
    })

    await expect(
      client.recognize({ bytes: new Uint8Array([1]), contentType: "application/pdf", documentId: "doc-1" })
    ).resolves.toEqual({
      pageCount: 1,
      provider: "azure-document-intelligence",
      text: "Recognized legislative text"
    })
  })

  it("omits page spans whose provider offsets overflow or exceed OCR content", async () => {
    for (const span of [
      { length: 2, offset: Number.MAX_SAFE_INTEGER },
      { length: 100, offset: 0 }
    ]) {
      let requestCount = 0
      const client = new AzureDocumentIntelligenceClient("https://ocr.example", {
        credential,
        fetch: vi.fn<typeof fetch>(async () => {
          requestCount += 1
          return requestCount === 1
            ? new Response(null, {
                headers: { "operation-location": "https://ocr.example/operations/123?api-version=2024-11-30" },
                status: 202
              })
            : Response.json({
                analyzeResult: { content: "Recognized legislative text", pages: [{ pageNumber: 1, spans: [span] }] },
                status: "succeeded"
              })
        }) as typeof fetch,
        pollIntervalMs: 0
      })

      await expect(
        client.recognize({ bytes: new Uint8Array([1]), contentType: "application/pdf", documentId: "doc-1" })
      ).resolves.toEqual({
        pageCount: 1,
        provider: "azure-document-intelligence",
        text: "Recognized legislative text"
      })
    }
  })

  it("marks throttling as retryable and retains Retry-After", async () => {
    const client = new AzureDocumentIntelligenceClient("https://ocr.example", {
      credential,
      fetch: vi.fn<typeof fetch>(async () => new Response("busy", { headers: { "retry-after": "7" }, status: 429 })),
      pollIntervalMs: 0
    })

    const error = await client
      .recognize({ bytes: new Uint8Array([1]), contentType: "image/png", documentId: "doc-1" })
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(AzureDocumentIntelligenceError)
    expect(error).toMatchObject({ retryAfterMs: 7_000, retryable: true, status: 429 })
  })

  it("rejects an operation location on another origin", async () => {
    const client = new AzureDocumentIntelligenceClient("https://ocr.example", {
      credential,
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response(null, {
            headers: { "operation-location": "https://attacker.example/operations/123" },
            status: 202
          })
      ),
      pollIntervalMs: 0
    })

    await expect(
      client.recognize({ bytes: new Uint8Array([1]), contentType: "application/pdf", documentId: "doc-1" })
    ).rejects.toThrow("untrusted operation location")
  })
})
