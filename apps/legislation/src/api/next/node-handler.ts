import { randomUUID } from "node:crypto"
import { once } from "node:events"
import { IncomingMessage, ServerResponse, type IncomingHttpHeaders } from "node:http"
import { Socket } from "node:net"
import { runWithRequestContext } from "../../auth/request-context.js"
import { LegislationError } from "../../legislation/errors.js"
import { prepareApiResponse, sendApiError, type HttpApiHandler } from "../http.js"

const DEFAULT_MAXIMUM_BODY_BYTES = 5 * 1024 * 1024

export type NodeHttpApiHandlerOptions = Readonly<{
  maximumBodyBytes?: number
}>

/**
 * Executes one existing Node HTTP API handler behind a Web Request/Response
 * boundary. Both Node objects are real Node HTTP primitives so the handlers
 * retain their normal stream, header, response, and conditional-GET behavior.
 */
export async function executeNextHttpApiHandler(
  webRequest: Request,
  handler: HttpApiHandler,
  options: NodeHttpApiHandlerOptions = {}
): Promise<Response> {
  const maximumBodyBytes = options.maximumBodyBytes ?? DEFAULT_MAXIMUM_BODY_BYTES
  assertMaximumBodyBytes(maximumBodyBytes)

  const requestSocket = new Socket({ allowHalfOpen: true })
  requestSocket.on("error", () => undefined)
  const responseSocket = new CaptureSocket()
  const request = createIncomingRequest(webRequest, requestSocket)
  const response = new ServerResponse(request)
  response.assignSocket(responseSocket)
  const correlationId = webRequest.headers.get("x-correlation-id") ?? randomUUID()
  response.setHeader("cache-control", "private, no-store")
  response.setHeader("x-correlation-id", correlationId)
  prepareApiResponse(response, request)

  const body = new WebBodyReader(webRequest, request, maximumBodyBytes)
  body.start()

  try {
    let handled = false
    try {
      handled = await runWithRequestContext({ correlationId }, async () => await handler(request, response))
    } catch (error) {
      if (webRequest.signal.aborted) {
        throw abortError(webRequest.signal)
      }
      if (!response.writableEnded) {
        runWithRequestContext({ correlationId }, () => sendApiError(request, response, error))
      }
      handled = true
    }
    if (webRequest.signal.aborted) {
      throw abortError(webRequest.signal)
    }
    if (!handled) {
      runWithRequestContext({ correlationId }, () =>
        sendApiError(request, response, new LegislationError("not_found", "API route was not found"))
      )
    } else if (!response.writableEnded) {
      runWithRequestContext({ correlationId }, () =>
        sendApiError(request, response, new LegislationError("internal", "API handler completed without a response"))
      )
    }

    if (!response.writableFinished) {
      await once(response, "finish")
    }
    return responseFromCapture(responseSocket)
  } finally {
    await body.dispose()
    response.detachSocket(responseSocket)
    requestSocket.destroy()
  }
}

function createIncomingRequest(webRequest: Request, socket: Socket): IncomingMessage {
  const url = new URL(webRequest.url)
  const request = new IncomingMessage(socket)
  const headers: IncomingHttpHeaders = {}
  const rawHeaders: string[] = []
  webRequest.headers.forEach((value, name) => {
    headers[name] = value
    rawHeaders.push(name, value)
  })
  request.headers = headers
  request.rawHeaders = rawHeaders
  request.method = webRequest.method
  request.url = `${url.pathname}${url.search}`
  request.on("error", () => undefined)
  return request
}

class WebBodyReader {
  readonly #reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  readonly #request: IncomingMessage
  readonly #signal: AbortSignal
  readonly #maximumBodyBytes: number
  #bytes = 0
  #closed = false
  #reading = false
  #abortListener: (() => void) | undefined

  constructor(webRequest: Request, request: IncomingMessage, maximumBodyBytes: number) {
    this.#reader = webRequest.body?.getReader()
    this.#request = request
    this.#signal = webRequest.signal
    this.#maximumBodyBytes = maximumBodyBytes
  }

  start(): void {
    if (this.#reader === undefined) {
      this.#request.complete = true
      this.#request.push(null)
      return
    }
    this.#request._read = () => {
      void this.readNext()
    }
    this.#abortListener = () => {
      void this.abort(abortError(this.#signal))
    }
    this.#signal.addEventListener("abort", this.#abortListener, { once: true })
    if (this.#signal.aborted) {
      void this.abort(abortError(this.#signal))
    }
  }

  async dispose(): Promise<void> {
    if (this.#abortListener !== undefined) {
      this.#signal.removeEventListener("abort", this.#abortListener)
    }
    if (this.#closed) {
      return
    }
    this.#closed = true
    await this.#reader?.cancel().catch(() => undefined)
    if (!this.#request.destroyed) {
      this.#request.destroy()
    }
  }

  private async readNext(): Promise<void> {
    if (this.#closed || this.#reading || this.#reader === undefined) {
      return
    }
    this.#reading = true
    try {
      const { done, value } = await this.#reader.read()
      if (this.#closed) {
        return
      }
      if (done) {
        this.#closed = true
        this.#request.complete = true
        this.#request.push(null)
        return
      }
      if (value === undefined) {
        this.#request.destroy(new Error("Web request body ended without a chunk"))
        return
      }
      this.#bytes += value.byteLength
      if (this.#bytes > this.#maximumBodyBytes) {
        await this.cancelThenDestroy(new LegislationError("payload_too_large", "Request body exceeds the allowed size"))
        return
      }
      this.#request.push(value)
    } catch (error) {
      if (!this.#closed) {
        this.#closed = true
        this.#request.destroy(toError(error))
      }
    } finally {
      this.#reading = false
    }
  }

  private async abort(error: Error): Promise<void> {
    await this.cancelThenDestroy(error)
  }

  private async cancelThenDestroy(error: Error): Promise<void> {
    if (this.#closed) {
      return
    }
    this.#closed = true
    await this.#reader?.cancel(error).catch(() => undefined)
    this.#request.destroy(error)
  }
}

class CaptureSocket extends Socket {
  readonly #chunks: Buffer[] = []

  constructor() {
    super({ allowHalfOpen: true })
    this.on("error", () => undefined)
  }

  get captured(): Buffer {
    return Buffer.concat(this.#chunks)
  }

  override _read(): void {
    // ServerResponse only writes to this in-memory socket.
  }

  override _write(chunk: Uint8Array, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.#chunks.push(Buffer.from(chunk))
    callback()
  }

  override _writev(chunks: readonly Readonly<{ chunk: Uint8Array }>[], callback: (error?: Error | null) => void): void {
    for (const { chunk } of chunks) {
      this.#chunks.push(Buffer.from(chunk))
    }
    callback()
  }
}

function responseFromCapture(socket: CaptureSocket): Response {
  const raw = socket.captured
  const headerEnd = raw.indexOf("\r\n\r\n")
  if (headerEnd < 0) {
    throw new Error("Node API handler completed without an HTTP response")
  }
  const headerLines = raw.subarray(0, headerEnd).toString("latin1").split("\r\n")
  const status = parseStatus(headerLines.shift())
  const headers = new Headers()
  for (const line of headerLines) {
    const separator = line.indexOf(":")
    if (separator < 1) {
      throw new Error("Node API handler emitted an invalid HTTP header")
    }
    headers.append(line.slice(0, separator), line.slice(separator + 1).trimStart())
  }
  const responseBody =
    status === 204 || status === 205 || status === 304 ? null : new Uint8Array(raw.subarray(headerEnd + 4))
  return new Response(responseBody, { headers, status })
}

function parseStatus(statusLine: string | undefined): number {
  const match = /^HTTP\/\d\.\d\s+(\d{3})\b/.exec(statusLine ?? "")
  if (match === null) {
    throw new Error("Node API handler emitted an invalid HTTP status line")
  }
  return Number(match[1])
}

function assertMaximumBodyBytes(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("maximumBodyBytes must be a positive safe integer")
  }
}

function abortError(signal: AbortSignal): Error {
  return toError(signal.reason ?? new DOMException("The request was aborted", "AbortError"))
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new DOMException("The request was aborted", "AbortError")
}
