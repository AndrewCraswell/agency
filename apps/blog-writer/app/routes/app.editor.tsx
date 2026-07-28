import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { z } from "zod"
import { ArticleImageUploadError, resolveArticleImage } from "../articles/shopify-image.server"
import { getTenantIdForShop, searchLinkableResources } from "../persistence/blog-workspace-repository.server"
import { authenticate } from "../shopify.server"
import { rewriteArticleText } from "../workflows/blog-workflows.server"

/**
 * Services the article editor calls while a merchant is typing: crosslink search, inline image upload, and
 * selection rewrites. This is a resource route so the responses are plain JSON a `fetch` can await, rather than
 * the encoded payloads a page route returns.
 */

const RewriteSchema = z.object({
  text: z.string().trim().min(1, "Select the text you want rewritten").max(5000),
  instruction: z.string().trim().min(3, "Describe the change you want").max(500)
})

function readString(formData: FormData, field: string) {
  const value = formData.get(field)
  return typeof value === "string" ? value : ""
}

function problem(message: string, status: number) {
  return Response.json({ message }, { status })
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const term = new URL(request.url).searchParams.get("term") ?? ""
  return Response.json({ resources: await searchLinkableResources(session.shop, term) })
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request)
  const formData = await request.formData()
  const intent = readString(formData, "intent")

  if (intent === "resolveImage") {
    try {
      const image = await resolveArticleImage(
        (query, options) => admin.graphql(query, options),
        readString(formData, "imageId")
      )
      return Response.json(image)
    } catch (error) {
      if (error instanceof ArticleImageUploadError) {
        return problem(error.message, 400)
      }
      throw error
    }
  }

  if (intent === "rewriteText") {
    const parsed = RewriteSchema.safeParse({
      text: readString(formData, "text"),
      instruction: readString(formData, "instruction")
    })
    if (!parsed.success) {
      return problem(parsed.error.issues[0]?.message ?? "That rewrite could not be requested", 400)
    }
    const tenantId = await getTenantIdForShop(session.shop)
    if (tenantId === null) {
      return problem("This store is still being set up", 409)
    }
    return Response.json({ text: await rewriteArticleText(tenantId, parsed.data.text, parsed.data.instruction) })
  }

  return problem("That editor request is not supported", 400)
}
