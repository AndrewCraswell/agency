import { ingestionContract } from "@repo/legislation-core/domain/ingestion-contract"
import { deploymentCommitSha } from "@repo/legislation-core/observability/deployment-identity"
import { NextResponse, type NextRequest } from "next/server"
import { jsonResponse, notFoundResponse, requestCorrelationId } from "../health/response"
import { getReadinessDependencies } from "./dependencies"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = requestCorrelationId(request)
  let dependencies: ReturnType<typeof getReadinessDependencies> | undefined

  try {
    dependencies = getReadinessDependencies()
    const isServiceReady = await dependencies.isReady()
    const readinessDetails = dependencies.readinessDetails()
    if (!isServiceReady) {
      dependencies.logger.warn("readiness check failed", { correlationId, ...readinessDetails })
    }
    return jsonResponse(correlationId, isServiceReady ? 200 : 503, {
      commitSha: deploymentCommitSha(process.env) ?? null,
      ...readinessDetails,
      ingestionContract,
      status: isServiceReady ? "ready" : "unavailable"
    })
  } catch (error) {
    const context = {
      correlationId,
      errorName: error instanceof Error ? error.name : "UnknownError"
    }
    if (dependencies === undefined) {
      console.error("request failed", context)
    } else {
      dependencies.logger.error("request failed", context)
    }
    return jsonResponse(correlationId, 500, { error: "internal_error" })
  }
}

export function DELETE(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}

export function HEAD(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}

export function OPTIONS(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}

export function PATCH(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}

export function POST(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}

export function PUT(request: NextRequest): NextResponse {
  return notFoundResponse(request)
}
