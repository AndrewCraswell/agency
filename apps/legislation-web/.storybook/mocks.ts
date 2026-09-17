import { FetchInterceptor } from "@mswjs/interceptors/fetch"
import { XMLHttpRequestInterceptor } from "@mswjs/interceptors/XMLHttpRequest"
import { http, HttpResponse } from "msw"
import { defineNetwork, InterceptorSource } from "msw/experimental"
import { z } from "zod"

const requestSchema = z.object({
  action: z.string(),
  resultId: z.string(),
  recordId: z.string().optional(),
  page: z.number().optional()
})
export const network = defineNetwork({
  // @ts-expect-error MSW's experimental constructor uses an invariant HTTP/WebSocket event union for HTTP interceptors.
  sources: [new InterceptorSource({ interceptors: [new FetchInterceptor(), new XMLHttpRequestInterceptor()] })],
  handlers: [
    http.post("*/chat", async ({ request }) => {
      const parsed = requestSchema.safeParse(await request.json())
      if (!parsed.success) {
        return HttpResponse.json({ error: "Model requests are disabled in Storybook." }, { status: 400 })
      }
      const input = parsed.data
      const { reviewData } = await import("../src/modules/conversations/stories/reviewFixtures")
      const result = reviewData.captures.find((capture) => capture.output.resultSet?.id === input.resultId)?.output
        .resultSet
      if (!result) {
        return HttpResponse.json({ error: "No captured result." }, { status: 410 })
      }
      if (input.action === "page-results" && input.page === 0) {
        return HttpResponse.json(result)
      }
      if (input.action !== "inspect-record" || !result.items.some((record) => record.id === input.recordId)) {
        return HttpResponse.json({ error: "This operation was not captured." }, { status: 410 })
      }
      const details =
        reviewData.details[`${input.resultId}/${input.recordId}`] ??
        Object.values(reviewData.details).find((details) => details.record.id === input.recordId)
      return details
        ? HttpResponse.json(details)
        : HttpResponse.json({ error: "Details were not captured for this record." }, { status: 410 })
    })
  ]
})
