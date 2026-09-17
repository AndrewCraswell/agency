import { createAnalyticsTelemetry } from "../../../modules/legislation/analytics-telemetry"
import { createAnalyticsHandler } from "../../../modules/request-handling/api/analytics-routes"
import { executeAuthenticatedApiRequest } from "../../../modules/request-handling/next/authenticated-api-request"
import { getResearchRuntime } from "../../../modules/search/research-runtime"

export const runtime = "nodejs"

export async function GET(request: Request): Promise<Response> {
  return await POST(request)
}

export async function POST(request: Request): Promise<Response> {
  return await executeAuthenticatedApiRequest(
    request,
    createAnalyticsHandler(
      async (input) => await getResearchRuntime().run((service) => service.analyzeLegislation(input)),
      createAnalyticsTelemetry()
    )
  )
}
