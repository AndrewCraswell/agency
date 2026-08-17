import { load } from "cheerio"
import { MAX_DOCUMENT_BYTES } from "./extract.js"

const supportedMediaTypes = new Set([
  "application/pdf",
  "application/xhtml+xml",
  "application/xml",
  "text/html",
  "text/plain",
  "text/xml"
])

export function detectDocumentContentType(bytes: Uint8Array, declaredContentType = ""): string {
  const declaredMediaType = declaredContentType.split(";", 1)[0]?.trim().toLowerCase() ?? ""
  const prefixBytes = bytes.subarray(0, Math.min(bytes.byteLength, 512))
  const prefix = new TextDecoder("utf-8", { fatal: false }).decode(prefixBytes).trimStart().toLowerCase()
  if (prefix.startsWith("%pdf-")) {
    return "application/pdf"
  }
  if (
    prefix.startsWith("<!doctype html") ||
    prefix.startsWith("<html") ||
    prefix.startsWith("<head") ||
    prefix.startsWith("<body")
  ) {
    if (declaredMediaType === "application/pdf") {
      throw new Error("Document response contains HTML instead of advertised PDF")
    }
    return "text/html"
  }
  if (prefix.startsWith("<?xml")) {
    return "application/xml"
  }
  if (supportedMediaTypes.has(declaredMediaType) || declaredMediaType.endsWith("+xml")) {
    return declaredContentType
  }
  const containsNull = prefixBytes.includes(0)
  const printableBytes = prefixBytes.filter(
    (value) => value === 9 || value === 10 || value === 13 || (value >= 32 && value !== 127)
  ).length
  if (!containsNull && prefixBytes.length > 0 && printableBytes / prefixBytes.length >= 0.9) {
    return "text/plain"
  }
  throw new Error(`Unsupported document content type: ${declaredContentType || "missing"}`)
}

export interface DownloadedDocument {
  bytes: Uint8Array
  contentType: string
  sourceUrl: string
}

async function resolveCaliforniaBillPdf(
  response: Response,
  sourceUrl: URL,
  fetcher: typeof fetch,
  timeoutMs: number
): Promise<Response> {
  if (
    sourceUrl.hostname !== "leginfo.legislature.ca.gov" ||
    sourceUrl.pathname !== "/faces/billPdf.xhtml" ||
    !response.headers.get("content-type")?.toLowerCase().startsWith("text/html")
  ) {
    return response
  }
  const $ = load(await response.text(), { xml: true })
  const form = $("form#downloadForm")
  const viewState = form.find('input[name="javax.faces.ViewState"]').attr("value")
  const billId = sourceUrl.searchParams.get("bill_id")
  const version = sourceUrl.searchParams.get("version")
  if (viewState === undefined || billId === null || version === null) {
    throw new Error("California bill PDF download form is incomplete")
  }
  const action = form.attr("action") ?? sourceUrl.pathname
  const body = new URLSearchParams({
    "javax.faces.ViewState": viewState,
    bill_id: billId,
    downloadForm: "downloadForm",
    pdf_link2: "pdf_link2",
    version
  })
  return fetcher(new URL(action, sourceUrl), {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: response.headers.get("set-cookie") ?? ""
    },
    method: "POST",
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  })
}

export async function downloadDocument(
  sourceUrl: string,
  options: { allowHttp?: boolean; fetch?: typeof fetch; maximumBytes?: number; timeoutMs?: number } = {}
): Promise<DownloadedDocument> {
  const url = new URL(sourceUrl)
  if (url.protocol === "http:" && options.allowHttp !== true) {
    url.protocol = "https:"
  } else if (url.protocol !== "https:" && !(options.allowHttp === true && url.protocol === "http:")) {
    throw new Error("Document URL must use HTTPS")
  }
  const maximumBytes = options.maximumBytes ?? MAX_DOCUMENT_BYTES
  const fetcher = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 30_000
  const initialResponse = await fetcher(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  })
  const response = await resolveCaliforniaBillPdf(initialResponse, url, fetcher, timeoutMs)
  if (!response.ok) {
    throw new Error(`Document download failed with HTTP ${response.status}`)
  }
  const finalUrl = new URL(response.url || url)
  if (finalUrl.protocol !== "https:" && !(options.allowHttp === true && finalUrl.protocol === "http:")) {
    throw new Error("Document redirect changed to an unsupported protocol")
  }

  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error(`Document exceeds the ${maximumBytes} byte limit`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > maximumBytes) {
    throw new Error(`Document exceeds the ${maximumBytes} byte limit`)
  }
  const contentType = detectDocumentContentType(bytes, response.headers.get("content-type") ?? "")
  return { bytes, contentType, sourceUrl: finalUrl.href }
}
