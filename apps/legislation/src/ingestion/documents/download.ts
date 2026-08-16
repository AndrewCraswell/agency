import { MAX_DOCUMENT_BYTES } from "./extract.js"

const supportedMediaTypes = new Set([
  "application/pdf",
  "application/xhtml+xml",
  "application/xml",
  "text/html",
  "text/plain",
  "text/xml"
])

export interface DownloadedDocument {
  bytes: Uint8Array
  contentType: string
  sourceUrl: string
}

export async function downloadDocument(
  sourceUrl: string,
  options: { allowHttp?: boolean; fetch?: typeof fetch; maximumBytes?: number; timeoutMs?: number } = {}
): Promise<DownloadedDocument> {
  const url = new URL(sourceUrl)
  if (url.protocol !== "https:" && !(options.allowHttp === true && url.protocol === "http:")) {
    throw new Error("Document URL must use HTTPS")
  }
  const maximumBytes = options.maximumBytes ?? MAX_DOCUMENT_BYTES
  const response = await (options.fetch ?? fetch)(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(options.timeoutMs ?? 30_000)
  })
  if (!response.ok) {
    throw new Error(`Document download failed with HTTP ${response.status}`)
  }
  const finalUrl = new URL(response.url)
  if (finalUrl.protocol !== "https:" && !(options.allowHttp === true && finalUrl.protocol === "http:")) {
    throw new Error("Document redirect changed to an unsupported protocol")
  }

  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error(`Document exceeds the ${maximumBytes} byte limit`)
  }
  const contentType = response.headers.get("content-type") ?? ""
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? ""
  if (!supportedMediaTypes.has(mediaType) && !mediaType.endsWith("+xml")) {
    throw new Error(`Unsupported document content type: ${contentType || "missing"}`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > maximumBytes) {
    throw new Error(`Document exceeds the ${maximumBytes} byte limit`)
  }
  return { bytes, contentType, sourceUrl: response.url }
}
