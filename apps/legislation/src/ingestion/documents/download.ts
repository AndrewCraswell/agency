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

const CALIFORNIA_LEGINFO_HOST = "leginfo.legislature.ca.gov"
const CALIFORNIA_BILL_PDF_PATH = "/faces/billPdf.xhtml"
const ARKANSAS_LEGISLATURE_HOST = "www.arkleg.state.ar.us"
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36"

function isCaliforniaBillPdfUrl(url: URL): boolean {
  return url.hostname === CALIFORNIA_LEGINFO_HOST && url.pathname === CALIFORNIA_BILL_PDF_PATH
}

export function resolveApprovedDocumentUrl(sourceUrl: string): URL {
  const url = new URL(sourceUrl)
  if (url.protocol === "ftp:" && url.hostname === ARKANSAS_LEGISLATURE_HOST && url.pathname.startsWith("/Bills/")) {
    const resolved = new URL("https://www.arkleg.state.ar.us/Home/FTPDocument")
    resolved.searchParams.set("path", url.pathname)
    return resolved
  }
  return url
}

function cookieHeader(response: Response): string | undefined {
  const setCookies = response.headers.getSetCookie?.() ?? []
  const values = setCookies.length > 0 ? setCookies : [response.headers.get("set-cookie") ?? ""]
  const cookies = values.flatMap((value) => {
    const pair = value.split(";", 1)[0]?.trim()
    return pair === undefined || pair.length === 0 ? [] : [pair]
  })
  return cookies.length === 0 ? undefined : cookies.join("; ")
}

export function detectDocumentContentType(bytes: Uint8Array, declaredContentType = ""): string {
  const declaredMediaType = declaredContentType.split(";", 1)[0]?.trim().toLowerCase() ?? ""
  const prefixBytes = bytes.subarray(0, Math.min(bytes.byteLength, 512))
  const prefix = new TextDecoder("utf-8", { fatal: false }).decode(prefixBytes).trimStart().toLowerCase()
  if (prefix.startsWith("%pdf-")) {
    return "application/pdf"
  }
  if (prefixBytes.length >= 6 && (prefix.startsWith("gif87a") || prefix.startsWith("gif89a"))) {
    return "image/gif"
  }
  if (
    prefixBytes.length >= 8 &&
    prefixBytes[0] === 0x89 &&
    prefixBytes[1] === 0x50 &&
    prefixBytes[2] === 0x4e &&
    prefixBytes[3] === 0x47
  ) {
    return "image/png"
  }
  if (prefixBytes.length >= 3 && prefixBytes[0] === 0xff && prefixBytes[1] === 0xd8 && prefixBytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    prefixBytes.length >= 4 &&
    ((prefixBytes[0] === 0x49 && prefixBytes[1] === 0x49 && prefixBytes[2] === 0x2a && prefixBytes[3] === 0) ||
      (prefixBytes[0] === 0x4d && prefixBytes[1] === 0x4d && prefixBytes[2] === 0 && prefixBytes[3] === 0x2a))
  ) {
    return "image/tiff"
  }
  if (prefixBytes.length >= 2 && prefixBytes[0] === 0x42 && prefixBytes[1] === 0x4d) {
    return "image/bmp"
  }
  if (prefixBytes.length >= 12 && prefix.startsWith("riff") && prefix.slice(8, 12) === "webp") {
    return "image/webp"
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
  if (prefix.startsWith("{\\rtf")) {
    return "application/rtf"
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
    !isCaliforniaBillPdfUrl(sourceUrl) ||
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
      accept: "application/pdf,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "content-type": "application/x-www-form-urlencoded",
      ...(cookieHeader(response) === undefined ? {} : { cookie: cookieHeader(response) }),
      origin: sourceUrl.origin,
      referer: sourceUrl.href,
      "user-agent": BROWSER_USER_AGENT
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
  const url = resolveApprovedDocumentUrl(sourceUrl)
  if (url.protocol === "http:" && options.allowHttp !== true) {
    url.protocol = "https:"
  } else if (url.protocol !== "https:" && !(options.allowHttp === true && url.protocol === "http:")) {
    throw new Error("Document URL must use HTTPS")
  }
  const maximumBytes = options.maximumBytes ?? MAX_DOCUMENT_BYTES
  const fetcher = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 30_000
  const initialResponse = await fetcher(url, {
    headers: { "user-agent": BROWSER_USER_AGENT },
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
  if (isCaliforniaBillPdfUrl(url) && contentType !== "application/pdf") {
    throw new Error(`California bill PDF is not available from publisher (received ${contentType})`)
  }
  return { bytes, contentType, sourceUrl: finalUrl.href }
}
