import { z } from "zod"

const WebhookBaseUrlSchema = z.url()
const IdentifierSchema = z.uuid()
const FocusSchema = z.string().trim().min(3).max(500)
const IdeaTypeSchema = z.string().trim().min(1).max(40)
const IdeaTypeBriefSchema = z.string().trim().min(1).max(500)
const CountSchema = z.int().min(1).max(10)
const IdeasResponseSchema = z.object({
  ideas: z.array(z.object({ idea_id: IdentifierSchema })).min(1)
})
const DraftResponseSchema = z.object({
  draft: z.array(z.object({ draft_id: IdentifierSchema })).length(1)
})
// Finding nothing worth linking is a real answer, not a failure, so an empty list parses like any other.
const RecommendationsResponseSchema = z.object({
  recommendations: z.array(z.unknown())
})
const TitleResponseSchema = z.object({ title: z.string().trim().min(1).max(300) })
const ShopDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/)
const StoreSyncResponseSchema = z.object({
  tenant_id: IdentifierSchema,
  resource_count: z.int().nonnegative()
})
const InstructionSchema = z.string().trim().min(3).max(500)
const TitleSchema = z.string().trim().min(1).max(300)
const PassageSchema = z.string().trim().min(1).max(5000)
const PassageResponseSchema = z.object({ text: z.string().trim().min(1).max(20_000) })
const ImageResponseSchema = z.object({
  image_url: z.url({ protocol: /^https$/ }),
  alt_text: z.string().trim().max(300).default("")
})

function getWebhookUrl(path: string) {
  const configuredBaseUrl = WebhookBaseUrlSchema.parse(process.env.N8N_WEBHOOK_BASE_URL)
  const baseUrl = configuredBaseUrl.endsWith("/") ? configuredBaseUrl : `${configuredBaseUrl}/`
  return new URL(path, baseUrl)
}

async function invokeWebhook<T>(path: string, payload: Record<string, string | number>, responseSchema: z.ZodType<T>) {
  const headers = new Headers({ "Content-Type": "application/json" })
  const bearerToken = process.env.N8N_WEBHOOK_BEARER_TOKEN
  if (bearerToken !== undefined && bearerToken.length > 0) {
    headers.set("Authorization", `Bearer ${bearerToken}`)
  }

  const response = await fetch(getWebhookUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180_000)
  })
  if (!response.ok) {
    throw new Error(`Blog workflow returned HTTP ${response.status}`)
  }
  return responseSchema.parse(await response.json())
}

/**
 * Asks for one store's catalogue to be copied across, and waits for the answer.
 *
 * The same workflow serves the merchant's button and the nightly schedule, so a sync means the same thing and leaves
 * the same trail however it was started. It is waited on rather than fired and forgotten because a merchant who has
 * just pressed a button is owed the result, not a page that has to be revisited to find out.
 *
 * Embedding is not asked for here. The workflow goes on to ask for it once the catalogue has landed, so the order of
 * the two steps is visible and retryable in one place.
 */
export async function synchronizeStore(shopDomain: string) {
  return invokeWebhook(
    "sync-shopify-store",
    { shop_domain: ShopDomainSchema.parse(shopDomain) },
    StoreSyncResponseSchema
  )
}

export async function generateBlogIdeas(
  tenantId: string,
  focus: string,
  ideaType: string,
  ideaTypeBrief: string,
  // A merchant browsing for something to write wants a few to choose between. A merchant who picked a keyword
  // opportunity already chose, so that path asks for one.
  count = 3
) {
  const response = await invokeWebhook(
    "generate-topic-ideas",
    {
      tenant_id: IdentifierSchema.parse(tenantId),
      focus: FocusSchema.parse(focus),
      idea_type: IdeaTypeSchema.parse(ideaType),
      idea_type_brief: IdeaTypeBriefSchema.parse(ideaTypeBrief),
      count: CountSchema.parse(count)
    },
    IdeasResponseSchema
  )
  return response.ideas.map(({ idea_id }) => idea_id)
}

export async function generateBlogDraft(tenantId: string, ideaId: string) {
  const response = await invokeWebhook(
    "generate-blog-post",
    {
      tenant_id: IdentifierSchema.parse(tenantId),
      idea_id: IdentifierSchema.parse(ideaId)
    },
    DraftResponseSchema
  )
  const [draft] = response.draft
  if (draft === undefined) {
    throw new Error("Blog workflow did not return a draft")
  }
  return draft.draft_id
}

export async function generateCommercialCrosslinks(tenantId: string, draftId: string) {
  await invokeWebhook(
    "recommend-commercial-crosslinks",
    {
      tenant_id: IdentifierSchema.parse(tenantId),
      draft_id: IdentifierSchema.parse(draftId),
      maximum_recommendations: 5
    },
    RecommendationsResponseSchema
  )
}

export async function generateFurtherReading(tenantId: string, draftId: string) {
  await invokeWebhook(
    "recommend-further-reading",
    {
      tenant_id: IdentifierSchema.parse(tenantId),
      draft_id: IdentifierSchema.parse(draftId),
      maximum_recommendations: 5
    },
    RecommendationsResponseSchema
  )
}

/**
 * Rewrites a headline from the merchant's own instruction.
 * The current title travels with the instruction so the workflow edits what is on screen rather than inventing a
 * replacement from the topic alone.
 */
export async function rewriteArticleTitle(tenantId: string, title: string, instruction: string) {
  const response = await invokeWebhook(
    "rewrite-article-title",
    {
      tenant_id: IdentifierSchema.parse(tenantId),
      title: TitleSchema.parse(title),
      instruction: InstructionSchema.parse(instruction)
    },
    TitleResponseSchema
  )
  return response.title
}

/**
 * Rewrites the passage a merchant has selected in the editor, following their own instruction.
 * The reply is plain text on purpose: it is dropped back into the document as text nodes, so a model cannot smuggle
 * markup past the editor and into the stored article body.
 */
export async function rewriteArticleText(tenantId: string, text: string, instruction: string) {
  const response = await invokeWebhook(
    "rewrite-article-text",
    {
      tenant_id: IdentifierSchema.parse(tenantId),
      text: PassageSchema.parse(text),
      instruction: InstructionSchema.parse(instruction)
    },
    PassageResponseSchema
  )
  return response.text
}

/**
 * Draws a featured image for the article.
 * The workflow answers with a link to the picture it made, which the caller stores in Shopify Files, and with a
 * description of it so the image arrives with alt text already written.
 */
export async function generateArticleImage(tenantId: string, title: string, instruction: string) {
  const response = await invokeWebhook(
    "generate-article-image",
    {
      tenant_id: IdentifierSchema.parse(tenantId),
      title: TitleSchema.parse(title),
      instruction: InstructionSchema.parse(instruction)
    },
    ImageResponseSchema
  )
  return { altText: response.alt_text, imageUrl: response.image_url }
}
