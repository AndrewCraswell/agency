import { randomUUID } from "node:crypto"

const correlations = new WeakMap<Request, string>()

export function correlationId(request: Request): string {
  const supplied = request.headers.get("x-correlation-id")?.trim()
  if (supplied && /^[a-zA-Z0-9._:-]{1,128}$/.test(supplied)) {
    return supplied
  }
  const generated = correlations.get(request) ?? randomUUID()
  correlations.set(request, generated)
  return generated
}

export function jsonResponse(
  request: Request,
  status: number,
  body: unknown,
  options: { headers?: Record<string, string> } = {}
): Response {
  const headers = new Headers(options.headers)
  headers.set("content-type", "application/json; charset=utf-8")
  headers.set("cache-control", "private, no-store")
  headers.set("x-correlation-id", correlationId(request))
  return new Response(JSON.stringify(body), { status, headers })
}
