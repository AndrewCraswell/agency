import { z } from "zod"

const apiRoutes = [
  "/api/amendments",
  "/api/amendments/batch",
  "/api/amendments/[amendmentId]",
  "/api/analytics",
  "/api/bills",
  "/api/bills/batch",
  "/api/bills/amendments/batch",
  "/api/bills/[billId]",
  "/api/bills/[billId]/amendments",
  "/api/bills/[billId]/changes",
  "/api/bills/[billId]/documents",
  "/api/bills/[billId]/related",
  "/api/bills/[billId]/sections",
  "/api/bills/[billId]/timeline",
  "/api/bills/[billId]/votes",
  "/api/changes",
  "/api/changes/[changeId]",
  "/api/dev/representatives",
  "/api/document-diffs",
  "/api/documents/[documentId]",
  "/api/documents/[documentId]/sections",
  "/api/documents/[documentId]/sections/[sectionId]",
  "/api/jurisdictions",
  "/api/jurisdictions/[jurisdictionId]",
  "/api/jurisdictions/[jurisdictionId]/bills",
  "/api/jurisdictions/[jurisdictionId]/commissions",
  "/api/jurisdictions/[jurisdictionId]/committees",
  "/api/jurisdictions/[jurisdictionId]/meetings",
  "/api/jurisdictions/[jurisdictionId]/organizations",
  "/api/jurisdictions/[jurisdictionId]/sessions",
  "/api/legal/agencies",
  "/api/legal/codes",
  "/api/legal/codes/[codeId]",
  "/api/legal/codes/[codeId]/editions",
  "/api/legal/codes/[codeId]/provisions",
  "/api/legal/coverage",
  "/api/legal/editions/[editionId]",
  "/api/legal/passages/[passageId]",
  "/api/legal/provisions/resolve",
  "/api/legal/provisions/[provisionId]",
  "/api/legal/provisions/[provisionId]/editions",
  "/api/legal/provisions/[provisionId]/versions",
  "/api/legal/publications",
  "/api/legal/publications/[documentId]",
  "/api/legal/publications/[documentId]/versions",
  "/api/legal/versions/[versionId]",
  "/api/legal/versions/[versionId]/passages",
  "/api/legal/versions/[versionId]/text",
  "/api/meetings",
  "/api/meetings/[meetingId]",
  "/api/meetings/[meetingId]/agenda",
  "/api/meetings/[meetingId]/agenda/[agendaItemId]",
  "/api/meetings/[meetingId]/documents",
  "/api/meetings/[meetingId]/documents/[eventDocumentId]",
  "/api/meetings/[meetingId]/participants",
  "/api/meetings/[meetingId]/participants/[participantId]",
  "/api/organizations",
  "/api/organizations/[organizationId]",
  "/api/organizations/[organizationId]/bills",
  "/api/organizations/[organizationId]/meetings",
  "/api/organizations/[organizationId]/members",
  "/api/organizations/[organizationId]/memberships/[membershipId]",
  "/api/people",
  "/api/people/[personId]",
  "/api/people/[personId]/amendments",
  "/api/people/[personId]/bills",
  "/api/people/[personId]/memberships",
  "/api/people/[personId]/terms/[termId]",
  "/api/people/[personId]/votes",
  "/api/records/collection",
  "/api/records/resolve",
  "/api/research/answers",
  "/api/resources/batch",
  "/api/search/all",
  "/api/search/amendments",
  "/api/search/bills",
  "/api/search/legal",
  "/api/search/passages",
  "/api/search/supporting-materials",
  "/api/sessions/[sessionId]",
  "/api/sessions/[sessionId]/bills",
  "/api/sessions/[sessionId]/meetings",
  "/api/subscriptions",
  "/api/subscriptions/[subscriptionId]",
  "/api/subscriptions/[subscriptionId]/deliveries",
  "/api/subscriptions/[subscriptionId]/events",
  "/api/supporting-materials",
  "/api/supporting-materials/[materialId]",
  "/api/supporting-materials/[materialId]/sections",
  "/api/supporting-materials/[materialId]/sections/[sectionId]",
  "/api/votes",
  "/api/votes/batch",
  "/api/votes/[voteId]",
  "/api/votes/[voteId]/positions",
  "/api/webhooks",
  "/api/webhooks/[webhookId]",
  "/api/webhooks/[webhookId]/rotate-secret",
  "/api/webhooks/[webhookId]/verify"
] as const

export const telemetryRouteTemplates = [
  "/",
  "/conversations/[conversationId]",
  "/records/[kind]/[recordId]",
  "/dev/representatives",
  "/chat",
  "/health",
  "/ready",
  "/api",
  "/api/[...path]",
  "/_unmatched",
  ...apiRoutes
] as const

export const telemetryRouteSchema = z.enum(telemetryRouteTemplates)
export const telemetrySurfaceSchema = z.enum([
  "home",
  "conversation",
  "record",
  "development",
  "api",
  "health",
  "readiness",
  "not_found"
])

const matchers = telemetryRouteTemplates
  .filter((route) => route !== "/_unmatched" && route !== "/api/[...path]")
  .map((route) => ({
    route,
    segments: route.split("/"),
    dynamicCount: route.split("[").length - 1
  }))
  .toSorted((left, right) => left.dynamicCount - right.dynamicCount)

export function resolveTelemetryRoute(pathname: string) {
  const rawPath = pathname.split(/[?#]/u)[0] ?? ""
  const path =
    rawPath.startsWith("/") && !rawPath.startsWith("//") ? rawPath.replace(/\/+$/u, "") || "/" : "/_unmatched"
  const segments = path.split("/")
  const match = matchers.find(
    (candidate) =>
      candidate.segments.length === segments.length &&
      candidate.segments.every((segment, index) =>
        segment.startsWith("[") ? Boolean(segments[index]) : segment === segments[index]
      )
  )
  const route = match?.route ?? (path.startsWith("/api/") ? "/api/[...path]" : "/_unmatched")
  const surface = surfaceForRoute(route)
  return { route_template: route, surface } as const
}

function surfaceForRoute(route: z.infer<typeof telemetryRouteSchema>): z.infer<typeof telemetrySurfaceSchema> {
  if (route === "/") {
    return "home"
  }
  if (route === "/conversations/[conversationId]" || route === "/chat") {
    return "conversation"
  }
  if (route === "/records/[kind]/[recordId]") {
    return "record"
  }
  if (route === "/dev/representatives" || route === "/api/dev/representatives") {
    return "development"
  }
  if (route === "/health") {
    return "health"
  }
  if (route === "/ready") {
    return "readiness"
  }
  if (route === "/api" || route === "/api/[...path]" || route === "/_unmatched") {
    return "not_found"
  }
  return "api"
}
