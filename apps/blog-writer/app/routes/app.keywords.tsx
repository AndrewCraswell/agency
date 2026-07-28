import { boundary } from "@shopify/shopify-app-react-router/server"
import { data, useActionData, useLoaderData } from "react-router"
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router"
import { z } from "zod"
import { KeywordsPage } from "../components/KeywordsPage"
import { IDEA_TYPE_BRIEFS, IDEA_TYPE_VALUES } from "../components/PlanPage"
import { getTenantIdForShop, setBlogIdeaStatus } from "../persistence/blog-workspace-repository.server"
import { getKeywordImportOverview } from "../persistence/keyword-repository.server"
import {
  claimCluster,
  dismissCluster,
  readOpportunityList,
  restoreCluster
} from "../persistence/opportunity-repository.server"
import { authenticate } from "../shopify.server"
import { generateBlogIdeas } from "../workflows/blog-workflows.server"

const IntentSchema = z.enum(["generateIdea", "dismissCluster", "restoreCluster"])
// A cluster identifier is a hash of its terms rather than a row identifier, so it is checked for shape and never
// trusted to name a tenant.
const ClusterIdSchema = z.string().trim().min(1).max(200)
const HeadKeywordSchema = z.string().trim().min(1).max(500)
const FocusSchema = z.string().trim().min(3).max(500)
/** The focus the generator accepts, which the topic and the terms have to share. */
const FOCUS_LIMIT = 500
// The terms arrive one per line because a chip list has no order to preserve and commas appear inside search phrases.
const KeywordsSchema = z
  .string()
  .max(2000)
  .transform((value) =>
    value
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  )
  .catch([])
// The brief comes from the validated slug rather than the form, so the generator can't be told an arbitrary shape.
const IdeaTypeSchema = z.enum(IDEA_TYPE_VALUES).catch("any")
const ReasonSchema = z.string().trim().min(1).max(500)

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const [overview, list] = await Promise.all([
    getKeywordImportOverview(session.shop),
    readOpportunityList(session.shop)
  ])

  return {
    market: overview.market,
    lastImport: overview.lastImport,
    list
  }
}

/**
 * The instruction the generator receives, which is the merchant's topic plus the terms they left in the list.
 *
 * The generator takes one free-text focus, so the terms are named inside it rather than sent as their own field. The
 * whole thing has to stay inside the focus limit, so terms are dropped from the end until it fits.
 */
function buildFocus(focus: string, keywords: string[]) {
  const preamble = `${focus}\n\nCover these search terms: `
  const kept: string[] = []
  for (const keyword of keywords) {
    if (preamble.length + [...kept, keyword].join(", ").length > FOCUS_LIMIT) {
      break
    }
    kept.push(keyword)
  }
  if (kept.length === 0) {
    return focus
  }
  return `${preamble}${kept.join(", ")}`
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
    if (intent === "generateIdea") {
      const tenantId = await getTenantIdForShop(session.shop)
      if (tenantId === null) {
        throw new Error("Store content must be synchronized before writing from a keyword opportunity")
      }
      const clusterId = ClusterIdSchema.parse(formData.get("clusterId"))
      const ideaType = IdeaTypeSchema.parse(formData.get("ideaType"))
      const keywords = KeywordsSchema.parse(formData.get("keywords") ?? "")
      const ideaIds = await generateBlogIdeas(
        tenantId,
        buildFocus(FocusSchema.parse(formData.get("focus")), keywords),
        ideaType,
        IDEA_TYPE_BRIEFS[ideaType],
        1
      )
      await claimCluster(tenantId, clusterId, ideaIds)
      // The merchant picked this subject deliberately, so the idea lands in the backlog rather than waiting to be
      // approved a second time.
      await Promise.all(ideaIds.map((ideaId) => setBlogIdeaStatus(session.shop, ideaId, "selected")))
    }

    if (intent === "dismissCluster") {
      await dismissCluster(
        session.shop,
        {
          clusterId: ClusterIdSchema.parse(formData.get("clusterId")),
          headKeyword: HeadKeywordSchema.parse(formData.get("headKeyword"))
        },
        ReasonSchema.parse(formData.get("reason"))
      )
    }

    if (intent === "restoreCluster") {
      await restoreCluster(session.shop, ClusterIdSchema.parse(formData.get("clusterId")))
    }

    return { ok: true, intent }
  } catch (error) {
    console.error(`Keywords action "${intent}" failed`, error)
    return data({ ok: false, intent }, { status: 500 })
  }
}

export default function Keywords() {
  const loaderData = useLoaderData<typeof loader>()
  const actionResult = useActionData<typeof action>()

  return <KeywordsPage {...loaderData} actionResult={actionResult ?? null} />
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs)
}
