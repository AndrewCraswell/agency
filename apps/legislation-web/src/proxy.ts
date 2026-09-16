import { NextResponse, type NextRequest, type ProxyConfig } from "next/server"

const malformedPercentEncodingMessage = "Path contains invalid percent encoding"

export const config = {
  matcher: "/api/:path*"
} satisfies ProxyConfig

export function proxy(request: NextRequest): NextResponse | undefined {
  if (!hasMalformedPercentEncoding(request.nextUrl.pathname)) {
    return undefined
  }

  const correlationId = request.headers.get("x-correlation-id")?.trim() || crypto.randomUUID()
  return NextResponse.json(
    {
      error: {
        category: "invalid_request",
        correlationId,
        message: malformedPercentEncodingMessage,
        retryable: false
      }
    },
    {
      headers: {
        "cache-control": "private, no-store",
        "content-type": "application/json; charset=utf-8",
        "x-correlation-id": correlationId
      },
      status: 400
    }
  )
}

function hasMalformedPercentEncoding(pathname: string): boolean {
  try {
    decodeURIComponent(pathname)
    return false
  } catch {
    return true
  }
}
