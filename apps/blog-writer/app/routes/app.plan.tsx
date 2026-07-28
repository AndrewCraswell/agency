import { boundary } from "@shopify/shopify-app-react-router/server"
import { data, useActionData, useLoaderData } from "react-router"
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router"
import { z } from "zod"
import { IDEA_TYPE_BRIEFS, IDEA_TYPE_VALUES, PlanPage } from "../components/PlanPage"
import { createArticleFromDraft } from "../persistence/article-repository.server"
import {
  getBlogWorkspace,
  getTenantIdForShop,
  setBlogIdeaSchedule,
  setBlogIdeaStatus
} from "../persistence/blog-workspace-repository.server"
import { authenticate } from "../shopify.server"
import { generateBlogDraft, generateBlogIdeas } from "../workflows/blog-workflows.server"

const IntentSchema = z.enum(["generateIdeas", "selectIdea", "dismissIdea", "scheduleIdea", "generateDraft"])
const IdentifierSchema = z.uuid()
const FocusSchema = z.string().trim().min(3).max(500)
const IdeaTypeSchema = z.enum(IDEA_TYPE_VALUES).catch("any")
// An empty value takes the idea back off the calendar, which is how a merchant undoes a plan.
const ScheduledForSchema = z
  .string()
  .transform((value) => (value.trim() === "" ? null : value.trim()))
  .refine((value) => value === null || z.iso.date().safeParse(value).success, "Expected a calendar day")

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const workspace = await getBlogWorkspace(session.shop)

  return { ideas: workspace.ideas }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const formData = await request.formData()
  const intentResult = IntentSchema.safeParse(formData.get("intent"))
  if (!intentResult.success) {
    return data({ ok: false, intent: "unknown" }, { status: 400 })
  }

  const intent = intentResult.data
  try {
    if (intent === "generateIdeas") {
      const tenantId = await getTenantIdForShop(session.shop)
      if (tenantId === null) {
        throw new Error("Store content must be synchronized before generating ideas")
      }
      // The brief comes from the validated slug rather than the form, so the generator can't be told an arbitrary shape.
      const ideaType = IdeaTypeSchema.parse(formData.get("ideaType"))
      const ideaIds = await generateBlogIdeas(
        tenantId,
        FocusSchema.parse(formData.get("focus")),
        ideaType,
        IDEA_TYPE_BRIEFS[ideaType]
      )
      // Merchants asked for ideas, not a second inbox to triage, so they land in the backlog ready to schedule.
      await Promise.all(ideaIds.map((ideaId) => setBlogIdeaStatus(session.shop, ideaId, "selected")))
    }

    if (intent === "selectIdea" || intent === "dismissIdea") {
      const status = intent === "selectIdea" ? "selected" : "dismissed"
      await setBlogIdeaStatus(session.shop, IdentifierSchema.parse(formData.get("ideaId")), status)
    }

    if (intent === "scheduleIdea") {
      await setBlogIdeaSchedule(
        session.shop,
        IdentifierSchema.parse(formData.get("ideaId")),
        ScheduledForSchema.parse(formData.get("scheduledFor") ?? "")
      )
    }

    if (intent === "generateDraft") {
      const tenantId = await getTenantIdForShop(session.shop)
      if (tenantId === null) {
        throw new Error("Store content must be synchronized before generating a draft")
      }
      const draftId = await generateBlogDraft(tenantId, IdentifierSchema.parse(formData.get("ideaId")))
      await createArticleFromDraft(tenantId, draftId)
    }

    return { ok: true, intent }
  } catch (error) {
    console.error(`Plan action "${intent}" failed`, error)
    return data({ ok: false, intent }, { status: 500 })
  }
}

export default function Plan() {
  const loaderData = useLoaderData<typeof loader>()
  const actionResult = useActionData<typeof action>()

  return <PlanPage ideas={loaderData.ideas} actionResult={actionResult ?? null} />
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs)
}
